import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";

const ALLOWED_BRANCH_STATUS = ["active", "inactive"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ZIP_REGEX = /^\d{5,6}$/;
const BRANCH_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;

const getUserAgent = (req) => req.headers["user-agent"] || null;

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/<[^>]*>?/gm, "")
    .trim();
};

const normalizeNullable = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const normalizeEmail = (email) => normalizeText(email).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const getCompanyId = (req) => req.user?.company_id;

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
};

const validateBranchPayload = ({
  branch_name,
  branch_code,
  email,
  phone,
  gst_number,
  country,
  zip_code,
  status,
}) => {
  const branchName = normalizeText(branch_name);
  const branchCode = normalizeUpper(branch_code);
  const branchEmail = normalizeEmail(email);
  const branchPhone = normalizeText(phone);
  const gstNumber = normalizeUpper(gst_number);
  const branchCountry = normalizeText(country);
  const zipCode = normalizeText(zip_code);
  const branchStatus = normalizeText(status).toLowerCase() || "active";

  if (!branchName) {
    return "Branch name is required";
  }

  if (branchName.length < 2 || branchName.length > 100) {
    return "Branch name must be between 2 and 100 characters";
  }

  if (!BRANCH_NAME_REGEX.test(branchName)) {
    return "Branch name contains invalid characters";
  }

  if (!branchCode) {
    return "Branch code is required";
  }

  if (!BRANCH_CODE_REGEX.test(branchCode)) {
    return "Branch code must be 2-20 characters and can contain letters, numbers, underscore or hyphen";
  }

  if (branchEmail && !EMAIL_REGEX.test(branchEmail)) {
    return "Invalid branch email format";
  }

  if (branchPhone && !PHONE_REGEX.test(branchPhone)) {
    return "Phone must be a valid 10 digit Indian mobile number";
  }

  if (gstNumber && !GST_REGEX.test(gstNumber)) {
    return "Invalid GST number format";
  }

  if (zipCode && !ZIP_REGEX.test(zipCode)) {
    return "ZIP code must be 5 to 6 digits";
  }

  if (branchCountry && branchCountry.length > 60) {
    return "Country must be less than 60 characters";
  }

  if (!ALLOWED_BRANCH_STATUS.includes(branchStatus)) {
    return "Status must be active or inactive";
  }

  return null;
};

const getBranchLimit = async (companyId) => {
  // 1. Check company-specific limit assigned by SuperAdmin
  const [companyRows] = await db.query(
    `
    SELECT branch_limit
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  if (!companyRows.length) {
    return 2;
  }

  const companyBranchLimit = companyRows[0].branch_limit;

  // SuperAdmin ne manually limit assign ki hai
  if (
    companyBranchLimit !== null &&
    companyBranchLimit !== undefined &&
    Number(companyBranchLimit) > 0
  ) {
    return Number(companyBranchLimit);
  }

  // 2. Company self-registered hai:
  // subscription/trial plan check karo
  const [subscriptionRows] = await db.query(
    `
    SELECT sp.max_branches
    FROM tbl_company_subscriptions cs
    JOIN tbl_subscription_plans sp
      ON cs.plan_id = sp.id
    WHERE cs.company_id = ?
    AND cs.status IN ('active', 'trial')
    ORDER BY cs.id DESC
    LIMIT 1
    `,
    [companyId],
  );

  const planBranchLimit = Number(subscriptionRows[0]?.max_branches || 0);

  return Math.max(2, planBranchLimit);
};

const getActiveBranchCount = async (companyId) => {
  const [branchCountRows] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM tbl_company_branches
    WHERE company_id = ?
    AND status = 'active'
    `,
    [companyId],
  );

  return Number(branchCountRows[0]?.total || 0);
};

const checkBranchCodeDuplicate = async ({
  companyId,
  branchCode,
  excludeBranchId = null,
}) => {
  const params = [companyId, branchCode];

  let query = `
    SELECT id
    FROM tbl_company_branches
    WHERE company_id = ?
    AND branch_code = ?
  `;

  if (excludeBranchId) {
    query += " AND id != ?";
    params.push(excludeBranchId);
  }

  query += " LIMIT 1";

  const [existingCode] = await db.query(query, params);

  return existingCode.length > 0;
};

export const createBranch = async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const {
      branch_name,
      branch_code,
      email,
      phone,
      gst_number,
      address,
      city,
      state,
      country,
      zip_code,
      status,
    } = req.body;

    const validationError = validateBranchPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const branchName = normalizeText(branch_name);
    const branchCode = normalizeUpper(branch_code);
    const branchEmail = normalizeEmail(email) || null;
    const branchPhone = normalizeText(phone) || null;
    const gstNumber = normalizeUpper(gst_number) || null;
    const branchStatus = normalizeText(status).toLowerCase() || "active";

    const isDuplicateCode = await checkBranchCodeDuplicate({
      companyId,
      branchCode,
    });

    if (isDuplicateCode) {
      return res.status(400).json({
        message: "Branch code already exists",
      });
    }

    const maxBranches = await getBranchLimit(companyId);
    const currentBranches = await getActiveBranchCount(companyId);

    if (branchStatus === "active" && currentBranches >= maxBranches) {
      return res.status(403).json({
        message: `Branch limit reached. Your plan allows only ${maxBranches} active branch(es).`,
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO tbl_company_branches
      (
        company_id,
        branch_name,
        branch_code,
        email,
        phone,
        gst_number,
        address,
        city,
        state,
        country,
        zip_code,
        status,
        is_main
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        companyId,
        branchName,
        branchCode,
        branchEmail,
        branchPhone,
        gstNumber,
        normalizeNullable(address),
        normalizeNullable(city),
        normalizeNullable(state),
        normalizeText(country) || "India",
        normalizeNullable(zip_code),
        branchStatus,
      ],
    );

    const [createdBranchRows] = await db.query(
      `
      SELECT *
      FROM tbl_company_branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [result.insertId, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Branch",
      record_id: result.insertId,
      description: `Branch ${branchName} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.status(201).json({
      message: "Branch created successfully",
      branch: createdBranchRows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create branch error",
      error: error.message,
    });
  }
};

export const getBranches = async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 1000, 1000);
    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (status !== "all" && !ALLOWED_BRANCH_STATUS.includes(status)) {
      return res.status(400).json({
        message: "Status must be all, active or inactive",
      });
    }

    let whereClause = "WHERE company_id = ?";
    const params = [companyId];

    if (search) {
      whereClause += `
        AND (
          branch_name LIKE ?
          OR branch_code LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
          OR gst_number LIKE ?
          OR city LIKE ?
          OR state LIKE ?
          OR country LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      params.push(
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
      );
    }

    if (status !== "all") {
      whereClause += " AND status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_company_branches
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [branches] = await db.query(
      `
      SELECT *
      FROM tbl_company_branches
      ${whereClause}
      ORDER BY is_main DESC, branch_name ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      branches,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get branches error",
      error: error.message,
    });
  }
};

export const getBranchById = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid branch id is required" });
    }

    const [branches] = await db.query(
      `
      SELECT *
      FROM tbl_company_branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (branches.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    return res.json(branches[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Get branch error",
      error: error.message,
    });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid branch id is required" });
    }

    const {
      branch_name,
      branch_code,
      email,
      phone,
      gst_number,
      address,
      city,
      state,
      country,
      zip_code,
      status,
    } = req.body;

    const validationError = validateBranchPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const branchName = normalizeText(branch_name);
    const branchCode = normalizeUpper(branch_code);
    const branchEmail = normalizeEmail(email) || null;
    const branchPhone = normalizeText(phone) || null;
    const gstNumber = normalizeUpper(gst_number) || null;
    const branchStatus = normalizeText(status).toLowerCase() || "active";

    const [branchRows] = await db.query(
      `
      SELECT id, status, is_main
      FROM tbl_company_branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (branchRows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    if (branchRows[0].is_main && branchStatus !== "active") {
      return res.status(400).json({
        message: "Main HQ branch cannot be deactivated",
      });
    }

    const isDuplicateCode = await checkBranchCodeDuplicate({
      companyId,
      branchCode,
      excludeBranchId: id,
    });

    if (isDuplicateCode) {
      return res.status(400).json({
        message: "Branch code already exists",
      });
    }

    if (branchRows[0].status !== "active" && branchStatus === "active") {
      const maxBranches = await getBranchLimit(companyId);
      const currentBranches = await getActiveBranchCount(companyId);

      if (currentBranches >= maxBranches) {
        return res.status(403).json({
          message: `Branch limit reached. Your plan allows only ${maxBranches} active branch(es).`,
        });
      }
    }

    const [result] = await db.query(
      `
      UPDATE tbl_company_branches
      SET
        branch_name = ?,
        branch_code = ?,
        email = ?,
        phone = ?,
        gst_number = ?,
        address = ?,
        city = ?,
        state = ?,
        country = ?,
        zip_code = ?,
        status = ?
      WHERE id = ? AND company_id = ?
      `,
      [
        branchName,
        branchCode,
        branchEmail,
        branchPhone,
        gstNumber,
        normalizeNullable(address),
        normalizeNullable(city),
        normalizeNullable(state),
        normalizeText(country) || "India",
        normalizeNullable(zip_code),
        branchStatus,
        id,
        companyId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const [updatedBranchRows] = await db.query(
      `
      SELECT *
      FROM tbl_company_branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Branch",
      record_id: id,
      description: `Branch ${branchName} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Branch updated successfully",
      branch: updatedBranchRows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update branch error",
      error: error.message,
    });
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid branch id is required" });
    }

    const [branchRows] = await db.query(
      `
      SELECT branch_name, status, is_main
      FROM tbl_company_branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (branchRows.length === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    if (branchRows[0].is_main) {
      return res.status(400).json({
        message: "Main HQ branch cannot be deactivated",
      });
    }

    if (branchRows[0].status === "inactive") {
      return res.status(400).json({ message: "Branch already inactive" });
    }

    await db.query(
      `
      UPDATE tbl_company_branches
      SET status = 'inactive'
      WHERE id = ? AND company_id = ?
      `,
      [id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "DELETE",
      module_name: "Branch",
      record_id: id,
      description: `Branch ${branchRows[0].branch_name} deactivated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({ message: "Branch deactivated successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Delete branch error",
      error: error.message,
    });
  }
};
