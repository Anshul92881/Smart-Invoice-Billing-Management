
import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";

const ALLOWED_TAX_TYPES = [
  "GST",
  "CGST_SGST",
  "IGST",
  "TDS",
  "TCS",
  "OTHER",
];

const HSN_SAC_REGEX = /^[0-9]{4,8}$/;
const TAX_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),/_-]+$/;

const getUserAgent = (req) =>
  req.headers["user-agent"] || null;

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

const normalizeUpper = (value) =>
  normalizeText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : NaN;
};

const toBooleanNumber = (value, defaultValue = 0) => {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return 1;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return 0;
  }

  return defaultValue;
};

const isPositiveInteger = (value) => {
  const number = Number(value);

  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return Math.min(number, max);
};

/* =========================================
   BUILD TAX PAYLOAD
========================================= */

const buildTaxPayload = (body) => {
  // Missing tax type defaults to GST.
  // Explicit invalid types are rejected by validation.
  const taxType =
    body.tax_type === undefined ||
    body.tax_type === null ||
    body.tax_type === ""
      ? "GST"
      : normalizeUpper(body.tax_type);

  const taxPercentage = toNumber(
    body.tax_percentage,
    NaN
  );

  let cgst = toNumber(body.cgst_percentage);
  let sgst = toNumber(body.sgst_percentage);
  let igst = toNumber(body.igst_percentage);
  let tds = toNumber(body.tds_percentage);
  let tcs = toNumber(body.tcs_percentage);

  // Existing split behavior preserved.
  if (
    taxType === "GST" ||
    taxType === "CGST_SGST"
  ) {
    cgst = cgst || taxPercentage / 2;
    sgst = sgst || taxPercentage / 2;
    igst = 0;
    tds = 0;
    tcs = 0;
  }

  if (taxType === "IGST") {
    cgst = 0;
    sgst = 0;
    igst = igst || taxPercentage;
    tds = 0;
    tcs = 0;
  }

  if (taxType === "TDS") {
    cgst = 0;
    sgst = 0;
    igst = 0;
    tds = tds || taxPercentage;
    tcs = 0;
  }

  if (taxType === "TCS") {
    cgst = 0;
    sgst = 0;
    igst = 0;
    tds = 0;
    tcs = tcs || taxPercentage;
  }

  if (taxType === "OTHER") {
    cgst = 0;
    sgst = 0;
    igst = 0;
    tds = 0;
    tcs = 0;
  }

  return {
    tax_name: normalizeText(body.tax_name),
    tax_type: taxType,

    // HSN/SAC is optional for reusable tax rules.
    hsn_sac_code:
      normalizeUpper(body.hsn_sac_code) || null,

    tax_percentage: taxPercentage,
    cgst_percentage: cgst,
    sgst_percentage: sgst,
    igst_percentage: igst,
    tds_percentage: tds,
    tcs_percentage: tcs,

    reverse_charge: toBooleanNumber(
      body.reverse_charge,
      0
    ),

    is_active: toBooleanNumber(
      body.is_active,
      1
    ),

    description: normalizeNullable(body.description),
  };
};

/* =========================================
   VALIDATION
========================================= */

const validatePercentage = (value, label) => {
  if (!Number.isFinite(value)) {
    return `${label} must be a valid number`;
  }

  if (value < 0 || value > 100) {
    return `${label} must be between 0 and 100`;
  }

  return null;
};

const validateTaxPayload = (payload) => {
  if (!payload.tax_name) {
    return "Tax name is required";
  }

  if (
    payload.tax_name.length < 2 ||
    payload.tax_name.length > 100
  ) {
    return "Tax name must be between 2 and 100 characters";
  }

  if (!TAX_NAME_REGEX.test(payload.tax_name)) {
    return "Tax name contains invalid characters";
  }

  if (!ALLOWED_TAX_TYPES.includes(payload.tax_type)) {
    return `Tax type must be one of: ${ALLOWED_TAX_TYPES.join(", ")}`;
  }

  const taxPercentageError = validatePercentage(
    payload.tax_percentage,
    "Tax percentage"
  );

  if (taxPercentageError) {
    return taxPercentageError;
  }

  const percentageChecks = [
    ["CGST percentage", payload.cgst_percentage],
    ["SGST percentage", payload.sgst_percentage],
    ["IGST percentage", payload.igst_percentage],
    ["TDS percentage", payload.tds_percentage],
    ["TCS percentage", payload.tcs_percentage],
  ];

  for (const [label, value] of percentageChecks) {
    const error = validatePercentage(value, label);

    if (error) return error;
  }

  if (
    payload.tax_type === "GST" ||
    payload.tax_type === "CGST_SGST"
  ) {
    const splitTotal =
      Number(payload.cgst_percentage || 0) +
      Number(payload.sgst_percentage || 0);

    if (
      Number(splitTotal.toFixed(2)) !==
      Number(payload.tax_percentage.toFixed(2))
    ) {
      return "CGST + SGST must equal tax percentage";
    }
  }

  if (
    payload.hsn_sac_code &&
    !HSN_SAC_REGEX.test(payload.hsn_sac_code)
  ) {
    return "HSN/SAC code must be 4 to 8 digits";
  }

  if (![0, 1].includes(payload.reverse_charge)) {
    return "Reverse charge must be enabled or disabled";
  }

  if (![0, 1].includes(payload.is_active)) {
    return "Status must be active or inactive";
  }

  if (
    payload.description &&
    payload.description.length > 500
  ) {
    return "Description must be less than 500 characters";
  }

  return null;
};

/* =========================================
   GET TAX BY ID
========================================= */

const getTaxById = async (id, companyId) => {
  const [rows] = await db.query(
    `
    SELECT
      id,
      company_id,
      tax_name,
      tax_type,
      hsn_sac_code,
      tax_percentage,
      cgst_percentage,
      sgst_percentage,
      igst_percentage,
      tds_percentage,
      tcs_percentage,
      reverse_charge,
      is_active,
      description,
      created_at
    FROM tbl_taxes
    WHERE id = ?
      AND company_id = ?
    LIMIT 1
    `,
    [id, companyId]
  );

  return rows[0] || null;
};

/* =========================================
   CHECK DUPLICATE TAX
========================================= */

const checkDuplicateTax = async ({
  companyId,
  taxName,
  excludeTaxId = null,
}) => {
  // Check duplicate names only.
  // Multiple tax rules may share an HSN/SAC code.

  let query = `
    SELECT id
    FROM tbl_taxes
    WHERE company_id = ?
      AND LOWER(tax_name) = ?
  `;

  const params = [
    companyId,
    taxName.toLowerCase(),
  ];

  if (excludeTaxId !== null) {
    query += " AND id != ?";
    params.push(excludeTaxId);
  }

  query += " LIMIT 1";

  const [rows] = await db.query(query, params);

  return rows.length > 0
    ? "Tax rule with this name already exists"
    : null;
};

/* =========================================
   CREATE TAX
========================================= */

export const createTax = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    const payload = buildTaxPayload(req.body);

    const validationError = validateTaxPayload(payload);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const duplicateError = await checkDuplicateTax({
      companyId: company_id,
      taxName: payload.tax_name,
    });

    if (duplicateError) {
      return res.status(409).json({
        message: duplicateError,
      });
    }

    const [taxResult] = await db.query(
      `
      INSERT INTO tbl_taxes (
        company_id,
        tax_name,
        tax_type,
        hsn_sac_code,
        tax_percentage,
        cgst_percentage,
        sgst_percentage,
        igst_percentage,
        tds_percentage,
        tcs_percentage,
        reverse_charge,
        is_active,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        payload.tax_name,
        payload.tax_type,
        payload.hsn_sac_code,
        payload.tax_percentage,
        payload.cgst_percentage,
        payload.sgst_percentage,
        payload.igst_percentage,
        payload.tds_percentage,
        payload.tcs_percentage,
        payload.reverse_charge,
        payload.is_active,
        payload.description,
      ]
    );

    const tax = await getTaxById(
      taxResult.insertId,
      company_id
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Tax",
      record_id: taxResult.insertId,
      description: `Tax ${payload.tax_name} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.status(201).json({
      message: "Tax created successfully",
      tax,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create tax error",
      error: error.message,
    });
  }
};

/* =========================================
   GET TAXES
========================================= */

export const getTaxes = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    const page = clampPagination(
      req.query.page,
      1,
      100000
    );

    const limit = clampPagination(
      req.query.limit,
      1000,
      1000
    );

    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);

    const status =
      normalizeText(req.query.status).toLowerCase() ||
      "all";

    if (!["all", "active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be all, active or inactive",
      });
    }

    let whereClause = "WHERE company_id = ?";
    const params = [company_id];

    if (search) {
      whereClause += `
        AND (
          tax_name LIKE ?
          OR tax_type LIKE ?
          OR hsn_sac_code LIKE ?
          OR description LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      params.push(
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    if (status !== "all") {
      whereClause += " AND is_active = ?";

      params.push(
        status === "active" ? 1 : 0
      );
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_taxes
      ${whereClause}
      `,
      params
    );

    const total = Number(
      countRows[0]?.total || 0
    );

    const totalPages = Math.ceil(total / limit);

    const [taxes] = await db.query(
      `
      SELECT
        id,
        company_id,
        tax_name,
        tax_type,
        hsn_sac_code,
        tax_percentage,
        cgst_percentage,
        sgst_percentage,
        igst_percentage,
        tds_percentage,
        tcs_percentage,
        reverse_charge,
        is_active,
        description,
        created_at
      FROM tbl_taxes
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return res.json({
      taxes,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get taxes error",
      error: error.message,
    });
  }
};

/* =========================================
   UPDATE TAX
========================================= */

export const updateTax = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid tax id is required",
      });
    }

    const existingTax = await getTaxById(
      id,
      company_id
    );

    if (!existingTax) {
      return res.status(404).json({
        message: "Tax not found",
      });
    }

    const payload = buildTaxPayload(req.body);

    // Preserve existing HSN/SAC if the Edit UI
    // omits this optional field.
    if (
      !Object.prototype.hasOwnProperty.call(
        req.body,
        "hsn_sac_code"
      )
    ) {
      payload.hsn_sac_code = existingTax.hsn_sac_code;
    }

    const validationError = validateTaxPayload(payload);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const duplicateError = await checkDuplicateTax({
      companyId: company_id,
      taxName: payload.tax_name,
      excludeTaxId: id,
    });

    if (duplicateError) {
      return res.status(409).json({
        message: duplicateError,
      });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_taxes
      SET
        tax_name = ?,
        tax_type = ?,
        hsn_sac_code = ?,
        tax_percentage = ?,
        cgst_percentage = ?,
        sgst_percentage = ?,
        igst_percentage = ?,
        tds_percentage = ?,
        tcs_percentage = ?,
        reverse_charge = ?,
        is_active = ?,
        description = ?
      WHERE id = ? AND company_id = ?
      `,
      [
        payload.tax_name,
        payload.tax_type,
        payload.hsn_sac_code,
        payload.tax_percentage,
        payload.cgst_percentage,
        payload.sgst_percentage,
        payload.igst_percentage,
        payload.tds_percentage,
        payload.tcs_percentage,
        payload.reverse_charge,
        payload.is_active,
        payload.description,
        id,
        company_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Tax not found",
      });
    }

    const tax = await getTaxById(id, company_id);

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Tax",
      record_id: id,
      description: `Tax ${payload.tax_name} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Tax updated successfully",
      tax,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update tax error",
      error: error.message,
    });
  }
};

/* =========================================
   DELETE / DEACTIVATE TAX
========================================= */

export const deleteTax = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid tax id is required",
      });
    }

    const tax = await getTaxById(id, company_id);

    if (!tax) {
      return res.status(404).json({
        message: "Tax not found",
      });
    }

    if (Number(tax.is_active) === 0) {
      return res.status(400).json({
        message: "Tax already inactive",
      });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_taxes
      SET is_active = 0
      WHERE id = ? AND company_id = ?
      `,
      [id, company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Tax not found",
      });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "DEACTIVATE",
      module_name: "Tax",
      record_id: id,
      description: `Tax ${tax.tax_name} deactivated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Tax deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete tax error",
      error: error.message,
    });
  }
};
 