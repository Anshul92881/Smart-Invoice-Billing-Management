import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";
import {
  sendCompanyEmail,
  verifyCompanySmtp,
} from "../utils/companyEmailServices.js";

const ALLOWED_COMPANY_STATUS = ["active", "inactive", "suspended"];
const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
const ALLOWED_FISCAL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ALLOWED_ROLE_KEYS = ["accountant", "sales_user"];

const ALLOWED_PERMISSION_KEYS = [
  "branches",
  "customers",
  "products",
  "vendors",
  "quotations",
  "invoices",
  "payments",
  "expenses",
  "taxes",
  "reports",
  "audit_logs",
  "users",
  "billing",
];

const BILLING_TEMPLATE_ALLOWED_KEYS = [
  "show_logo",
  "show_company_gst_pan",
  "show_branch_details",
  "show_customer_gstin",
  "show_hsn_sac",
  "show_item_description",
  "show_tax_breakdown",
  "show_terms",
  "show_notes",
  "show_bank_details",
  "show_signature",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
const CRM_API_KEY_REGEX = /^[a-fA-F0-9]{64}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const WEBSITE_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/;
const ZIP_REGEX = /^\d{5,6}$/;
const PREFIX_REGEX = /^[A-Z0-9-]{1,10}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;
const ACCOUNT_NUMBER_REGEX = /^[0-9]{6,20}$/;
const TIMEZONE_REGEX = /^[A-Za-z_]+\/[A-Za-z0-9_+\-/]+$/;
const SMTP_HOST_REGEX =
  /^(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|localhost|\d{1,3}(\.\d{1,3}){3})$/;

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

const isValidEmail = (email) =>
  !email || EMAIL_REGEX.test(normalizeText(email));

const isValidIndianPhone = (phone) =>
  !phone || INDIAN_PHONE_REGEX.test(normalizeText(phone));

const isValidGST = (gst) => !gst || GST_REGEX.test(normalizeUpper(gst));

const isValidPAN = (pan) => !pan || PAN_REGEX.test(normalizeUpper(pan));

const isValidWebsite = (website) =>
  !website || WEBSITE_REGEX.test(normalizeText(website));

const isValidZip = (zip) => !zip || ZIP_REGEX.test(normalizeText(zip));

const isValidPrefix = (prefix) =>
  !prefix || PREFIX_REGEX.test(normalizeUpper(prefix));

const isValidIFSC = (ifsc) => !ifsc || IFSC_REGEX.test(normalizeUpper(ifsc));

const isValidUPI = (upi) => !upi || UPI_REGEX.test(normalizeText(upi));

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
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

const normalizeCompanyStatus = (status, fallback = "active") => {
  const normalizedStatus = normalizeText(status).toLowerCase();
  return normalizedStatus || fallback;
};

const validateCompanyPayload = ({
  name,
  gst_number,
  currency,
  email,
  phone,
  pan_number,
  website,
  zip_code,
  status,
}) => {
  const companyName = normalizeText(name);
  const normalizedCurrency = normalizeUpper(currency) || "INR";
  const normalizedStatus = normalizeCompanyStatus(status);

  if (!companyName) return "Company name is required";

  if (companyName.length < 3 || companyName.length > 100) {
    return "Company name must be between 3 and 100 characters";
  }

  if (!/^[a-zA-Z0-9\s.&'()-]+$/.test(companyName)) {
    return "Company name contains invalid characters";
  }

  if (email && !isValidEmail(email)) return "Invalid company email format";

  if (phone && !isValidIndianPhone(phone)) {
    return "Phone must be a valid 10 digit Indian mobile number";
  }

  if (gst_number && !isValidGST(gst_number)) {
    return "Invalid GST number format";
  }

  if (pan_number && !isValidPAN(pan_number)) {
    return "Invalid PAN number format";
  }

  if (website && !isValidWebsite(website)) {
    return "Invalid website URL";
  }

  if (zip_code && !isValidZip(zip_code)) {
    return "ZIP code must be 5 to 6 digits";
  }

  if (!ALLOWED_CURRENCIES.includes(normalizedCurrency)) {
    return `Currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`;
  }

  if (!ALLOWED_COMPANY_STATUS.includes(normalizedStatus)) {
    return `Status must be one of: ${ALLOWED_COMPANY_STATUS.join(", ")}`;
  }

  return null;
};

const validateCompanySettingsPayload = ({
  invoice_prefix,
  invoice_start_number,
  quotation_prefix,
  currency,
  timezone,
  fiscal_year_start,
  bank_name,
  account_holder_name,
  account_number,
  ifsc_code,
  upi_id,
}) => {
  const normalizedCurrency = normalizeUpper(currency) || "INR";
  const normalizedFiscalYearStart = normalizeText(fiscal_year_start) || "April";
  const normalizedTimezone = normalizeText(timezone) || "Asia/Kolkata";

  if (invoice_prefix && !isValidPrefix(invoice_prefix)) {
    return "Invoice prefix must be 1-10 characters and contain only letters, numbers or hyphen";
  }

  if (quotation_prefix && !isValidPrefix(quotation_prefix)) {
    return "Quotation prefix must be 1-10 characters and contain only letters, numbers or hyphen";
  }

  if (
    invoice_start_number !== undefined &&
    invoice_start_number !== null &&
    invoice_start_number !== "" &&
    !isPositiveInteger(invoice_start_number)
  ) {
    return "Invoice start number must be a positive integer";
  }

  if (!ALLOWED_CURRENCIES.includes(normalizedCurrency)) {
    return `Currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`;
  }

  if (!TIMEZONE_REGEX.test(normalizedTimezone)) {
    return "Invalid timezone format";
  }

  if (!ALLOWED_FISCAL_MONTHS.includes(normalizedFiscalYearStart)) {
    return "Invalid fiscal year start month";
  }

  if (bank_name && normalizeText(bank_name).length > 100) {
    return "Bank name must be less than 100 characters";
  }

  if (account_holder_name && normalizeText(account_holder_name).length > 100) {
    return "Account holder name must be less than 100 characters";
  }

  if (
    account_number &&
    !ACCOUNT_NUMBER_REGEX.test(normalizeText(account_number))
  ) {
    return "Account number must be 6 to 20 digits";
  }

  if (ifsc_code && !isValidIFSC(ifsc_code)) {
    return "Invalid IFSC code";
  }

  if (upi_id && !isValidUPI(upi_id)) {
    return "Invalid UPI ID";
  }

  return null;
};

const normalizeRolePermissions = (permissions) => {
  const cleanedPermissions = {};

  for (const roleKey of ALLOWED_ROLE_KEYS) {
    const rolePermissions = permissions?.[roleKey];

    if (!rolePermissions || typeof rolePermissions !== "object") {
      cleanedPermissions[roleKey] = {};
      continue;
    }

    cleanedPermissions[roleKey] = {};

    for (const key of ALLOWED_PERMISSION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(rolePermissions, key)) {
        cleanedPermissions[roleKey][key] = Boolean(rolePermissions[key]);
      }
    }
  }

  return cleanedPermissions;
};

const DEFAULT_BILLING_TEMPLATE = {
  show_logo: true,
  show_company_gst_pan: true,
  show_branch_details: true,
  show_customer_gstin: true,
  show_hsn_sac: true,
  show_item_description: true,
  show_tax_breakdown: true,
  show_terms: true,
  show_notes: true,
  show_bank_details: true,
  show_signature: true,
};

const normalizeBillingTemplate = (billingTemplate = {}) => {
  const cleanedTemplate = { ...DEFAULT_BILLING_TEMPLATE };

  for (const key of BILLING_TEMPLATE_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(billingTemplate, key)) {
      cleanedTemplate[key] = Boolean(billingTemplate[key]);
    }
  }

  return cleanedTemplate;
};

const escapeHtml = (value) => {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// CREATE COMPANY - SuperAdmin
export const createCompany = async (req, res) => {
  try {
    const {
      name,
      gst_number,
      address,
      currency,
      email,
      phone,
      pan_number,
      website,
      state,
      country,
      zip_code,
    } = req.body;

    const validationError = validateCompanyPayload({
      ...req.body,
      status: "inactive",
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const normalizedName = normalizeText(name);
    const normalizedEmail = normalizeEmail(email) || null;
    const normalizedGST = normalizeUpper(gst_number) || null;
    const normalizedPAN = normalizeUpper(pan_number) || null;

    const [duplicateRows] = await db.query(
      `
      SELECT id, email, gst_number, pan_number, name
      FROM tbl_companies
      WHERE LOWER(name) = ?
      OR (? IS NOT NULL AND LOWER(email) = ?)
      OR (? IS NOT NULL AND gst_number = ?)
      OR (? IS NOT NULL AND pan_number = ?)
      LIMIT 1
      `,
      [
        normalizedName.toLowerCase(),
        normalizedEmail,
        normalizedEmail,
        normalizedGST,
        normalizedGST,
        normalizedPAN,
        normalizedPAN,
      ],
    );

    if (duplicateRows.length > 0) {
      const duplicate = duplicateRows[0];

      if (duplicate.name?.toLowerCase() === normalizedName.toLowerCase()) {
        return res.status(400).json({ message: "Company name already exists" });
      }

      if (
        normalizedEmail &&
        duplicate.email?.toLowerCase() === normalizedEmail
      ) {
        return res
          .status(400)
          .json({ message: "Company email already exists" });
      }

      if (normalizedGST && duplicate.gst_number === normalizedGST) {
        return res.status(400).json({ message: "GST number already exists" });
      }

      if (normalizedPAN && duplicate.pan_number === normalizedPAN) {
        return res.status(400).json({ message: "PAN number already exists" });
      }
    }

    const [companyResult] = await db.query(
      `
      INSERT INTO tbl_companies
      (
        name,
        gst_number,
        address,
        currency,
        email,
        phone,
        pan_number,
        website,
        state,
        country,
        zip_code,
        status,
        kyc_status,
        kyc_attempts,
        last_activity_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inactive', 'pending', 0, NOW())
      `,
      [
        normalizedName,
        normalizedGST,
        normalizeNullable(address),
        normalizeUpper(currency) || "INR",
        normalizedEmail,
        normalizeNullable(phone),
        normalizedPAN,
        normalizeNullable(website),
        normalizeNullable(state),
        normalizeText(country) || "India",
        normalizeNullable(zip_code),
      ],
    );

    await createAuditLog({
      company_id: companyResult.insertId,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Company",
      record_id: companyResult.insertId,
      description: `Company ${normalizedName} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.status(201).json({
      message: "Company created successfully",
      company_id: companyResult.insertId,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create company error",
      error: error.message,
    });
  }
};

// GET ALL COMPANIES - SuperAdmin
export const getCompanies = async (req, res) => {
  try {
    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (status !== "all" && !ALLOWED_COMPANY_STATUS.includes(status)) {
      return res.status(400).json({
        message: `Status must be all or one of: ${ALLOWED_COMPANY_STATUS.join(
          ", ",
        )}`,
      });
    }

    let whereClause = "WHERE 1=1";
    const params = [];

    if (search) {
      whereClause += `
        AND (
          name LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
          OR gst_number LIKE ?
          OR pan_number LIKE ?
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
      );
    }

    if (status !== "all") {
      whereClause += " AND status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_companies
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [companies] = await db.query(
      `
  SELECT
    id,
    name,
    gst_number,
    address,
    currency,
    status,
    email,
    phone,
    pan_number,
    website,
    state,
    country,
    zip_code,
    logo,
    kyc_status,

    CASE
      WHEN crm_api_key IS NOT NULL
        AND TRIM(crm_api_key) != ''
      THEN 1
      ELSE 0
    END AS crm_api_key_configured

  FROM tbl_companies
  ${whereClause}
  ORDER BY id DESC
  LIMIT ? OFFSET ?
  `,
      [...params, limit, offset],
    );

    return res.json({
      companies,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get companies error",
      error: error.message,
    });
  }
};

// GET MY COMPANY - Company Admin
export const getMyCompany = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const [companies] = await db.query(
      `
  SELECT
    id,
    name,
    gst_number,
    address,
    currency,
    status,
    email,
    phone,
    pan_number,
    website,
    state,
    country,
    zip_code,
    logo,
    kyc_status,
    kyc_attempts,
    last_activity_at
  FROM tbl_companies
  WHERE id = ?
  LIMIT 1
  `,
      [companyId],
    );

    if (companies.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    return res.json(companies[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Get company profile error",
      error: error.message,
    });
  }
};

// UPDATE COMPANY
export const updateCompany = async (req, res) => {
  try {
    let companyId = req.params.id;

    if (req.user.role === "company_admin") {
      companyId = req.user.company_id;
    }

    if (!companyId || !isPositiveInteger(companyId)) {
      return res.status(400).json({
        message: "Valid company id is required",
      });
    }

    const {
      name,
      gst_number,
      address,
      currency,
      status,
      email,
      phone,
      pan_number,
      website,
      state,
      country,
      zip_code,
    } = req.body;

    const crmApiKey =
      req.user.role === "superadmin"
        ? String(req.body.crm_api_key || "").trim()
        : "";

    const validationError = validateCompanyPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (
      req.user.role === "superadmin" &&
      crmApiKey &&
      !CRM_API_KEY_REGEX.test(crmApiKey)
    ) {
      return res.status(400).json({
        message: "CRM API key must be a valid 64-character hexadecimal key",
      });
    }

    const normalizedName = normalizeText(name);
    const normalizedEmail = normalizeEmail(email) || null;
    const normalizedGST = normalizeUpper(gst_number) || null;
    const normalizedPAN = normalizeUpper(pan_number) || null;
    const normalizedStatus = normalizeCompanyStatus(status);

    const [companyRows] = await db.query(
      `
      SELECT id, kyc_status
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    const [duplicateRows] = await db.query(
      `
      SELECT id, email, gst_number, pan_number, name
      FROM tbl_companies
      WHERE id != ?
      AND (
        LOWER(name) = ?
        OR (? IS NOT NULL AND LOWER(email) = ?)
        OR (? IS NOT NULL AND gst_number = ?)
        OR (? IS NOT NULL AND pan_number = ?)
      )
      LIMIT 1
      `,
      [
        companyId,
        normalizedName.toLowerCase(),
        normalizedEmail,
        normalizedEmail,
        normalizedGST,
        normalizedGST,
        normalizedPAN,
        normalizedPAN,
      ],
    );

    if (duplicateRows.length > 0) {
      const duplicate = duplicateRows[0];

      if (duplicate.name?.toLowerCase() === normalizedName.toLowerCase()) {
        return res.status(400).json({ message: "Company name already exists" });
      }

      if (
        normalizedEmail &&
        duplicate.email?.toLowerCase() === normalizedEmail
      ) {
        return res
          .status(400)
          .json({ message: "Company email already exists" });
      }

      if (normalizedGST && duplicate.gst_number === normalizedGST) {
        return res.status(400).json({ message: "GST number already exists" });
      }

      if (normalizedPAN && duplicate.pan_number === normalizedPAN) {
        return res.status(400).json({ message: "PAN number already exists" });
      }
    }

    const currentKycStatus = companyRows[0].kyc_status;

    if (
      normalizedStatus === "active" &&
      !["approved", "manual_verified"].includes(currentKycStatus)
    ) {
      return res.status(400).json({
        message:
          "Company KYC is pending. Please approve or manually verify KYC before activating.",
      });
    }

    const shouldUpdateCrmKey =
      req.user.role === "superadmin" && Boolean(crmApiKey);

    const [result] = await db.query(
      `
      UPDATE tbl_companies
      SET
        name = ?,
        gst_number = ?,
        address = ?,
        currency = ?,
        status = ?,
        email = ?,
        phone = ?,
        pan_number = ?,
        website = ?,
        state = ?,
        country = ?,
        zip_code = ?,
        crm_api_key = CASE
      WHEN ? = 1 THEN ?
      ELSE crm_api_key
    END
      WHERE id = ?
      `,
      [
        normalizedName,
        normalizedGST,
        normalizeNullable(address),
        normalizeUpper(currency) || "INR",
        normalizedStatus,
        normalizedEmail,
        normalizeNullable(phone),
        normalizedPAN,
        normalizeNullable(website),
        normalizeNullable(state),
        normalizeText(country) || "India",
        normalizeNullable(zip_code),
        shouldUpdateCrmKey ? 1 : 0,
        shouldUpdateCrmKey ? crmApiKey : null,
        companyId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Company",
      record_id: companyId,
      description: `Company ${normalizedName} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Company updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update company error",
      error: error.message,
    });
  }
};

// DELETE / DEACTIVATE COMPANY - SuperAdmin
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid company id is required",
      });
    }

    const [companyRows] = await db.query(
      `
      SELECT id, name, status
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    if (companyRows[0].status === "inactive") {
      return res.status(400).json({
        message: "Company already inactive",
      });
    }

    await db.query(
      `
      UPDATE tbl_companies
      SET status = 'inactive'
      WHERE id = ?
      `,
      [id],
    );

    await createAuditLog({
      company_id: id,
      user_id: req.user.id,
      role: req.user.role,
      action: "DELETE",
      module_name: "Company",
      record_id: id,
      description: `Company ${companyRows[0].name} deactivated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Company deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete company error",
      error: error.message,
    });
  }
};

// GET COMPANY SETTINGS - Company Admin
export const getCompanySettings = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        currency,
        invoice_prefix,
        invoice_start_number,
        quotation_prefix,
        timezone,
        fiscal_year_start,
        bank_name,
        account_holder_name,
        account_number,
        ifsc_code,
        upi_id,
        invoice_terms,
        payment_instructions,
        authorized_signatory_name
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Company settings not found",
      });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Get company settings error",
      error: error.message,
    });
  }
};

// UPDATE COMPANY SETTINGS - Company Admin
export const updateCompanySettings = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const {
      invoice_prefix,
      invoice_start_number,
      quotation_prefix,
      currency,
      timezone,
      fiscal_year_start,
      bank_name,
      account_holder_name,
      account_number,
      ifsc_code,
      upi_id,
      invoice_terms,
      payment_instructions,
      authorized_signatory_name,
    } = req.body;

    const validationError = validateCompanySettingsPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_companies
      SET
        invoice_prefix = ?,
        invoice_start_number = ?,
        quotation_prefix = ?,
        currency = ?,
        timezone = ?,
        fiscal_year_start = ?,
        bank_name = ?,
        account_holder_name = ?,
        account_number = ?,
        ifsc_code = ?,
        upi_id = ?,
        invoice_terms = ?,
        payment_instructions = ?,
        authorized_signatory_name = ?
      WHERE id = ?
      `,
      [
        normalizeUpper(invoice_prefix) || "INV",
        Number(invoice_start_number || 1),
        normalizeUpper(quotation_prefix) || "QT",
        normalizeUpper(currency) || "INR",
        normalizeText(timezone) || "Asia/Kolkata",
        normalizeText(fiscal_year_start) || "April",
        normalizeNullable(bank_name),
        normalizeNullable(account_holder_name),
        normalizeNullable(account_number),
        normalizeUpper(ifsc_code) || null,
        normalizeNullable(upi_id),
        normalizeNullable(invoice_terms),
        normalizeNullable(payment_instructions),
        normalizeNullable(authorized_signatory_name),
        companyId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Company settings not found",
      });
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Company_Settings",
      record_id: companyId,
      description: "Company settings updated",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Company settings updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update company settings error",
      error: error.message,
    });
  }
};

export const uploadCompanyLogo = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Logo file is required" });
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: "Only JPG, PNG or WEBP logo files are allowed",
      });
    }

    const maxSize = 2 * 1024 * 1024;

    if (req.file.size > maxSize) {
      return res.status(400).json({
        message: "Logo size must be less than 2MB",
      });
    }

    const logoName = req.file.filename;

    const [result] = await db.query(
      `
      UPDATE tbl_companies
      SET logo = ?
      WHERE id = ?
      `,
      [logoName, companyId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Company",
      record_id: companyId,
      description: "Company logo updated",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Company logo uploaded successfully",
      logo: logoName,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Logo upload failed",
      error: error.message,
    });
  }
};

export const getInactiveCompanies = async (req, res) => {
  try {
    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;

    const bucket = normalizeText(req.query.bucket).toLowerCase() || "all";
    const search = normalizeText(req.query.search);

    const allowedBuckets = ["all", "never", "warning", "inactive"];

    if (!allowedBuckets.includes(bucket)) {
      return res.status(400).json({
        message: `Bucket must be one of: ${allowedBuckets.join(", ")}`,
      });
    }

    let whereClause = "WHERE 1=1";
    const params = [];

    if (search) {
      whereClause += `
        AND (
          name LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
        )
      `;

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (bucket === "never") {
      whereClause += " AND last_activity_at IS NULL";
    }

    if (bucket === "warning") {
      whereClause += `
        AND last_activity_at IS NOT NULL
        AND last_activity_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND last_activity_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)
      `;
    }

    if (bucket === "inactive") {
      whereClause += `
        AND (
          last_activity_at IS NULL
          OR last_activity_at < DATE_SUB(NOW(), INTERVAL 180 DAY)
        )
      `;
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_companies
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [companies] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        phone,
        status,
        last_activity_at,
        CASE
          WHEN last_activity_at IS NULL THEN 'never_active'
          WHEN last_activity_at < DATE_SUB(NOW(), INTERVAL 180 DAY) THEN 'inactive'
          WHEN last_activity_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'warning'
          ELSE 'active'
        END AS inactivity_status,
        CASE
          WHEN last_activity_at IS NULL THEN NULL
          ELSE DATEDIFF(NOW(), last_activity_at)
        END AS inactive_days
      FROM tbl_companies
      ${whereClause}
      ORDER BY
        CASE
          WHEN last_activity_at IS NULL THEN 9999
          ELSE DATEDIFF(NOW(), last_activity_at)
        END DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      companies,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get inactive companies error",
      error: error.message,
    });
  }
};

// GET ROLE PERMISSIONS
export const getRolePermissions = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const [rows] = await db.query(
      `
      SELECT role_permissions
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    return res.json({
      permissions: parseJson(rows[0].role_permissions),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get role permissions error",
      error: error.message,
    });
  }
};

// UPDATE ROLE PERMISSIONS
export const updateRolePermissions = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { permissions } = req.body;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    if (
      !permissions ||
      typeof permissions !== "object" ||
      Array.isArray(permissions)
    ) {
      return res.status(400).json({
        message: "Permissions object is required",
      });
    }

    const cleanedPermissions = normalizeRolePermissions(permissions);

    const [result] = await db.query(
      `
      UPDATE tbl_companies
      SET role_permissions = ?
      WHERE id = ?
      `,
      [JSON.stringify(cleanedPermissions), companyId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Role Permissions",
      record_id: companyId,
      description: "Role permissions updated",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Role permissions updated successfully",
      permissions: cleanedPermissions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update role permissions error",
      error: error.message,
    });
  }
};

export const getBillingTemplate = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const [rows] = await db.query(
      `
      SELECT billing_template
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }
    return res.json({
      billing_template: normalizeBillingTemplate(
        parseJson(rows[0].billing_template),
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get billing template error",
      error: error.message,
    });
  }
};

export const updateBillingTemplate = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { billing_template } = req.body;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    if (
      !billing_template ||
      typeof billing_template !== "object" ||
      Array.isArray(billing_template)
    ) {
      return res.status(400).json({
        message: "Billing template object is required",
      });
    }

    const cleanedTemplate = normalizeBillingTemplate(billing_template);

    const [result] = await db.query(
      `
      UPDATE tbl_companies
      SET billing_template = ?
      WHERE id = ?
      `,
      [JSON.stringify(cleanedTemplate), companyId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Billing_Template",
      record_id: companyId,
      description: "Billing template updated",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Billing template updated successfully",
      billing_template: cleanedTemplate,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update billing template error",
      error: error.message,
    });
  }
};

export const getEmailSettings = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_secure,
        from_email,
        from_name,
        reply_to
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Get email settings error",
      error: error.message,
    });
  }
};

export const updateEmailSettings = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_secure,
      from_email,
      from_name,
      reply_to,
    } = req.body;

    const normalizedSmtpHost = normalizeText(smtp_host);
    const normalizedSmtpPort = Number(smtp_port);
    const normalizedSmtpUser = normalizeText(smtp_user);
    const normalizedFromEmail = normalizeEmail(from_email);
    const normalizedReplyTo = normalizeEmail(reply_to);
    const normalizedFromName = normalizeText(from_name);

    if (!normalizedSmtpHost) {
      return res.status(400).json({ message: "SMTP host is required" });
    }

    if (!SMTP_HOST_REGEX.test(normalizedSmtpHost)) {
      return res.status(400).json({ message: "Invalid SMTP host" });
    }

    if (
      !Number.isInteger(normalizedSmtpPort) ||
      normalizedSmtpPort < 1 ||
      normalizedSmtpPort > 65535
    ) {
      return res
        .status(400)
        .json({ message: "SMTP port must be between 1 and 65535" });
    }

    if (!normalizedSmtpUser) {
      return res.status(400).json({ message: "SMTP user is required" });
    }

    if (normalizedFromEmail && !isValidEmail(normalizedFromEmail)) {
      return res.status(400).json({ message: "Invalid from email format" });
    }

    if (normalizedReplyTo && !isValidEmail(normalizedReplyTo)) {
      return res.status(400).json({ message: "Invalid reply-to email format" });
    }

    if (normalizedFromName && normalizedFromName.length > 100) {
      return res
        .status(400)
        .json({ message: "From name must be less than 100 characters" });
    }

    const [companyRows] = await db.query(
      `
      SELECT smtp_pass
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const existingPass = companyRows[0].smtp_pass;

    const finalPassword =
      smtp_pass && String(smtp_pass).trim()
        ? String(smtp_pass).trim()
        : existingPass;

    if (!finalPassword) {
      return res.status(400).json({ message: "SMTP password is required" });
    }

    const testCompany = {
      id: companyId,
      smtp_host: normalizedSmtpHost,
      smtp_port: normalizedSmtpPort,
      smtp_user: normalizedSmtpUser,
      smtp_pass: finalPassword,
      smtp_secure: Boolean(smtp_secure),
      from_email: normalizedFromEmail || null,
      from_name: normalizedFromName || null,
      reply_to: normalizedReplyTo || null,
    };

    await verifyCompanySmtp(testCompany);

    await db.query(
      `
      UPDATE tbl_companies
      SET
        smtp_host = ?,
        smtp_port = ?,
        smtp_user = ?,
        smtp_pass = ?,
        smtp_secure = ?,
        from_email = ?,
        from_name = ?,
        reply_to = ?
      WHERE id = ?
      `,
      [
        normalizedSmtpHost,
        normalizedSmtpPort,
        normalizedSmtpUser,
        finalPassword,
        smtp_secure ? 1 : 0,
        normalizedFromEmail || null,
        normalizedFromName || null,
        normalizedReplyTo || null,
        companyId,
      ],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Email_Settings",
      record_id: companyId,
      description: "Company email settings updated",
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Email settings saved and SMTP verified successfully",
    });
  } catch (error) {
    console.error("Update email settings error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    return res.status(400).json({
      message:
        error.response ||
        error.message ||
        "SMTP verification failed. Please check email settings.",
    });
  }
};

export const sendTestEmail = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const testEmail = normalizeEmail(req.body.test_email);

    if (!companyId) {
      return res.status(400).json({
        message: "Company id not found in token",
      });
    }

    if (!testEmail) {
      return res.status(400).json({ message: "Test email is required" });
    }

    if (!isValidEmail(testEmail)) {
      return res.status(400).json({ message: "Invalid test email format" });
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_secure,
        from_email,
        from_name,
        reply_to
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const company = rows[0];

    if (
      !company.smtp_host ||
      !company.smtp_port ||
      !company.smtp_user ||
      !company.smtp_pass
    ) {
      return res.status(400).json({
        message: "Please save valid SMTP settings before sending a test email",
      });
    }

    const safeCompanyName = escapeHtml(company.name);

    await sendCompanyEmail({
      company,
      to: testEmail,
      subject: `Test Email from ${company.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Email Configuration Successful</h2>
          <p>Hello,</p>
          <p>This is a test email from <strong>${safeCompanyName}</strong>.</p>
          <p>Your SMTP email configuration is working correctly.</p>
          <br />
          <p>Regards,<br />${safeCompanyName}</p>
        </div>
      `,
      text: `Email configuration successful for ${company.name}`,
      module_type: "test",
      reference_id: null,
    });

    return res.json({
      message: "Test email sent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Test email failed",
      error: error.message,
    });
  }
};
