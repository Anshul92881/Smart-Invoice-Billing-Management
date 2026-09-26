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

export const kycAccessMiddleware = async (req, res, next) => {
  try {
    const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];

    // View Only Mode
    if (!mutationMethods.includes(req.method)) {
      return next();
    }

    // Super Admin bypass
    if (req.user?.role === "superadmin") {
      return next();
    }

    if (!req.user?.company_id) {
      return next();
    }

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

    if (kycStatus !== "approved") {
      return res.status(403).json({
        message: "Complete your KYC to use this feature.",
        kyc_required: true,
        kyc_status: kycStatus,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Unable to verify KYC access",
      error: error.message,
    });
  }
};

export default authMiddleware;
