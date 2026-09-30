import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAuditLog } from "../utils/auditLogger.js";
import { updateCompanyActivity } from "../utils/companyActivity.js";
import { notifyCompanyAdmins } from "../utils/notificationLoggers.js";
import crypto from "crypto";
import transporter from "../utils/emailService.js";
import { passwordResetTemplate } from "../utils/emailTemplates.js";

const getUserAgent = (req) => req.headers["user-agent"] || null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;

const cleanString = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>?/gm, "").trim();
};

const normalizeEmail = (email) => cleanString(email).toLowerCase();

const isValidEmail = (email) => EMAIL_REGEX.test(email);

const isStrongPassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const passwordMessage =
  "Password must be 8-128 characters and include uppercase, lowercase, number and special character";

const parsePermissions = (permissions) => {
  if (!permissions) return {};

  if (typeof permissions === "string") {
    try {
      return JSON.parse(permissions);
    } catch {
      return {};
    }
  }

  return permissions;
};

const sendCompanySecurityNotification = async ({
  company_id,
  exclude_user_id,
  type,
  severity,
  title,
  message,
}) => {
  if (!company_id) return;

  await notifyCompanyAdmins({
    company_id,
    exclude_user_id,
    type,
    severity,
    title,
    message,
  });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userEmail = normalizeEmail(email);

    if (!userEmail || !password) {
      await createAuditLog({
        action: "LOGIN_FAILED",
        module_name: "Auth",
        description: "Login failed because email or password was missing",
        ip_address: req.ip,
        user_agent: getUserAgent(req),
      });

      return res.status(400).json({
        message: "Email and password required",
      });
    }

    if (!isValidEmail(userEmail)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    const [users] = await db.query(
      `
      SELECT
        u.*,
        b.branch_name,
        b.branch_code,
        c.status AS company_status,
        c.kyc_status,
        c.kyc_attempts,
        c.role_permissions
      FROM tbl_users u
      LEFT JOIN tbl_company_branches b
        ON u.branch_id = b.id
        AND b.company_id = u.company_id
      LEFT JOIN tbl_companies c
        ON c.id = u.company_id
      WHERE LOWER(u.email) = ?
      LIMIT 1
      `,
      [userEmail],
    );

    if (users.length === 0) {
      await createAuditLog({
        action: "LOGIN_FAILED",
        module_name: "Auth",
        description: `Failed login attempt for ${userEmail}`,
        ip_address: req.ip,
        user_agent: getUserAgent(req),
      });

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await createAuditLog({
        company_id: user.company_id || null,
        user_id: user.id,
        role: user.role,
        action: "LOGIN_FAILED",
        module_name: "Auth",
        record_id: user.id,
        description: `Invalid password attempt for ${user.email}`,
        ip_address: req.ip,
        user_agent: getUserAgent(req),
      });

      await db.query(
        `
        UPDATE tbl_users
        SET failed_login_attempts =
          COALESCE(failed_login_attempts, 0) + 1
        WHERE id = ?
        `,
        [user.id],
      );

      const [attemptRows] = await db.query(
        `
        SELECT failed_login_attempts
        FROM tbl_users
        WHERE id = ?
        `,
        [user.id],
      );

      const failedAttempts = Number(
        attemptRows[0]?.failed_login_attempts || 0,
      );

      if (failedAttempts >= 4) {
        await sendCompanySecurityNotification({
          company_id: user.company_id,
          exclude_user_id: user.id,
          type: "security",
          severity: "high",
          title: "Multiple Failed Logins",
          message: `${user.email} had multiple failed login attempts.`,
        });
      }

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }


    if (user.role === "company_admin" && user.company_id) {
      const isKycBlocked = ["blocked", "rejected"].includes(
        user.kyc_status,
      );

      if (isKycBlocked) {
        const kycToken = jwt.sign(
          {
            id: user.id,
            role: user.role,
            company_id: user.company_id,
            branch_id: user.branch_id || null,
            permissions: {},
            kyc_only: true,
            kyc_status: user.kyc_status,
          },
          process.env.JWT_SECRET,
          { expiresIn: "3h" },
        );

        await createAuditLog({
          company_id: user.company_id,
          user_id: user.id,
          role: user.role,
          action: "KYC_LOGIN_BLOCKED",
          module_name: "Auth",
          record_id: user.id,
          description: `Company Admin login blocked because KYC status is ${
            user.kyc_status || "unknown"
          }`,
          ip_address: req.ip,
          user_agent: getUserAgent(req),
        });

        return res.status(403).json({
          message:
            user.kyc_status === "blocked"
              ? "Company account blocked due to failed KYC. Please contact Super Admin."
              : "Company KYC has been rejected. Please contact Super Admin.",
          kyc_required: true,
          company_id: user.company_id,
          kyc_status: user.kyc_status,
          kyc_attempts: user.kyc_attempts || 0,
          token: kycToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            branch_id: user.branch_id || null,
            branch_name: user.branch_name || null,
            branch_code: user.branch_code || null,
          },
        });
      }
    }

    /*
     * New company admin is initially stored as inactive while KYC is pending.
     * Pending/submitted KYC company admins are allowed to login in view-only
     * mode. All other inactive users remain blocked.
     */
    const isPendingKycCompanyAdmin =
      user.role === "company_admin" &&
      Boolean(user.company_id) &&
      ["pending", "submitted"].includes(user.kyc_status);

    if (user.status !== "active" && !isPendingKycCompanyAdmin) {
      await createAuditLog({
        company_id: user.company_id || null,
        user_id: user.id,
        role: user.role,
        action: "SECURITY_EVENT",
        module_name: "Auth",
        record_id: user.id,
        description: `Inactive user login attempt: ${user.email}`,
        ip_address: req.ip,
        user_agent: getUserAgent(req),
      });

      await sendCompanySecurityNotification({
        company_id: user.company_id,
        exclude_user_id: user.id,
        type: "security",
        severity: "critical",
        title: "Inactive Account Attempt",
        message: `${user.email} attempted login.`,
      });

      return res.status(403).json({
        message: "Account is inactive",
      });
    }

    if (
      user.role === "company_admin" &&
      user.company_id &&
      user.company_status !== "active" &&
      !isPendingKycCompanyAdmin
    ) {
      return res.status(403).json({
        message: "Company account is inactive",
      });
    }

    const userPermissions = parsePermissions(user.permissions);
    const companyPermissions = parsePermissions(user.role_permissions);

    const permissions = {
      ...userPermissions,
      ...(companyPermissions?.[user.role] || {}),
    };

    const hasFullKycAccess =
      user.role !== "company_admin" ||
      ["approved", "manual_verified"].includes(user.kyc_status);

    const featureAccess = hasFullKycAccess
      ? "full"
      : "view_only";

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        company_id: user.company_id,
        branch_id: user.branch_id || null,
        customer_id: user.customer_id || null,
        permissions,
        kyc_status: user.kyc_status || null,
        feature_access: featureAccess,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    await db.query(
      `
      UPDATE tbl_users
      SET
        failed_login_attempts = 0,
        last_login_at = NOW()
      WHERE id = ?
      `,
      [user.id],
    );

    if (user.company_id) {
      await updateCompanyActivity(user.company_id);
    }

    await createAuditLog({
      company_id: user.company_id || null,
      user_id: user.id,
      role: user.role,
      action: "LOGIN_SUCCESS",
      module_name: "Auth",
      record_id: user.id,
      description: `${user.name || user.email} logged in successfully`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        branch_id: user.branch_id || null,
        branch_name: user.branch_name || null,
        branch_code: user.branch_code || null,
        customer_id: user.customer_id || null,
        profile_image: user.profile_image || null,
        permissions,
        kyc_status: user.kyc_status || null,
        feature_access: featureAccess,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Login error",
      error: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    await createAuditLog({
      company_id: req.user.company_id || null,
      user_id: req.user.id,
      role: req.user.role,
      action: "LOGOUT",
      module_name: "Auth",
      record_id: req.user.id,
      description: `${req.user.role} logged out`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({ message: "Logout successful" });
  } catch (error) {
    return res.status(500).json({
      message: "Logout error",
      error: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const [users] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.company_id,
        u.branch_id,
        b.branch_name,
        b.branch_code,
        u.customer_id,
        u.status,
        u.last_login_at,
        u.profile_image,
        u.permissions,
        c.role_permissions,
        c.kyc_status,
        c.status AS company_status
      FROM tbl_users u
      LEFT JOIN tbl_company_branches b
        ON u.branch_id = b.id
        AND b.company_id = u.company_id
      LEFT JOIN tbl_companies c
        ON c.id = u.company_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const userPermissions = parsePermissions(user.permissions);
    const companyRolePermissions = parsePermissions(
      user.role_permissions,
    );

    const finalPermissions = {
      ...userPermissions,
      ...(companyRolePermissions?.[user.role] || {}),
    };

    const hasFullKycAccess =
      user.role !== "company_admin" ||
      ["approved", "manual_verified"].includes(user.kyc_status);

    const featureAccess = hasFullKycAccess
      ? "full"
      : "view_only";

    delete user.role_permissions;

    return res.json({
      user: {
        ...user,
        permissions: finalPermissions,
        kyc_status: user.kyc_status || null,
        feature_access: featureAccess,
      },
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);

    return res.status(500).json({
      message: "Profile fetch error",
      error: error.message,
    });
  }
};

export const registerCompany = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      company_name,
      company_email,
      company_phone,
      gst_number,
      country,
      hq_branch_name,
      hq_branch_code,
      admin_name,
      admin_email,
      password,
      confirm_password,
    } = req.body;

    const normalizedCompanyName = cleanString(company_name);
    const normalizedCompanyEmail = normalizeEmail(company_email);
    const normalizedCompanyPhone = cleanString(company_phone);
    const normalizedGstNumber = cleanString(gst_number).toUpperCase();
    const normalizedCountry = cleanString(country) || "India";
    const normalizedAdminName = cleanString(admin_name);
    const normalizedAdminEmail = normalizeEmail(admin_email);
    const normalizedHqBranchName = cleanString(hq_branch_name);
    const normalizedHqBranchCode = cleanString(hq_branch_code).toUpperCase();

    if (!normalizedCompanyName) {
      return res.status(400).json({ message: "Company name is required" });
    }

    if (
      normalizedCompanyName.length < 3 ||
      normalizedCompanyName.length > 100
    ) {
      return res.status(400).json({
        message: "Company name must be between 3 and 100 characters",
      });
    }

    if (!NAME_REGEX.test(normalizedCompanyName)) {
      return res.status(400).json({
        message: "Company name contains invalid characters",
      });
    }

    if (!normalizedCompanyEmail) {
      return res.status(400).json({ message: "Company email is required" });
    }

    if (!isValidEmail(normalizedCompanyEmail)) {
      return res.status(400).json({ message: "Invalid company email format" });
    }

    if (normalizedCompanyPhone && !PHONE_REGEX.test(normalizedCompanyPhone)) {
      return res.status(400).json({
        message: "Company phone must be a valid 10 digit Indian mobile number",
      });
    }

    if (normalizedGstNumber && !GST_REGEX.test(normalizedGstNumber)) {
      return res.status(400).json({
        message: "Invalid GST number format",
      });
    }

    if (!normalizedHqBranchName) {
      return res.status(400).json({
        message: "HQ Branch name is required",
      });
    }

    if (
      normalizedHqBranchName.length < 2 ||
      normalizedHqBranchName.length > 100
    ) {
      return res.status(400).json({
        message: "HQ Branch name must be between 2 and 100 characters",
      });
    }

    if (!normalizedHqBranchCode) {
      return res.status(400).json({
        message: "HQ Branch code is required",
      });
    }

    if (!BRANCH_CODE_REGEX.test(normalizedHqBranchCode)) {
      return res.status(400).json({
        message:
          "HQ Branch code must be 2-20 characters and can contain letters, numbers, underscore or hyphen",
      });
    }

    if (!normalizedAdminName) {
      return res.status(400).json({ message: "Admin name is required" });
    }

    if (normalizedAdminName.length < 3 || normalizedAdminName.length > 50) {
      return res.status(400).json({
        message: "Admin name must be between 3 and 50 characters",
      });
    }

    if (!NAME_REGEX.test(normalizedAdminName)) {
      return res.status(400).json({
        message: "Admin name contains invalid characters",
      });
    }

    if (!normalizedAdminEmail) {
      return res.status(400).json({ message: "Admin email is required" });
    }

    if (!isValidEmail(normalizedAdminEmail)) {
      return res.status(400).json({ message: "Invalid admin email format" });
    }

    if (!password || !confirm_password) {
      return res.status(400).json({
        message: "Password and confirm password are required",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: passwordMessage,
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    await connection.beginTransaction();

    const [existingCompany] = await connection.query(
      `
      SELECT id
      FROM tbl_companies
      WHERE LOWER(email) = ?
      OR LOWER(name) = ?
      LIMIT 1
      `,
      [normalizedCompanyEmail, normalizedCompanyName.toLowerCase()],
    );

    if (existingCompany.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Company already registered",
      });
    }

    const [existingUser] = await connection.query(
      `
      SELECT id
      FROM tbl_users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [normalizedAdminEmail],
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Admin email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [companyResult] = await connection.query(
      `
      INSERT INTO tbl_companies
      (
        name,
        email,
        phone,
        gst_number,
        country,
        currency,
        status,
        kyc_status,
        kyc_attempts,
        timezone,
        invoice_prefix,
        invoice_next_number,
        invoice_start_number,
        quotation_prefix,
        role_permissions,
        last_activity_at
      )
      VALUES
      (?, ?, ?, ?, ?, 'INR', 'inactive', 'pending', 0, 'Asia/Kolkata', 'INV', 1, 1, 'QUO', JSON_OBJECT(), NOW())
      `,
      [
        normalizedCompanyName,
        normalizedCompanyEmail,
        normalizedCompanyPhone || null,
        normalizedGstNumber || null,
        normalizedCountry,
      ],
    );

    const companyId = companyResult.insertId;

    const [hqBranchResult] = await connection.query(
      `
      INSERT INTO tbl_company_branches
      (
        company_id,
        branch_name,
        branch_code,
        status,
        is_main
      )
      VALUES (?, ?, ?, 'active', 1)
      `,
      [companyId, normalizedHqBranchName, normalizedHqBranchCode],
    );

    const hqBranchId = hqBranchResult.insertId;

    const defaultPermissions = {
      branches: true,
      customers: true,
      products: true,
      vendors: true,
      quotations: true,
      invoices: true,
      payments: true,
      expenses: true,
      taxes: true,
      reports: true,
      audit_logs: true,
      users: true,
      billing: true,
    };

    const [userResult] = await connection.query(
      `
      INSERT INTO tbl_users
      (
        name,
        email,
        password,
        role,
        company_id,
        branch_id,
        status,
        email_verified,
        permissions
      )
      VALUES (?, ?, ?, 'company_admin', ?, ?, 'inactive', 0, ?)
      `,
      [
        normalizedAdminName,
        normalizedAdminEmail,
        hashedPassword,
        companyId,
        hqBranchId,
        JSON.stringify(defaultPermissions),
      ],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: userResult.insertId,
      role: "company_admin",
      action: "COMPANY_REGISTERED",
      module_name: "Auth",
      record_id: companyId,
      description: `Company ${normalizedCompanyName} registered via public signup and requires KYC verification`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await connection.commit();

    const kycToken = jwt.sign(
      {
        id: userResult.insertId,
        role: "company_admin",
        company_id: companyId,
        branch_id: hqBranchId,
        permissions: {},
        kyc_only: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    return res.status(201).json({
      message:
        "Company registered successfully. Please complete KYC verification.",
      company_id: companyId,
      kyc_required: true,
      token: kycToken,
      user: {
        id: userResult.insertId,
        name: normalizedAdminName,
        email: normalizedAdminEmail,
        role: "company_admin",
        company_id: companyId,
        branch_id: hqBranchId,
        branch_name: normalizedHqBranchName,
        branch_code: normalizedHqBranchCode,
      },
    });
  } catch (error) {
    await connection.rollback();

    console.log("COMPANY REGISTER ERROR:", error);

    return res.status(500).json({
      message: "Company registration failed",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = normalizeEmail(email);

    if (!userEmail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!isValidEmail(userEmail)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    const safeMessage =
      "If this email exists, a password reset link has been sent.";

    const [users] = await db.query(
      `
      SELECT id, name, email, role, company_id
      FROM tbl_users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [userEmail],
    );

    if (users.length === 0) {
      return res.json({ message: safeMessage });
    }

    const user = users[0];

    const rawToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      `
      UPDATE tbl_users
      SET
        reset_password_token = ?,
        reset_password_expires = ?
      WHERE id = ?
      `,
      [hashedToken, expiry, user.id],
    );

    const frontendUrl = process.env.APP_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

    const html = passwordResetTemplate({
      name: user.name || "User",
      resetUrl,
      supportEmail: process.env.SUPPORT_EMAIL || "support@sellsspark.com",
      appName: "Smart Invoice",
    });

    await transporter.sendMail({
      to: user.email,
      subject: "Reset your Smart Invoice password",
      html,
    });

    await createAuditLog({
      company_id: user.company_id || null,
      user_id: user.id,
      role: user.role,
      action: "PASSWORD_RESET_REQUESTED",
      module_name: "Auth",
      record_id: user.id,
      description: `${user.role} requested password reset`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({ message: safeMessage });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Failed to request password reset",
      error: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = cleanString(req.params.token);
    const { password, confirm_password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!password || !confirm_password) {
      return res.status(400).json({ message: "Password fields are required" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: passwordMessage,
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const [users] = await db.query(
      `
      SELECT id, name, email, role, company_id
      FROM tbl_users
      WHERE reset_password_token = ?
      AND reset_password_expires > NOW()
      LIMIT 1
      `,
      [hashedToken],
    );

    if (users.length === 0) {
      return res.status(400).json({
        message: "Reset link is invalid or expired",
      });
    }

    const user = users[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `
      UPDATE tbl_users
      SET password = ?,
          reset_password_token = NULL,
          reset_password_expires = NULL,
          failed_login_attempts = 0
      WHERE id = ?
      `,
      [hashedPassword, user.id],
    );

    await createAuditLog({
      company_id: user.company_id || null,
      user_id: user.id,
      role: user.role,
      action: "PASSWORD_RESET_SUCCESS",
      module_name: "Auth",
      record_id: user.id,
      description: `${user.role} reset password successfully`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "All password fields are required",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: passwordMessage,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    const [users] = await db.query(
      `
      SELECT id, password, role, company_id, email
      FROM tbl_users
      WHERE id = ?
      LIMIT 1
      `,
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `
      UPDATE tbl_users
      SET password = ?
      WHERE id = ?
      `,
      [hashedPassword, user.id],
    );

    await createAuditLog({
      company_id: user.company_id || null,
      user_id: user.id,
      role: user.role,
      action: "PASSWORD_CHANGED",
      module_name: "Auth",
      record_id: user.id,
      description: `${user.email} changed password`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};
