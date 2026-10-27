import jwt from "jsonwebtoken";
import db from "../config/db.js";

const BASE_ROLE_PERMISSIONS = {
  company_admin: "all",

  accountant: {
    invoices: true,
    payments: true,
    expenses: true,
    taxes: true,
    reports: true,
  },

  sales_user: {
    customers: true,
    quotations: true,
    invoices: true,
    products: true,
  },
};

const parseJson = (value) => {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return value;
};

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization token missing",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Invalid authorization format",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      company_id: decoded.company_id || null,
      branch_id: decoded.branch_id || null,
      customer_id: decoded.customer_id || null,
      permissions: parseJson(decoded.permissions),
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized access",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
};

export const authorizePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Unauthorized access",
        });
      }

      const role = req.user.role;

      if (role === "company_admin") {
        return next();
      }

      const basePermissions = BASE_ROLE_PERMISSIONS[role];

      if (basePermissions === "all" || basePermissions?.[permissionKey]) {
        return next();
      }

      if (!req.user.company_id) {
        return res.status(403).json({
          message: "Company permission not found",
        });
      }

      const userPermissions = parseJson(req.user.permissions);

      if (userPermissions?.[permissionKey]) {
        return next();
      }

      const [companyRows] = await db.query(
        `
        SELECT role_permissions
        FROM tbl_companies
        WHERE id = ?
        LIMIT 1
        `,
        [req.user.company_id],
      );

      if (companyRows.length === 0) {
        return res.status(403).json({
          message: "Company permission not found",
        });
      }

      const rolePermissions = parseJson(companyRows[0].role_permissions);
      const extraRolePermissions = rolePermissions?.[role] || {};

      if (!extraRolePermissions?.[permissionKey]) {
        return res.status(403).json({
          message: "Permission denied",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Permission check error",
        error: error.message,
      });
    }
  };
};

export const applyBranchFilter = (req, alias = "", column = "branch_id") => {
  if (req.user?.role === "company_admin" || !req.user?.branch_id) {
    return {
      clause: "",
      params: [],
    };
  }

  return {
    clause: ` AND ${alias}${column} = ? `,
    params: [req.user.branch_id],
  };
};

export const kycAccessMiddleware = async (
  req,
  res,
  next,
) => {
  try {
    const mutationMethods = [
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ];

    /*
    |--------------------------------------------------------------------------
    | VIEW MODE
    |--------------------------------------------------------------------------
    |
    | GET requests KYC pending ya subscription expired hone par bhi allowed.
    |
    */

    if (!mutationMethods.includes(req.method)) {
      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | SUPERADMIN BYPASS
    |--------------------------------------------------------------------------
    */

    if (req.user?.role === "superadmin") {
      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | NON-COMPANY USERS
    |--------------------------------------------------------------------------
    */

    if (!req.user?.company_id) {
      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | KYC CHECK
    |--------------------------------------------------------------------------
    */

    const [companyRows] = await db.query(
      `
      SELECT kyc_status
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [req.user.company_id],
    );

    if (!companyRows.length) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    const kycStatus = String(
      companyRows[0].kyc_status || "pending",
    ).toLowerCase();

    const hasFullKycAccess = [
      "approved",
      "manual_verified",
    ].includes(kycStatus);

    if (!hasFullKycAccess) {
      return res.status(403).json({
        message: "Complete your KYC to use this feature.",
        kyc_required: true,
        kyc_status: kycStatus,
        read_only: true,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ALLOWED AFTER SUBSCRIPTION EXPIRY
    |--------------------------------------------------------------------------
    |
    | Company Admin ko Paid plan buy karne dena hai.
    | Notification read/read-all bhi allowed rahega.
    |
    */

    const requestPath = String(
      req.originalUrl || req.url || "",
    )
      .split("?")[0]
      .toLowerCase();

    const allowedAfterExpiry =
      requestPath.startsWith("/api/subscriptions") ||
      requestPath.startsWith("/api/notifications");

    if (allowedAfterExpiry) {
      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | COMPANY SUBSCRIPTION ROLES
    |--------------------------------------------------------------------------
    |
    | Company ki subscription in teeno roles par apply hogi.
    |
    */

    const subscriptionRoles = [
      "company_admin",
      "accountant",
      "sales_user",
    ];

    if (!subscriptionRoles.includes(req.user?.role)) {
      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | ACTIVE SUBSCRIPTION CHECK
    |--------------------------------------------------------------------------
    */

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.status,
        cs.start_date,
        cs.renewal_date,
        cs.auto_renewal,
        sp.plan_name,
        sp.plan_type,

        CASE
          WHEN cs.status = 'active'
            AND cs.start_date <= CURDATE()
            AND cs.renewal_date IS NOT NULL
            AND cs.renewal_date >= CURDATE()
          THEN 1
          ELSE 0
        END AS is_valid

      FROM tbl_company_subscriptions cs

      JOIN tbl_subscription_plans sp
        ON sp.id = cs.plan_id

      WHERE cs.company_id = ?

      ORDER BY
        is_valid DESC,
        cs.id DESC

      LIMIT 1
      `,
      [req.user.company_id],
    );

    const subscription =
      subscriptionRows[0] || null;

    /*
    |--------------------------------------------------------------------------
    | VALID SUBSCRIPTION
    |--------------------------------------------------------------------------
    */

    if (Number(subscription?.is_valid) === 1) {
      req.subscription = {
        id: subscription.id,
        status: subscription.status,
        plan_name: subscription.plan_name,
        plan_type: subscription.plan_type,
        start_date: subscription.start_date,
        renewal_date: subscription.renewal_date,
        auto_renewal: Number(
          subscription.auto_renewal || 0,
        ),
      };

      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | EXPIRED / MISSING SUBSCRIPTION
    |--------------------------------------------------------------------------
    */

    const subscriptionStatus = subscription
      ? subscription.status === "active"
        ? "expired"
        : subscription.status
      : "missing";

    return res.status(403).json({
      message:
        subscriptionStatus === "missing"
          ? "No active subscription found. Please purchase a plan to continue."
          : "Company subscription has expired. Please purchase a plan to continue.",

      subscription_required: true,
      subscription_status: subscriptionStatus,
      plan_name: subscription?.plan_name || null,
      renewal_date:
        subscription?.renewal_date || null,
      read_only: true,
    });
  } catch (error) {
    console.error(
      "KYC/subscription access error:",
      error,
    );

    return res.status(500).json({
      message:
        "Unable to verify KYC or subscription access.",
      error: error.message,
    });
  }
};

export default authMiddleware;
