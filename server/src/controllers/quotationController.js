import db from "../config/db.js";
import { sendCompanyEmail } from "../utils/companyEmailServices.js";
import { createAuditLog } from "../utils/auditLogger.js";
import { notifyBusinessUsers } from "../utils/notificationLoggers.js";
import { emitDashboardUpdate } from "../utils/socketEvents.js";
import {
  syncCustomerToCrm,
  syncDocumentToCrm,
} from "../utils/crmIntegrationService.js";
import {
  buildDocumentSnapshot,
  parseJsonSafe,
  saveDocumentPDFToServer,
  getSavedDocumentPDFBuffer,
} from "../utils/documentEngine.js";

const ALLOWED_QUOTATION_STATUS = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
  "cancelled",
];

const HSN_SAC_REGEX = /^[0-9]{4,8}$/;
const ITEM_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),/_-]+$/;

const formatStatus = (status) => String(status || "").replace("_", " ");

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

const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
};

const isValidDateString = (value) => {
  if (!value) return true;

  const text = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const date = new Date(`${text}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
};

const validateBranch = async (connection, branchId, companyId) => {
  if (!branchId || !isPositiveInteger(branchId)) return null;

  const [rows] = await connection.query(
    `
    SELECT id, branch_name
    FROM tbl_company_branches
    WHERE id = ?
    AND company_id = ?
    AND status = 'active'
    LIMIT 1
    `,
    [branchId, companyId],
  );

  return rows[0] || null;
};

const getMainBranchId = async (connection, companyId) => {
  const [rows] = await connection.query(
    `
    SELECT id
    FROM tbl_company_branches
    WHERE company_id = ?
    AND is_main = 1
    AND status = 'active'
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0]?.id || null;
};

const getQuotationPrefix = async (connection, companyId) => {
  const [rows] = await connection.query(
    `
    SELECT quotation_prefix
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0]?.quotation_prefix || "QT";
};

const getInvoiceNumberConfig = async (connection, companyId) => {
  const [rows] = await connection.query(
    `
    SELECT invoice_prefix, invoice_start_number
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0] || {};
};

const getBranchCondition = () => {
  return { clause: "", params: [] };
};

const flattenQuotationSnapshot = (quotation = {}) => {
  const snapshot = parseJsonSafe(
    quotation.billing_template_snapshot || quotation.company_billing_template,
  );

  if (
    snapshot.template ||
    snapshot.company ||
    snapshot.branch ||
    snapshot.bank
  ) {
    return {
      ...quotation,
      billing_template_snapshot: JSON.stringify(snapshot),

      business_name: snapshot.company?.name || quotation.business_name,
      business_address: snapshot.company?.address || quotation.business_address,
      business_email: snapshot.company?.email || quotation.business_email,
      business_phone: snapshot.company?.phone || quotation.business_phone,
      business_gst_number:
        snapshot.company?.gst_number || quotation.business_gst_number,
      business_pan_number:
        snapshot.company?.pan_number || quotation.business_pan_number,
      business_logo: snapshot.company?.logo || quotation.business_logo,

      branch_name: snapshot.branch?.branch_name || quotation.branch_name,
      branch_code: snapshot.branch?.branch_code || quotation.branch_code,
    };
  }

  return {
    ...quotation,
    billing_template_snapshot:
      quotation.billing_template_snapshot ||
      quotation.company_billing_template ||
      null,
  };
};

const getQuotationDocumentData = async (quotationId, companyId) => {
  const [quotationRows] = await db.query(
    `
    SELECT
      q.*,

      c.customer_name,
      c.company_name,
      c.email,
      c.phone,
      c.billing_address,
      c.shipping_address,
      c.gstin,

      b.branch_name,
      b.branch_code,

      comp.name AS business_name,
      comp.address AS business_address,
      comp.email AS business_email,
      comp.phone AS business_phone,
      comp.gst_number AS business_gst_number,
      comp.pan_number AS business_pan_number,
      comp.logo AS business_logo,
      comp.billing_template AS company_billing_template

    FROM tbl_quotations q
    LEFT JOIN tbl_customers c
      ON q.customer_id = c.id
      AND c.company_id = q.company_id
    LEFT JOIN tbl_company_branches b
      ON q.branch_id = b.id
      AND b.company_id = q.company_id
    LEFT JOIN tbl_companies comp
      ON q.company_id = comp.id
    WHERE q.id = ?
    AND q.company_id = ?
    LIMIT 1
    `,
    [quotationId, companyId],
  );

  if (quotationRows.length === 0) return null;

  const [items] = await db.query(
    `
    SELECT
      qi.*,
      p.product_name,
      p.description AS product_description,
      p.hsn_sac_code AS product_hsn_sac_code
    FROM tbl_quotation_items qi
    LEFT JOIN tbl_products p
      ON qi.product_id = p.id
    WHERE qi.quotation_id = ?
    ORDER BY qi.id ASC
    `,
    [quotationId],
  );

  return {
    quotation: flattenQuotationSnapshot(quotationRows[0]),
    items,
  };
};

const validateQuotationBasePayload = ({
  customer_id,
  quotation_date,
  expiry_date,
  discount_amount,
  notes,
  terms_conditions,
  items,
}) => {
  if (!customer_id || !isPositiveInteger(customer_id)) {
    return "Valid customer is required";
  }

  if (!isValidDateString(quotation_date)) {
    return "Quotation date must be a valid YYYY-MM-DD date";
  }

  if (!isValidDateString(expiry_date)) {
    return "Expiry date must be a valid YYYY-MM-DD date";
  }

  if (quotation_date && expiry_date) {
    const qDate = new Date(`${quotation_date}T00:00:00.000Z`);
    const eDate = new Date(`${expiry_date}T00:00:00.000Z`);

    if (eDate < qDate) {
      return "Expiry date cannot be before quotation date";
    }
  }

  const discount = toNumber(discount_amount);

  if (Number.isNaN(discount)) {
    return "Discount amount must be a valid number";
  }

  if (discount < 0) {
    return "Discount amount cannot be negative";
  }

  if (notes && normalizeText(notes).length > 1000) {
    return "Notes must be less than 1000 characters";
  }

  if (terms_conditions && normalizeText(terms_conditions).length > 1500) {
    return "Terms and conditions must be less than 1500 characters";
  }

  if (!Array.isArray(items) || items.length === 0) {
    return "At least one item is required";
  }

  if (items.length > 100) {
    return "Quotation cannot have more than 100 items";
  }

  return null;
};

const validateCalculatedItem = (item, index) => {
  const row = index + 1;

  if (!item.item_name) {
    return `Item name is required at row ${row}`;
  }

  if (item.item_name.length < 2 || item.item_name.length > 150) {
    return `Item name must be between 2 and 150 characters at row ${row}`;
  }

  if (!ITEM_NAME_REGEX.test(item.item_name)) {
    return `Item name contains invalid characters at row ${row}`;
  }

  if (item.description && item.description.length > 500) {
    return `Description must be less than 500 characters at row ${row}`;
  }

  if (item.hsn_sac_code && !HSN_SAC_REGEX.test(item.hsn_sac_code)) {
    return `HSN/SAC code must be 4 to 8 digits at row ${row}`;
  }

  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    return `Item quantity must be greater than 0 at row ${row}`;
  }

  if (!Number.isFinite(item.price) || item.price < 0) {
    return `Item price cannot be negative at row ${row}`;
  }

  if (
    !Number.isFinite(item.tax_rate) ||
    item.tax_rate < 0 ||
    item.tax_rate > 100
  ) {
    return `Tax rate must be between 0 and 100 at row ${row}`;
  }

  return null;
};

const buildCalculatedItems = async (connection, items, companyId) => {
  let subtotal = 0;
  let taxAmount = 0;
  const calculatedItems = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    const quantity = toNumber(item.quantity, NaN);
    const price = toNumber(item.price ?? item.rate, NaN);
    let taxRate = toNumber(item.tax_rate, 0);

    let itemName = normalizeText(item.item_name || item.product_name);
    let description = normalizeNullable(item.description);
    let hsnSacCode = normalizeUpper(item.hsn_sac_code) || null;
    const productId = item.product_id ? Number(item.product_id) : null;

    if (productId) {
      if (!isPositiveInteger(productId)) {
        return {
          error: `Valid product is required at row ${index + 1}`,
        };
      }

      const [productRows] = await connection.query(
        `
        SELECT
          id,
          product_name,
          description,
          tax_rate,
          hsn_sac_code
        FROM tbl_products
        WHERE id = ?
        AND company_id = ?
        AND status = 'active'
        LIMIT 1
        `,
        [productId, companyId],
      );

      if (productRows.length === 0) {
        return {
          error: `Product must be active and belong to the same company at row ${
            index + 1
          }`,
        };
      }

      const product = productRows[0];

      itemName = itemName || product.product_name;
      description = description || product.description || null;
      hsnSacCode = hsnSacCode || product.hsn_sac_code || null;

      taxRate =
        item.tax_rate !== undefined && item.tax_rate !== ""
          ? toNumber(item.tax_rate, NaN)
          : toNumber(product.tax_rate, 0);
    }

    const baseAmount = quantity * price;
    const itemTaxAmount = (baseAmount * taxRate) / 100;
    const lineTotal = baseAmount + itemTaxAmount;

    const calculatedItem = {
      product_id: productId,
      item_name: itemName,
      description,
      hsn_sac_code: hsnSacCode,
      quantity,
      price,
      tax_rate: taxRate,
      tax_amount: itemTaxAmount,
      line_total: lineTotal,
    };

    const itemError = validateCalculatedItem(calculatedItem, index);

    if (itemError) {
      return { error: itemError };
    }

    subtotal += baseAmount;
    taxAmount += itemTaxAmount;
    calculatedItems.push(calculatedItem);
  }

  return {
    calculatedItems,
    subtotal,
    taxAmount,
  };
};

const createQuotationNumber = async (connection, companyId) => {
  const quotationPrefix = await getQuotationPrefix(connection, companyId);

  const [lastRows] = await connection.query(
    `
    SELECT quotation_number
    FROM tbl_quotations
    WHERE company_id = ?
    AND quotation_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, `${quotationPrefix}-%`],
  );

  let nextNumber = 1;

  if (lastRows.length > 0) {
    const lastNumber = String(lastRows[0].quotation_number || "")
      .split("-")
      .pop();

    const parsedNumber = Number(lastNumber);

    if (Number.isInteger(parsedNumber) && parsedNumber > 0) {
      nextNumber = parsedNumber + 1;
    }
  }

  return `${quotationPrefix}-${String(nextNumber).padStart(4, "0")}`;
};

const getQuotationCore = async (connection, quotationId, companyId) => {
  const [rows] = await connection.query(
    `
    SELECT
      q.*,
      c.customer_name,
      c.company_name,
      c.email,
      b.branch_name,
      b.branch_code
    FROM tbl_quotations q
    LEFT JOIN tbl_customers c
      ON q.customer_id = c.id
      AND c.company_id = q.company_id
    LEFT JOIN tbl_company_branches b
      ON q.branch_id = b.id
      AND b.company_id = q.company_id
    WHERE q.id = ?
    AND q.company_id = ?
    LIMIT 1
    `,
    [quotationId, companyId],
  );

  return rows[0] || null;
};

export const createQuotation = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const companyId = req.user.company_id;
    const userId = req.user.id;

    const {
      customer_id,
      branch_id,
      quotation_date,
      expiry_date,
      discount_amount = 0,
      notes,
      terms_conditions,
      items,
    } = req.body;

    if (!companyId) {
      await connection.rollback();
      return res.status(400).json({ message: "Company ID missing" });
    }

    const baseValidationError = validateQuotationBasePayload({
      customer_id,
      quotation_date,
      expiry_date,
      discount_amount,
      notes,
      terms_conditions,
      items,
    });

    if (baseValidationError) {
      await connection.rollback();
      return res.status(400).json({ message: baseValidationError });
    }

    let finalBranchId = branch_id ? Number(branch_id) : null;

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(connection, companyId);
    }

    if (!finalBranchId) {
      await connection.rollback();
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const branch = await validateBranch(connection, finalBranchId, companyId);

    if (!branch) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid branch selected" });
    }

    const [customerRows] = await connection.query(
      `
      SELECT id
      FROM tbl_customers
      WHERE id = ?
      AND company_id = ?
      AND status = 'active'
      LIMIT 1
      `,
      [customer_id, companyId],
    );

    if (customerRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Customer must be active and belong to the same company",
      });
    }

    const calculated = await buildCalculatedItems(connection, items, companyId);

    if (calculated.error) {
      await connection.rollback();
      return res.status(400).json({ message: calculated.error });
    }

    const { calculatedItems, subtotal, taxAmount } = calculated;

    const discount = toNumber(discount_amount);

    if (discount > subtotal + taxAmount) {
      await connection.rollback();
      return res.status(400).json({
        message: "Discount cannot be greater than quotation amount",
      });
    }

    const totalAmount = subtotal + taxAmount - discount;

    const snapshot = await buildDocumentSnapshot(
      connection,
      companyId,
      finalBranchId,
    );

    const billingTemplateSnapshot = JSON.stringify(snapshot);
    const quotationNumber = await createQuotationNumber(connection, companyId);

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM tbl_quotations
      WHERE company_id = ?
      AND quotation_number = ?
      LIMIT 1
      `,
      [companyId, quotationNumber],
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Quotation number already exists. Please try again.",
      });
    }

    const [quotationResult] = await connection.query(
      `
      INSERT INTO tbl_quotations
      (
        company_id,
        customer_id,
        branch_id,
        quotation_number,
        quotation_date,
        expiry_date,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        status,
        billing_template_snapshot,
        notes,
        terms_conditions,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        customer_id,
        finalBranchId,
        quotationNumber,
        quotation_date || new Date().toISOString().slice(0, 10),
        expiry_date || null,
        subtotal,
        taxAmount,
        discount,
        totalAmount,
        "draft",
        billingTemplateSnapshot,
        normalizeNullable(notes),
        normalizeNullable(terms_conditions),
        userId,
      ],
    );

    const quotationId = quotationResult.insertId;

    for (const item of calculatedItems) {
      await connection.query(
        `
        INSERT INTO tbl_quotation_items
        (
          quotation_id,
          product_id,
          item_name,
          description,
          hsn_sac_code,
          quantity,
          price,
          tax_rate,
          tax_amount,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          quotationId,
          item.product_id,
          item.item_name,
          item.description,
          item.hsn_sac_code,
          item.quantity,
          item.price,
          item.tax_rate,
          item.tax_amount,
          item.line_total,
        ],
      );
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Quotation",
      record_id: quotationId,
      description: `Quotation ${quotationNumber} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await connection.commit();

    let savedPdf = null;

    try {
      savedPdf = await saveDocumentPDFToServer({
        type: "quotation",

        document: {
          id: quotationId,
          quotation_number: quotationNumber,
        },

        companyId,
        authToken: req.headers.authorization,
      });

      await db.query(
        `
    UPDATE tbl_quotations
    SET pdf_path = ?
    WHERE id = ?
    AND company_id = ?
    `,
        [savedPdf.publicPath, quotationId, companyId],
      );

      console.log("Quotation PDF saved:", savedPdf.publicPath);
    } catch (pdfError) {
      console.error("QUOTATION PDF SAVE ERROR:", pdfError.message);
    }

    emitDashboardUpdate({ company_id: companyId });

    return res.status(201).json({
      message: "Quotation created successfully",
      quotation_id: quotationId,
      quotation_number: quotationNumber,
      pdf_saved: Boolean(savedPdf),
      pdf_path: savedPdf?.publicPath || null,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Failed to create quotation",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const getQuotations = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 1000, 1000);
    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (status !== "all" && !ALLOWED_QUOTATION_STATUS.includes(status)) {
      return res.status(400).json({
        message: "Status must be all or a valid quotation status",
      });
    }

    const branchCondition = getBranchCondition(req, "q");

    let whereClause = `
      WHERE q.company_id = ?
      ${branchCondition.clause}
    `;

    const params = [companyId, ...branchCondition.params];

    if (search) {
      whereClause += `
        AND (
          q.quotation_number LIKE ?
          OR q.status LIKE ?
          OR c.customer_name LIKE ?
          OR c.company_name LIKE ?
          OR c.email LIKE ?
          OR b.branch_name LIKE ?
          OR b.branch_code LIKE ?
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
      whereClause += " AND q.status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_quotations q
      LEFT JOIN tbl_customers c
        ON q.customer_id = c.id
        AND c.company_id = q.company_id
      LEFT JOIN tbl_company_branches b
        ON q.branch_id = b.id
        AND b.company_id = q.company_id
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [rows] = await db.query(
      `
      SELECT
        q.*,
        c.customer_name,
        c.company_name,
        c.email AS customer_email,
        b.branch_name,
        b.branch_code
      FROM tbl_quotations q
      LEFT JOIN tbl_customers c
        ON q.customer_id = c.id
        AND c.company_id = q.company_id
      LEFT JOIN tbl_company_branches b
        ON q.branch_id = b.id
        AND b.company_id = q.company_id
      ${whereClause}
      ORDER BY q.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      quotations: rows,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch quotations",
      error: error.message,
    });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!isPositiveInteger(id)) {
      return res
        .status(400)
        .json({ message: "Valid quotation id is required" });
    }

    const data = await getQuotationDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    return res.json({
      quotation: data.quotation,
      items: data.items,
    });
  } catch (error) {
    console.error("GET QUOTATION ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch quotation",
      error: error.message,
    });
  }
};

export const updateQuotationStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const status = normalizeText(req.body.status).toLowerCase();

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!isPositiveInteger(id)) {
      return res
        .status(400)
        .json({ message: "Valid quotation id is required" });
    }

    if (!ALLOWED_QUOTATION_STATUS.includes(status)) {
      return res.status(400).json({ message: "Invalid quotation status" });
    }

    const [quotationRows] = await db.query(
      `
      SELECT
        q.id,
        q.quotation_number,
        q.status,
        q.branch_id,
        c.customer_name
      FROM tbl_quotations q
      LEFT JOIN tbl_customers c
        ON q.customer_id = c.id
        AND c.company_id = q.company_id
      WHERE q.id = ?
      AND q.company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (quotationRows.length === 0) {
      return res.status(404).json({
        message: "Quotation not found or not allowed",
      });
    }

    const quotation = quotationRows[0];

    if (quotation.status === "converted") {
      return res.status(400).json({
        message: "Converted quotation status cannot be changed",
      });
    }

    if (quotation.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled quotation status cannot be changed",
      });
    }

    if (status === "converted") {
      return res.status(400).json({
        message: "Use convert quotation API to convert quotation",
      });
    }

    if (quotation.status === status) {
      return res.json({ message: "Quotation status already updated" });
    }

    await db.query(
      `
      UPDATE tbl_quotations
      SET status = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [status, id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Quotation",
      record_id: id,
      description: `Quotation ${
        quotation.quotation_number
      } status changed from ${formatStatus(quotation.status)} to ${formatStatus(
        status,
      )}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    if (status === "accepted") {
      await notifyBusinessUsers({
        company_id: companyId,
        type: "quotation",
        severity: "medium",
        title: "Quotation Accepted",
        message: `${quotation.quotation_number} accepted.`,
      });
    }

    if (status === "rejected") {
      await notifyBusinessUsers({
        company_id: companyId,
        type: "quotation",
        severity: "medium",
        title: "Quotation Rejected",
        message: `${quotation.quotation_number} rejected.`,
      });
    }

    emitDashboardUpdate({ company_id: companyId });

    return res.json({ message: "Quotation status updated successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update quotation status",
      error: error.message,
    });
  }
};

export const cancelQuotation = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!isPositiveInteger(id)) {
      return res
        .status(400)
        .json({ message: "Valid quotation id is required" });
    }

    const [quotationRows] = await db.query(
      `
      SELECT
        q.id,
        q.quotation_number,
        q.status,
        q.branch_id,
        c.customer_name
      FROM tbl_quotations q
      LEFT JOIN tbl_customers c
        ON q.customer_id = c.id
        AND c.company_id = q.company_id
      WHERE q.id = ?
      AND q.company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (quotationRows.length === 0) {
      return res.status(404).json({
        message: "Quotation not found or not allowed",
      });
    }

    const quotation = quotationRows[0];

    if (quotation.status === "converted") {
      return res.status(400).json({
        message: "Converted quotation cannot be cancelled",
      });
    }

    if (quotation.status === "cancelled") {
      return res.status(400).json({
        message: "Quotation already cancelled",
      });
    }

    await db.query(
      `
      UPDATE tbl_quotations
      SET status = 'cancelled'
      WHERE id = ?
      AND company_id = ?
      `,
      [id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "CANCEL",
      module_name: "Quotation",
      record_id: id,
      description: `Quotation ${quotation.quotation_number} cancelled`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({ company_id: companyId });

    return res.json({ message: "Quotation cancelled successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to cancel quotation",
      error: error.message,
    });
  }
};

export const convertQuotationToInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      await connection.rollback();
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!isPositiveInteger(id)) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Valid quotation id is required" });
    }

    const [quotationRows] = await connection.query(
      `
      SELECT q.*
      FROM tbl_quotations q
      WHERE q.id = ?
      AND q.company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (quotationRows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ message: "Quotation not found or not allowed" });
    }

    const quotation = quotationRows[0];
    const quotationBranchId = quotation.branch_id || null;

    if (quotation.status === "converted") {
      await connection.rollback();
      return res.status(400).json({ message: "Quotation already converted" });
    }

    if (["cancelled", "rejected", "expired"].includes(quotation.status)) {
      await connection.rollback();
      return res.status(400).json({
        message: "Cancelled, rejected or expired quotation cannot be converted",
      });
    }

    const [customerRows] = await connection.query(
      `
      SELECT id
      FROM tbl_customers
      WHERE id = ?
      AND company_id = ?
      AND status = 'active'
      LIMIT 1
      `,
      [quotation.customer_id, companyId],
    );

    if (customerRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Customer must be active and belong to the same company",
      });
    }

    if (quotationBranchId) {
      const branch = await validateBranch(
        connection,
        quotationBranchId,
        companyId,
      );

      if (!branch) {
        await connection.rollback();
        return res.status(400).json({
          message: "Quotation branch is inactive or not found",
        });
      }
    }

    const [items] = await connection.query(
      `
      SELECT *
      FROM tbl_quotation_items
      WHERE quotation_id = ?
      ORDER BY id ASC
      `,
      [id],
    );

    if (items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Quotation has no items" });
    }

    for (const item of items) {
      const quantity = toNumber(item.quantity, NaN);
      const price = toNumber(item.price, NaN);
      const taxRate = toNumber(item.tax_rate, 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        await connection.rollback();
        return res.status(400).json({
          message: "Item quantity must be greater than 0",
        });
      }

      if (!Number.isFinite(price) || price < 0) {
        await connection.rollback();
        return res.status(400).json({
          message: "Item price cannot be negative",
        });
      }

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        await connection.rollback();
        return res.status(400).json({
          message: "Tax rate must be between 0 and 100",
        });
      }

      if (item.product_id) {
        const [productRows] = await connection.query(
          `
          SELECT product_name, quantity, status
          FROM tbl_products
          WHERE id = ?
          AND company_id = ?
          AND status = 'active'
          LIMIT 1
          `,
          [item.product_id, companyId],
        );

        if (productRows.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            message: `${item.item_name || "Product"} is not active or not found`,
          });
        }

        const product = productRows[0];
        const availableStock = Number(product.quantity || 0);

        if (quantity > availableStock) {
          await connection.rollback();
          return res.status(400).json({
            message: `${product.product_name} stock is not enough. Available stock: ${availableStock}`,
          });
        }
      }
    }

    const company = await getInvoiceNumberConfig(connection, companyId);

    const [lastInvoiceRows] = await connection.query(
      `
      SELECT invoice_number
      FROM tbl_invoices
      WHERE company_id = ?
      AND invoice_number LIKE ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [companyId, `${company.invoice_prefix || "INV"}-%`],
    );

    let nextInvoiceNumber = Number(company.invoice_start_number || 1);

    if (lastInvoiceRows.length > 0) {
      const lastNumber = String(lastInvoiceRows[0].invoice_number || "")
        .split("-")
        .pop();

      const parsedNumber = Number(lastNumber);

      if (Number.isInteger(parsedNumber) && parsedNumber >= nextInvoiceNumber) {
        nextInvoiceNumber = parsedNumber + 1;
      }
    }

    const invoiceNumber = `${company.invoice_prefix || "INV"}-${String(
      nextInvoiceNumber,
    ).padStart(4, "0")}`;

    const invoiceDate = new Date().toISOString().slice(0, 10);

    const safeBillingTemplateSnapshot =
      typeof quotation.billing_template_snapshot === "string"
        ? quotation.billing_template_snapshot
        : JSON.stringify(quotation.billing_template_snapshot || {});

    const [invoiceResult] = await connection.query(
      `
      INSERT INTO tbl_invoices
      (
        company_id,
        customer_id,
        branch_id,
        invoice_number,
        invoice_date,
        due_date,
        subtotal,
        total_tax,
        total_amount,
        discount,
        paid_amount,
        balance_due,
        status,
        notes,
        terms_conditions,
        billing_template_snapshot
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        quotation.customer_id,
        quotationBranchId,
        invoiceNumber,
        invoiceDate,
        quotation.expiry_date || null,
        quotation.subtotal,
        quotation.tax_amount,
        quotation.total_amount,
        quotation.discount_amount || 0,
        0,
        quotation.total_amount,
        "draft",
        quotation.notes || null,
        quotation.terms_conditions || null,
        safeBillingTemplateSnapshot,
      ],
    );

    const invoiceId = invoiceResult.insertId;

    for (const item of items) {
      const quantity = toNumber(item.quantity);
      const price = toNumber(item.price);
      const taxRate = toNumber(item.tax_rate);
      const taxAmount = toNumber(item.tax_amount);
      const lineTotal = toNumber(item.line_total);

      await connection.query(
        `
        INSERT INTO tbl_invoice_items
        (
          invoice_id,
          product_id,
          item_name,
          quantity,
          price,
          tax,
          total,
          hsn_sac_code,
          tax_rate
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.product_id || null,
          item.item_name,
          quantity,
          price,
          taxAmount,
          lineTotal,
          item.hsn_sac_code || null,
          taxRate,
        ],
      );

      if (item.product_id) {
        await connection.query(
          `
          UPDATE tbl_products
          SET quantity = quantity - ?
          WHERE id = ?
          AND company_id = ?
          `,
          [quantity, item.product_id, companyId],
        );
      }
    }

    await connection.query(
      `
      UPDATE tbl_quotations
      SET status = 'converted'
      WHERE id = ?
      AND company_id = ?
      `,
      [id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "CONVERT",
      module_name: "Quotation",
      record_id: id,
      description: `Quotation ${quotation.quotation_number} converted to Invoice ${invoiceNumber}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Invoice",
      record_id: invoiceId,
      description: `Invoice ${invoiceNumber} created from Quotation ${quotation.quotation_number}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await notifyBusinessUsers({
      company_id: companyId,
      type: "quotation",
      severity: "medium",
      title: "Quotation Converted",
      message: `${quotation.quotation_number} converted to invoice.`,
    });

    await connection.commit();

    let savedPdf = null;

    try {
      savedPdf = await saveDocumentPDFToServer({
        type: "invoice",

        document: {
          id: invoiceId,
          invoice_number: invoiceNumber,
        },

        companyId,
        authToken: req.headers.authorization,
      });

      await db.query(
        `
    UPDATE tbl_invoices
    SET pdf_path = ?
    WHERE id = ?
    AND company_id = ?
    `,
        [savedPdf.publicPath, invoiceId, companyId],
      );

      console.log("Converted invoice PDF saved:", savedPdf.publicPath);
    } catch (pdfError) {
      console.error("CONVERTED INVOICE PDF SAVE ERROR:", pdfError.message);
    }

    emitDashboardUpdate({ company_id: companyId });

    return res.status(201).json({
      message: "Quotation converted to invoice successfully",
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
    });
  } catch (error) {
    await connection.rollback();

    console.error("CONVERT QUOTATION TO INVOICE ERROR:", error);

    return res.status(500).json({
      message: "Failed to convert quotation",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const downloadQuotation = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const authToken = req.headers.authorization;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!isPositiveInteger(id)) {
      return res
        .status(400)
        .json({ message: "Valid quotation id is required" });
    }

    const data = await getQuotationDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const { quotation } = data;

    const { pdfBuffer } = await getSavedDocumentPDFBuffer({
      type: "quotation",
      document: quotation,
      companyId,
      authToken,
    });

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "DOWNLOAD",
      module_name: "Quotation",
      record_id: id,
      description: `Quotation ${quotation.quotation_number} PDF downloaded`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${quotation.quotation_number}.pdf`,
    );

    return res.end(pdfBuffer);
  } catch (error) {
    console.error("QUOTATION PDF DOWNLOAD ERROR:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Quotation PDF download error",
        error: error.message,
      });
    }
  }
};

export const sendQuotationEmail = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const authToken = req.headers.authorization;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!isPositiveInteger(id)) {
      return res
        .status(400)
        .json({ message: "Valid quotation id is required" });
    }

    const data = await getQuotationDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const { quotation } = data;

    if (!quotation.email) {
      return res.status(400).json({ message: "Customer email not found" });
    }

    if (quotation.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled quotation cannot be emailed",
      });
    }

    if (quotation.status === "converted") {
      return res.status(400).json({
        message: "Converted quotation cannot be emailed",
      });
    }

    const [companyRows] = await db.query(
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

    if (companyRows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const company = companyRows[0];

    const { pdfBuffer } = await getSavedDocumentPDFBuffer({
      type: "quotation",
      document: quotation,
      companyId,
      authToken,
    });

    const subject = `Quotation ${quotation.quotation_number} from ${
      company.name || quotation.business_name || "Company"
    }`;

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#111827">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
          <div style="padding:22px 24px;background:#0f172a;color:#ffffff">
            <h2 style="margin:0;font-size:20px">Quotation ${quotation.quotation_number}</h2>
            <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1">
              From ${company.name || quotation.business_name || "Company"}
            </p>
          </div>

          <div style="padding:24px">
            <p style="margin:0 0 14px">Hello ${quotation.customer_name || "Customer"},</p>

            <p style="margin:0 0 18px;line-height:1.6">
              Please find your quotation details below. The PDF quotation is attached with this email.
            </p>

            <table style="width:100%;border-collapse:collapse;margin:18px 0">
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">Quotation Number</td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${quotation.quotation_number}</td>
              </tr>

              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">Quotation Date</td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${quotation.quotation_date || "-"}</td>
              </tr>

              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">Expiry Date</td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${quotation.expiry_date || "-"}</td>
              </tr>

              ${
                quotation.branch_name
                  ? `
                    <tr>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">Branch</td>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${quotation.branch_name}</td>
                    </tr>
                  `
                  : ""
              }

              <tr>
                <td style="padding:10px;color:#64748b">Total Amount</td>
                <td style="padding:10px;text-align:right;font-size:18px;font-weight:800">
                  ₹${Number(quotation.total_amount || 0).toFixed(2)}
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0;line-height:1.6">
              Regards,<br/>
              <strong>${company.name || quotation.business_name || "Company"}</strong>
            </p>
          </div>

          <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px">
            This email was sent from ${company.name || quotation.business_name || "Company"}.
          </div>
        </div>
      </div>
    `;

    await sendCompanyEmail({
      company,
      to: quotation.email,
      subject,
      html,
      text: `Quotation ${quotation.quotation_number} from ${
        company.name || quotation.business_name || "Company"
      }

Hello ${quotation.customer_name || "Customer"},

Please find your quotation details below. The PDF quotation is attached with this email.

Quotation Number: ${quotation.quotation_number}
Quotation Date: ${quotation.quotation_date || "-"}
Expiry Date: ${quotation.expiry_date || "-"}
${quotation.branch_name ? `Branch: ${quotation.branch_name}` : ""}
Total Amount: ₹${Number(quotation.total_amount || 0).toFixed(2)}

Regards,
${company.name || quotation.business_name || "Company"}`,
      attachments: [
        {
          filename: `${quotation.quotation_number}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
      module_type: "quotation",
      reference_id: id,
    });

    if (quotation.status === "draft") {
      await db.query(
        `
        UPDATE tbl_quotations
        SET status = 'sent'
        WHERE id = ?
        AND company_id = ?
        `,
        [id, companyId],
      );
    }

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "EMAIL_SENT",
      module_name: "Quotation",
      record_id: id,
      description: `Quotation ${quotation.quotation_number} emailed to ${quotation.email}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({ company_id: companyId });

    return res.json({
      message: "Quotation email sent successfully",
      status: quotation.status === "draft" ? "sent" : quotation.status,
    });
  } catch (error) {
    console.error("SEND QUOTATION EMAIL ERROR:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    return res.status(500).json({
      message: error.response || error.message || "Quotation email send failed",
    });
  }
};

export const pushQuotationToCrm = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID missing",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid quotation id is required",
      });
    }

    // 1. Quotation + customer data
    const data = await getQuotationDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    const { quotation } = data;

    if (!quotation.customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer not found for this quotation",
      });
    }

    // 2. Company CRM API key
    const [companyRows] = await db.query(
      `
      SELECT crm_api_key
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const crmApiKey = String(companyRows[0].crm_api_key || "").trim();

    if (!crmApiKey) {
      return res.status(400).json({
        success: false,
        message: "Please contact support team to enable CRM integration",
      });
    }

    // 3. Customer data
    const customer = {
      id: quotation.customer_id,
      customer_name: quotation.customer_name || "",
      company_name: quotation.company_name || "",
      email: quotation.email || "",
    };

    // 4. CUSTOMER SYNC FIRST
    const customerCrmResponse = await syncCustomerToCrm({
      apiKey: crmApiKey,
      customer,
    });

    console.log("CRM QUOTATION CUSTOMER SYNC RESPONSE:", customerCrmResponse);

    // 5. Quotation PDF path
    const pdfPath = String(quotation.pdf_path || "").trim();

    if (!pdfPath) {
      return res.status(400).json({
        success: false,
        message:
          "Quotation PDF is not available. Please generate the quotation PDF before pushing to CRM.",
      });
    }

    // 6. Public backend URL
    const backendPublicUrl = String(process.env.VITE_API_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "");

    if (!backendPublicUrl) {
      return res.status(500).json({
        success: false,
        message: "VITE_API_BASE_URL is not configured",
      });
    }

    const normalizedPdfPath = pdfPath.startsWith("/") ? pdfPath : `/${pdfPath}`;

    const pdfUrl = `${backendPublicUrl}${normalizedPdfPath}`;

    let parsedPdfUrl;

    try {
      parsedPdfUrl = new URL(pdfUrl);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Generated quotation PDF URL is invalid",
      });
    }

    if (!["http:", "https:"].includes(parsedPdfUrl.protocol)) {
      return res.status(500).json({
        success: false,
        message: "Quotation PDF URL must use HTTP or HTTPS",
      });
    }

    console.log("CRM QUOTATION PDF URL:", pdfUrl);

    // 7. DOCUMENT SYNC
    const documentCrmResponse = await syncDocumentToCrm({
      apiKey: crmApiKey,

      externalType: "QUOTATION",

      // Same quotation = same externalId
      externalId: String(quotation.id),

      // Same customer id used in Customer Sync
      externalCustomerId: String(quotation.customer_id),

      pdfUrl,
    });

    console.log("CRM QUOTATION DOCUMENT SYNC RESPONSE:", documentCrmResponse);

    // 8. Final frontend response
    return res.json({
      success: true,
      message: "Quotation pushed to CRM successfully",
    });
  } catch (error) {
    console.error("PUSH QUOTATION TO CRM ERROR:", {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      crmResponse: error.crmResponse,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Quotation CRM sync failed",
      code: error.code || "CRM_SYNC_FAILED",
    });
  }
};

export const updateQuotation = async (req, res) => {
  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID missing",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid quotation id is required",
      });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    // Existing quotation
    const existingQuotation = await getQuotationCore(
      connection,
      id,
      companyId,
    );

    if (!existingQuotation) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    // Only draft + sent editable
    if (!["draft", "sent"].includes(existingQuotation.status)) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: `Quotation cannot be edited because its status is ${formatStatus(
          existingQuotation.status,
        )}`,
      });
    }

    const {
      customer_id,
      branch_id,
      quotation_date,
      expiry_date,
      discount_amount,
      notes,
      terms_conditions,
      items,
    } = req.body;

    const baseValidationError = validateQuotationBasePayload({
      customer_id,
      quotation_date,
      expiry_date,
      discount_amount,
      notes,
      terms_conditions,
      items,
    });

    if (baseValidationError) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: baseValidationError,
      });
    }

    // Branch
    let finalBranchId = branch_id ? Number(branch_id) : null;

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(
        connection,
        companyId,
      );
    }

    if (!finalBranchId) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const branch = await validateBranch(
      connection,
      finalBranchId,
      companyId,
    );

    if (!branch) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: "Invalid branch selected",
      });
    }

    // Customer
    const [customerRows] = await connection.query(
      `
      SELECT id
      FROM tbl_customers
      WHERE id = ?
      AND company_id = ?
      AND status = 'active'
      LIMIT 1
      `,
      [customer_id, companyId],
    );

    if (customerRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message:
          "Customer must be active and belong to the same company",
      });
    }

    // Recalculate items from backend
    const calculated = await buildCalculatedItems(
      connection,
      items,
      companyId,
    );

    if (calculated.error) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: calculated.error,
      });
    }

    const {
      calculatedItems,
      subtotal,
      taxAmount,
    } = calculated;

    const discount = toNumber(discount_amount);

    if (discount > subtotal + taxAmount) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message:
          "Discount cannot be greater than quotation amount",
      });
    }

    const totalAmount =
      subtotal + taxAmount - discount;

    // Updated snapshot
    const snapshot = await buildDocumentSnapshot(
      connection,
      companyId,
      finalBranchId,
    );

    const billingTemplateSnapshot =
      JSON.stringify(snapshot);

    // IMPORTANT:
    // quotation_number change nahi hoga
    // status change nahi hoga
    await connection.query(
      `
      UPDATE tbl_quotations
      SET
        customer_id = ?,
        branch_id = ?,
        quotation_date = ?,
        expiry_date = ?,
        subtotal = ?,
        tax_amount = ?,
        discount_amount = ?,
        total_amount = ?,
        billing_template_snapshot = ?,
        notes = ?,
        terms_conditions = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [
        customer_id,
        finalBranchId,
        quotation_date ||
          existingQuotation.quotation_date,
        expiry_date || null,
        subtotal,
        taxAmount,
        discount,
        totalAmount,
        billingTemplateSnapshot,
        normalizeNullable(notes),
        normalizeNullable(terms_conditions),
        id,
        companyId,
      ],
    );

    // Old items remove
    await connection.query(
      `
      DELETE FROM tbl_quotation_items
      WHERE quotation_id = ?
      `,
      [id],
    );

    // Updated items insert
    for (const item of calculatedItems) {
      await connection.query(
        `
        INSERT INTO tbl_quotation_items
        (
          quotation_id,
          product_id,
          item_name,
          description,
          hsn_sac_code,
          quantity,
          price,
          tax_rate,
          tax_amount,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          item.product_id,
          item.item_name,
          item.description,
          item.hsn_sac_code,
          item.quantity,
          item.price,
          item.tax_rate,
          item.tax_amount,
          item.line_total,
        ],
      );
    }

    await createAuditLog({
      company_id: companyId,
      user_id: userId,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Quotation",
      record_id: id,
      description: `Quotation ${existingQuotation.quotation_number} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await connection.commit();
    transactionStarted = false;

    // Same quotation number = same PDF path
    let savedPdf = null;

    try {
      savedPdf = await saveDocumentPDFToServer({
        type: "quotation",

        document: {
          id: Number(id),
          quotation_number:
            existingQuotation.quotation_number,
        },

        companyId,
        authToken: req.headers.authorization,
      });

      await db.query(
        `
        UPDATE tbl_quotations
        SET pdf_path = ?
        WHERE id = ?
        AND company_id = ?
        `,
        [
          savedPdf.publicPath,
          id,
          companyId,
        ],
      );

      console.log(
        "Updated quotation PDF saved:",
        savedPdf.publicPath,
      );
    } catch (pdfError) {
      console.error(
        "UPDATED QUOTATION PDF SAVE ERROR:",
        pdfError.message,
      );
    }

    emitDashboardUpdate({
      company_id: companyId,
    });

    return res.json({
      message: "Quotation updated successfully",
      quotation_id: Number(id),
      quotation_number:
        existingQuotation.quotation_number,
      status: existingQuotation.status,
      pdf_saved: Boolean(savedPdf),
      pdf_path: savedPdf?.publicPath || null,
    });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    console.error(
      "UPDATE QUOTATION ERROR:",
      error,
    );

    return res.status(500).json({
      message: "Failed to update quotation",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};