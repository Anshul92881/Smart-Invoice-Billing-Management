import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";
import { notifySuperAdmins } from "../utils/notificationLoggers.js";
import transporter from "../utils/emailService.js";

import {
  generateAadhaarOtp,
  verifyAadhaarOtp as sandboxVerifyAadhaarOtp,
  verifyPan as sandboxVerifyPan,
  verifyGst as sandboxVerifyGst,
  verifyTan as sandboxVerifyTan,
} from "../services/sandboxKycService.js";

import { assignDefaultFreeSubscription } from "./kycController.js";

const MAX_KYC_ATTEMPTS = 3;

const getUserAgent = (req) => req.headers["user-agent"] || null;

const formatDateForSandbox = (value) => {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }

  return text;
};

const shouldIncreaseKycAttempt = (message = "") => {
  const text = String(message).toLowerCase();

  if (
    text.includes("insufficient credits") ||
    text.includes("credit") ||
    text.includes("sandbox") ||
    text.includes("authenticate") ||
    text.includes("api key") ||
    text.includes("server") ||
    text.includes("timeout")
  ) {
    return false;
  }

  return true;
};

const isSuccessResponse = (response) => {
  const status = String(response?.status || "").toLowerCase();
  const dataStatus = String(response?.data?.status || "").toLowerCase();
  const resultStatus = String(response?.result?.status || "").toLowerCase();

  return (
    Number(response?.code) === 200 ||
    response?.success === true ||
    response?.data?.valid === true ||
    status === "success" ||
    status === "valid" ||
    dataStatus === "success" ||
    dataStatus === "valid" ||
    resultStatus === "success" ||
    resultStatus === "valid"
  );
};

const getCompanyAdmin = async (companyId) => {
  const [rows] = await db.query(
    `
    SELECT id, name, email
    FROM tbl_users
    WHERE company_id = ?
    AND role = 'company_admin'
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0] || null;
};

const sendKycApprovedEmail = async (email, name) => {
  if (!email) return;

  await transporter.sendMail({
    to: email,
    subject: "KYC Approved",
    html: `
      <p>Hello ${name || "Company Admin"},</p>
      <p>Your company verification has been completed.</p>
      <p>You can now login and start using the platform.</p>
    `,
  });
};

const ensureKycAllowed = async (companyId, req = null) => {
  const [rows] = await db.query(
    `
    SELECT kyc_status, kyc_attempts
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  if (rows.length === 0) {
    return {
      allowed: false,
      statusCode: 404,
      message: "Company not found",
    };
  }

  const company = rows[0];

  if (
    req?.user?.role !== "superadmin" &&
    (company.kyc_status === "blocked" ||
      Number(company.kyc_attempts || 0) >= MAX_KYC_ATTEMPTS)
  ) {
    return {
      allowed: false,
      statusCode: 403,
      message: "KYC attempts exhausted. Please contact Super Admin.",
    };
  }

  if (
    company.kyc_status === "approved" ||
    company.kyc_status === "manual_verified"
  ) {
    return {
      allowed: false,
      statusCode: 400,
      message: "KYC already verified",
    };
  }

  return { allowed: true };
};

const increaseAttempt = async (companyId, req = null) => {
  await db.query(
    `
    UPDATE tbl_companies
    SET kyc_attempts = kyc_attempts + 1
    WHERE id = ?
    `,
    [companyId],
  );

  const [rows] = await db.query(
    `
    SELECT kyc_attempts
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  const attempts = Number(rows?.[0]?.kyc_attempts || 0);

  if (attempts >= MAX_KYC_ATTEMPTS) {
    await db.query(
      `
      UPDATE tbl_companies
      SET
        status = 'inactive',
        kyc_status = 'blocked'
      WHERE id = ?
      `,
      [companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req?.user?.id || null,
      role: req?.user?.role || "company_admin",
      action: "KYC_BLOCKED",
      module_name: "KYC",
      description: "Company blocked after maximum KYC attempts",
      ip_address: req?.ip || null,
      user_agent: req ? getUserAgent(req) : null,
    });

    await notifySuperAdmins({
      type: "security",
      severity: "high",
      title: "KYC Account Blocked",
      message: "A company account was blocked after maximum KYC attempts.",
    });
  }

  return attempts;
};

const autoApproveCompany = async (
  companyId,
  req = null,
) => {
  const isManualKyc =
    req?.user?.role === "superadmin";

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT
        aadhaar_verified,
        pan_verified
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [companyId],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return false;
    }

    const company = rows[0];

    if (
      Number(company.aadhaar_verified) !== 1 ||
      Number(company.pan_verified) !== 1
    ) {
      await connection.rollback();
      return false;
    }

    const [docRows] = await connection.query(
      `
      SELECT COUNT(DISTINCT document_type) AS total_docs
      FROM tbl_company_kyc_documents
      WHERE company_id = ?
        AND document_type IN (
          'aadhaar_card',
          'pan_card'
        )
      `,
      [companyId],
    );

    const totalDocs = Number(
      docRows[0]?.total_docs || 0,
    );

    if (totalDocs < 2) {
      await connection.rollback();
      return false;
    }


    await connection.query(
      `
      UPDATE tbl_companies
      SET
        status = 'active',
        kyc_status = ?,
        kyc_verified_at = NOW(),
        kyc_verified_by = ?,
        kyc_attempts = 0,
        kyc_rejection_reason = NULL
      WHERE id = ?
      `,
      [
        isManualKyc
          ? "manual_verified"
          : "approved",
        isManualKyc
          ? req.user.id
          : null,
        companyId,
      ],
    );


    await connection.query(
      `
      UPDATE tbl_users
      SET status = 'active'
      WHERE company_id = ?
        AND role = 'company_admin'
      `,
      [companyId],
    );

    await assignDefaultFreeSubscription(
      connection,
      companyId,
    );

    await connection.commit();

    const admin = await getCompanyAdmin(companyId);

    if (admin?.email) {
      try {
        await sendKycApprovedEmail(
          admin.email,
          admin.name,
        );
      } catch (emailError) {
        console.error(
          "KYC approved email error:",
          emailError,
        );
      }
    }

    try {
      await createAuditLog({
        company_id: companyId,
        user_id: req?.user?.id || null,
        role:
          req?.user?.role || "company_admin",
        action: isManualKyc
          ? "KYC_MANUAL_APPROVED"
          : "KYC_AUTO_APPROVED",
        module_name: "KYC",
        description: isManualKyc
          ? "Company manually approved by SuperAdmin and Default Free Plan assigned"
          : "Company automatically approved and Default Free Plan assigned",
        ip_address: req?.ip || null,
        user_agent: req
          ? getUserAgent(req)
          : null,
      });
    } catch (auditError) {
      console.error(
        "KYC approval audit log error:",
        auditError,
      );
    }

    return true;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure
    }

    throw error;
  } finally {
    connection.release();
  }
};

const checkKycAccess = async (req, res) => {
  const companyId =
    req.user.role === "superadmin" ? req.params.companyId : req.user.company_id;

  if (!companyId) {
    res.status(400).json({
      message: "Company id missing",
    });
    return null;
  }

  const check = await ensureKycAllowed(companyId, req);

  if (!check.allowed) {
    res.status(check.statusCode).json({
      message: check.message,
    });
    return null;
  }

  return companyId;
};

export const sendAadhaarOtp = async (req, res) => {
  try {
    const companyId = await checkKycAccess(req, res);
    if (!companyId) return;

    const { aadhaar_number } = req.body;

    if (!aadhaar_number) {
      return res.status(400).json({
        message: "Aadhaar number is required",
      });
    }

    const finalAadhaar = String(aadhaar_number).trim().replace(/\s/g, "");

    if (!/^\d{12}$/.test(finalAadhaar)) {
      return res.status(400).json({
        message: "Aadhaar number must be 12 digits",
      });
    }

    if (/^(\d)\1{11}$/.test(finalAadhaar)) {
      return res.status(400).json({
        message: "Invalid Aadhaar number",
      });
    }

    const response = await generateAadhaarOtp({
      aadhaarNumber: finalAadhaar,
      consent: "Y",
      reason: "KYC verification for company onboarding",
    });

    const referenceId =
      response?.reference_id ||
      response?.data?.reference_id ||
      response?.ref_id ||
      response?.data?.ref_id;

    if (!referenceId) {
      throw new Error("Reference id not received from Sandbox");
    }

    await db.query(
      `
      INSERT INTO tbl_kyc_otp_sessions
      (
        company_id,
        aadhaar_number,
        reference_id
      )
      VALUES (?, ?, ?)
      `,
      [companyId, aadhaar_number, referenceId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "AADHAAR_OTP_SENT",
      module_name: "KYC",
      description: "Aadhaar OTP generated",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "OTP sent successfully",
      reference_id: referenceId,
    });
  } catch (error) {
    console.error("AADHAAR OTP ERROR =>", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      message: error.message,
    });
  }
};

export const verifyAadhaarOtp = async (req, res) => {
  try {
    const companyId = await checkKycAccess(req, res);
    if (!companyId) return;

    const { otp, reference_id } = req.body;

    if (!otp || !reference_id) {
      return res.status(400).json({
        message: "OTP and reference id are required",
      });
    }

    const response = await sandboxVerifyAadhaarOtp({
      referenceId: String(reference_id),
      otp: String(otp).trim(),
    });

    const success = isSuccessResponse(response);

    if (!success) {
      const attempts = await increaseAttempt(companyId, req);

      await createAuditLog({
        company_id: companyId,
        user_id: req.user.id,
        role: req.user.role,
        action: "AADHAAR_VERIFY_FAILED",
        module_name: "KYC",
        description: "Aadhaar verification failed",
        ip_address: req.ip,
        user_agent: getUserAgent(req),
      });

      return res.status(400).json({
        message:
          attempts >= MAX_KYC_ATTEMPTS
            ? "KYC attempts exhausted. Account blocked."
            : "Aadhaar verification failed",
        attempts,
        blocked: attempts >= MAX_KYC_ATTEMPTS,
        data: response,
      });
    }

    await db.query(
      `
  UPDATE tbl_companies
  SET aadhaar_verified = 1
  WHERE id = ?
  `,
      [companyId],
    );

    await db.query(
      `
  UPDATE tbl_kyc_otp_sessions
  SET otp_verified = 1
  WHERE reference_id = ?
  AND company_id = ?
  `,
      [reference_id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "AADHAAR_VERIFIED",
      module_name: "KYC",
      description: "Aadhaar verified successfully",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    const approved = await autoApproveCompany(companyId, req);

    return res.json({
      message: "Aadhaar verified successfully",
      approved,
      data: response,
    });
  } catch (error) {
    console.error("AADHAAR VERIFY CONTROLLER ERROR =>", {
      message: error.message,
      stack: error.stack,
    });

    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: error.message,
      });
    }

    if (!shouldIncreaseKycAttempt(error.message)) {
      return res.status(400).json({
        message: error.message,
        attempts_not_counted: true,
      });
    }

    const attempts = await increaseAttempt(companyId, req);

    return res.status(400).json({
      message: error.message,
      attempts,
      blocked: attempts >= MAX_KYC_ATTEMPTS,
    });
  }
};

export const verifyPan = async (req, res) => {
  try {
    const companyId = await checkKycAccess(req, res);
    if (!companyId) return;

    const {
      pan_number,
      name_as_per_pan,
      date_of_birth,
      consent = "Y",
      reason = "KYC verification for company onboarding",
    } = req.body;

    if (!pan_number) {
      return res.status(400).json({
        message: "PAN number required",
      });
    }

    if (!name_as_per_pan) {
      return res.status(400).json({
        message: "Name as per PAN is required",
      });
    }

    if (!date_of_birth) {
      return res.status(400).json({
        message: "Date of birth/incorporation is required",
      });
    }

    const finalPan = String(pan_number).trim().toUpperCase();
    const finalPanName = String(name_as_per_pan).trim();
    const finalPanDobForSandbox = formatDateForSandbox(date_of_birth);

    const response = await sandboxVerifyPan({
      panNumber: finalPan,
      nameAsPerPan: finalPanName,
      dateOfBirth: finalPanDobForSandbox,
      consent,
      reason,
    });

    const success = isSuccessResponse(response);

    if (!success) {
      const attempts = await increaseAttempt(companyId, req);

      await createAuditLog({
        company_id: companyId,
        user_id: req.user.id,
        role: req.user.role,
        action: "PAN_VERIFY_FAILED",
        module_name: "KYC",
        description: "PAN verification failed",
        ip_address: req.ip,
        user_agent: getUserAgent(req),
      });

      return res.status(400).json({
        message:
          attempts >= MAX_KYC_ATTEMPTS
            ? "KYC attempts exhausted. Account blocked."
            : "PAN verification failed",
        attempts,
        blocked: attempts >= MAX_KYC_ATTEMPTS,
        data: response,
      });
    }

    await db.query(
      `
  UPDATE tbl_companies
  SET
    pan_number = ?,
    pan_verified = 1
  WHERE id = ?
  `,
      [finalPan, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "PAN_VERIFIED",
      module_name: "KYC",
      description: "PAN verified successfully",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    const approved = await autoApproveCompany(companyId, req);

    return res.json({
      message: "PAN verified successfully",
      approved,
      data: response,
    });
  } catch (error) {
    console.error("PAN VERIFY CONTROLLER ERROR =>", {
      message: error.message,
      stack: error.stack,
    });

    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: error.message,
      });
    }

    if (!shouldIncreaseKycAttempt(error.message)) {
      return res.status(400).json({
        message: error.message,
        attempts_not_counted: true,
      });
    }

    const attempts = await increaseAttempt(companyId, req);

    return res.status(400).json({
      message: error.message,
      attempts,
      blocked: attempts >= MAX_KYC_ATTEMPTS,
    });
  }
};

export const verifyGst = async (req, res) => {
  try {
    const companyId = await checkKycAccess(req, res);
    if (!companyId) return;

    const { gst_number } = req.body;

    if (!gst_number) {
      return res.status(400).json({
        message: "GST number required",
      });
    }

    const finalGst = String(gst_number).trim().toUpperCase();

    const response = await sandboxVerifyGst(finalGst);
    const success = isSuccessResponse(response);

    if (!success) {
      return res.status(400).json({
        message: "GST verification failed",
        data: response,
      });
    }

    await db.query(
      `
      UPDATE tbl_companies
      SET
        gst_number = ?,
        gst_verified = 1
      WHERE id = ?
      `,
      [finalGst, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "GST_VERIFIED",
      module_name: "KYC",
      description: "GST verified successfully",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "GST verified successfully",
      data: response,
    });
  } catch (error) {
    console.error("GST VERIFY CONTROLLER ERROR =>", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      message: error.message,
    });
  }
};

export const verifyTan = async (req, res) => {
  try {
    const companyId = await checkKycAccess(req, res);
    if (!companyId) return;

    const { tan_number } = req.body;

    if (!tan_number) {
      return res.status(400).json({
        message: "TAN number required",
      });
    }

    const finalTan = String(tan_number).trim().toUpperCase();

    const response = await sandboxVerifyTan(finalTan);
    const success = isSuccessResponse(response);

    if (!success) {
      return res.status(400).json({
        message: "TAN verification failed",
        data: response,
      });
    }

    await db.query(
      `
      UPDATE tbl_companies
      SET tan_number = ?
      WHERE id = ?
      `,
      [finalTan, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "TAN_VERIFIED",
      module_name: "KYC",
      description: "TAN verified successfully",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "TAN verified successfully",
      data: response,
    });
  } catch (error) {
    console.error("TAN VERIFY CONTROLLER ERROR =>", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      message: error.message,
    });
  }
};
