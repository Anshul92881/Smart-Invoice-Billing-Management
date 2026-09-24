import db from "../config/db.js";
import { sendCompanyEmail } from "../utils/companyEmailServices.js";
import { createAuditLog } from "../utils/auditLogger.js";
import { emitDashboardUpdate } from "../utils/socketEvents.js";
import { notifyBusinessUsers } from "../utils/notificationLoggers.js";
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

const HSN_SAC_REGEX = /^[0-9]{4,8}$/;

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

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
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

const getUserAgent = (req) => req.headers["user-agent"] || null;

const getActiveCustomer = async (connection, customerId, companyId) => {
  if (!isPositiveInteger(customerId)) return null;

  const [rows] = await connection.query(
    `
    SELECT id
    FROM tbl_customers
    WHERE id = ?
    AND company_id = ?
    AND status = 'active'
    LIMIT 1
    `,
    [customerId, companyId],
  );

  return rows[0] || null;
};

const validateActiveBranch = async (connection, branchId, companyId) => {
  if (!isPositiveInteger(branchId)) return null;

  const [rows] = await connection.query(
    `
    SELECT id
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

const getCompanyInvoiceConfig = async (connection, companyId) => {
  const [rows] = await connection.query(
    `
    SELECT
      invoice_prefix,
      invoice_start_number
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0] || null;
};

const generateInvoiceNumber = async (connection, companyId, company) => {
  const prefix = company.invoice_prefix || "INV";
  const startNumber = Number(company.invoice_start_number || 1);

  const [lastRows] = await connection.query(
    `
    SELECT invoice_number
    FROM tbl_invoices
    WHERE company_id = ?
    AND invoice_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, `${prefix}-%`],
  );

  let nextNumber = startNumber;

  if (lastRows.length > 0) {
    const lastNumber = String(lastRows[0].invoice_number || "")
      .split("-")
      .pop();

    const parsedNumber = Number(lastNumber);

    if (Number.isInteger(parsedNumber) && parsedNumber >= startNumber) {
      nextNumber = parsedNumber + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
};

const validateInvoicePayload = ({
  customer_id,
  branch_id,
  invoice_date,
  due_date,
  notes,
  items,
}) => {
  if (!customer_id || !isPositiveInteger(customer_id)) {
    return "Valid customer is required";
  }

  if (branch_id && !isPositiveInteger(branch_id)) {
    return "Valid branch is required";
  }

  if (!isValidDateString(invoice_date)) {
    return "Invoice date must be a valid YYYY-MM-DD date";
  }

  if (!isValidDateString(due_date)) {
    return "Due date must be a valid YYYY-MM-DD date";
  }

  if (invoice_date && due_date) {
    const invoiceDate = new Date(`${invoice_date}T00:00:00.000Z`);
    const dueDate = new Date(`${due_date}T00:00:00.000Z`);

    if (dueDate < invoiceDate) {
      return "Due date cannot be before invoice date";
    }
  }

  if (notes && normalizeText(notes).length > 1000) {
    return "Notes must be less than 1000 characters";
  }

  if (!Array.isArray(items) || items.length === 0) {
    return "At least one invoice item is required";
  }

  if (items.length > 100) {
    return "Invoice cannot have more than 100 items";
  }

  return null;
};

const validateInvoiceItem = (item, row) => {
  if (!item.product_id || !isPositiveInteger(item.product_id)) {
    return `Valid product is required at row ${row}`;
  }

  const quantity = toNumber(item.quantity, NaN);
  const price =
    item.price !== undefined && item.price !== ""
      ? toNumber(item.price, NaN)
      : 0;
  const taxRate =
    item.tax_rate !== undefined && item.tax_rate !== ""
      ? toNumber(item.tax_rate, NaN)
      : 0;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `Quantity must be greater than 0 at row ${row}`;
  }

  if (
    item.price !== undefined &&
    item.price !== "" &&
    (!Number.isFinite(price) || price <= 0)
  ) {
    return `Price must be greater than 0 at row ${row}`;
  }

  if (
    item.tax_rate !== undefined &&
    item.tax_rate !== "" &&
    (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
  ) {
    return `Tax rate must be between 0 and 100 at row ${row}`;
  }

  if (
    item.hsn_sac_code &&
    !HSN_SAC_REGEX.test(normalizeText(item.hsn_sac_code))
  ) {
    return `HSN/SAC code must be 4 to 8 digits at row ${row}`;
  }

  return null;
};

const flattenInvoiceSnapshot = (invoice = {}) => {
  const snapshot = parseJsonSafe(invoice.billing_template_snapshot);

  return {
    ...invoice,

    business_name:
      snapshot.company?.name || invoice.business_name || invoice.name || "",
    business_address:
      snapshot.company?.address ||
      invoice.business_address ||
      invoice.address ||
      "",
    business_email:
      snapshot.company?.email ||
      invoice.business_email ||
      invoice.company_email ||
      "",
    business_phone:
      snapshot.company?.phone ||
      invoice.business_phone ||
      invoice.company_phone ||
      "",
    gst_number: snapshot.company?.gst_number || invoice.gst_number || "",
    pan_number: snapshot.company?.pan_number || invoice.pan_number || "",
    logo: snapshot.company?.logo || invoice.logo || "",

    bank_name: snapshot.bank?.bank_name || invoice.bank_name || "",
    account_holder_name:
      snapshot.bank?.account_holder_name || invoice.account_holder_name || "",
    account_number:
      snapshot.bank?.account_number || invoice.account_number || "",
    ifsc_code: snapshot.bank?.ifsc_code || invoice.ifsc_code || "",
    upi_id: snapshot.bank?.upi_id || invoice.upi_id || "",
    invoice_terms: snapshot.bank?.invoice_terms || invoice.invoice_terms || "",
    payment_instructions:
      snapshot.bank?.payment_instructions || invoice.payment_instructions || "",

    branch_name: snapshot.branch?.branch_name || invoice.branch_name || "",
    branch_code: snapshot.branch?.branch_code || invoice.branch_code || "",
  };
};

const getInvoiceDocumentData = async (invoiceId, companyId) => {
  const [invoiceRows] = await db.query(
    `
    SELECT
      i.*,

      c.customer_name,
      c.company_name,
      c.email,
      c.phone,
      c.billing_address,
      c.shipping_address,
      c.gstin,

      comp.name AS business_name,
      comp.address AS business_address,
      comp.email AS business_email,
      comp.phone AS business_phone,
      comp.gst_number,
      comp.pan_number,
      comp.logo,
      comp.bank_name,
      comp.account_holder_name,
      comp.account_number,
      comp.ifsc_code,
      comp.upi_id,
      comp.invoice_terms,
      comp.payment_instructions,
      comp.billing_template,

      b.branch_name,
      b.branch_code

    FROM tbl_invoices i
    LEFT JOIN tbl_customers c
      ON i.customer_id = c.id
      AND c.company_id = i.company_id
    LEFT JOIN tbl_companies comp
      ON i.company_id = comp.id
    LEFT JOIN tbl_company_branches b
      ON i.branch_id = b.id
      AND b.company_id = i.company_id
    WHERE i.id = ?
    AND i.company_id = ?
    LIMIT 1
    `,
    [invoiceId, companyId],
  );

  if (invoiceRows.length === 0) return null;

  const [items] = await db.query(
    `
    SELECT
      ii.*,
      p.product_name,
      p.description,
      p.hsn_sac_code
    FROM tbl_invoice_items ii
    LEFT JOIN tbl_products p
      ON ii.product_id = p.id
    WHERE ii.invoice_id = ?
    ORDER BY ii.id ASC
    `,
    [invoiceId],
  );

  return {
    invoice: flattenInvoiceSnapshot(invoiceRows[0]),
    items,
  };
};

export const createInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const company_id = req.user.company_id;
    const { customer_id, branch_id, invoice_date, due_date, notes, items } =
      req.body;

    if (!company_id) {
      await connection.rollback();
      return res.status(400).json({ message: "Company id missing" });
    }

    const payloadError = validateInvoicePayload({
      customer_id,
      branch_id,
      invoice_date,
      due_date,
      notes,
      items,
    });

    if (payloadError) {
      await connection.rollback();
      return res.status(400).json({ message: payloadError });
    }

    const customer = await getActiveCustomer(
      connection,
      customer_id,
      company_id,
    );

    if (!customer) {
      await connection.rollback();
      return res.status(400).json({
        message: "Customer must be active and belong to the same company",
      });
    }

    let finalBranchId = branch_id ? Number(branch_id) : null;

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(connection, company_id);
    }

    if (!finalBranchId) {
      await connection.rollback();
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const branch = await validateActiveBranch(
      connection,
      finalBranchId,
      company_id,
    );

    if (!branch) {
      await connection.rollback();
      return res.status(400).json({
        message: "Branch must be active and belong to the same company",
      });
    }

    const company = await getCompanyInvoiceConfig(connection, company_id);

    if (!company) {
      await connection.rollback();
      return res.status(404).json({ message: "Company not found" });
    }

    const snapshot = await buildDocumentSnapshot(
      connection,
      company_id,
      finalBranchId,
    );

    const billingTemplateSnapshot = JSON.stringify(snapshot);
    const invoice_number = await generateInvoiceNumber(
      connection,
      company_id,
      company,
    );

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM tbl_invoices
      WHERE company_id = ?
      AND invoice_number = ?
      LIMIT 1
      `,
      [company_id, invoice_number],
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Invoice number already exists. Please try again.",
      });
    }

    let subtotal = 0;
    let total_tax = 0;
    let total_amount = 0;
    const finalItems = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const row = index + 1;

      const itemError = validateInvoiceItem(item, row);

      if (itemError) {
        await connection.rollback();
        return res.status(400).json({ message: itemError });
      }

      const [productRows] = await connection.query(
        `
        SELECT p.*, t.cgst_percentage, t.sgst_percentage, t.igst_percentage
        FROM tbl_products p
        LEFT JOIN tbl_taxes t
          ON p.tax_id = t.id
          AND t.company_id = p.company_id
        WHERE p.id = ?
        AND p.company_id = ?
        AND p.status = 'active'
        LIMIT 1
        `,
        [item.product_id, company_id],
      );

      if (productRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          message: `Product must be active and belong to the same company at row ${row}`,
        });
      }

      const product = productRows[0];
      const quantity = toNumber(item.quantity, NaN);

      const price =
        item.price !== undefined && item.price !== ""
          ? toNumber(item.price, NaN)
          : toNumber(product.unit_price, 0);

      const taxRate =
        item.tax_rate !== undefined && item.tax_rate !== ""
          ? toNumber(item.tax_rate, NaN)
          : toNumber(product.tax_rate, 0);

      const availableStock = Number(product.quantity || 0);

      if (!Number.isFinite(price) || price <= 0) {
        await connection.rollback();
        return res.status(400).json({
          message: `Price must be greater than 0 at row ${row}`,
        });
      }

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        await connection.rollback();
        return res.status(400).json({
          message: `Tax rate must be between 0 and 100 at row ${row}`,
        });
      }

      if (quantity > availableStock) {
        await connection.rollback();
        return res.status(400).json({
          message: `${product.product_name} stock is not enough. Available stock: ${availableStock}`,
        });
      }

      const itemSubtotal = price * quantity;
      const itemTax = (itemSubtotal * taxRate) / 100;
      const itemTotal = itemSubtotal + itemTax;

      const cgstAmount =
        product.cgst_percentage !== null &&
        product.cgst_percentage !== undefined
          ? (itemSubtotal * Number(product.cgst_percentage || 0)) / 100
          : itemTax / 2;

      const sgstAmount =
        product.sgst_percentage !== null &&
        product.sgst_percentage !== undefined
          ? (itemSubtotal * Number(product.sgst_percentage || 0)) / 100
          : itemTax / 2;

      const igstAmount =
        product.igst_percentage !== null &&
        product.igst_percentage !== undefined
          ? (itemSubtotal * Number(product.igst_percentage || 0)) / 100
          : itemTax;

      subtotal += itemSubtotal;
      total_tax += itemTax;
      total_amount += itemTotal;

      finalItems.push({
        product_id: Number(item.product_id),
        quantity,
        price,
        product_name: product.product_name,
        hsn_sac_code: product.hsn_sac_code || item.hsn_sac_code || null,
        tax_rate: taxRate,
        tax: itemTax,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        total: itemTotal,
      });
    }

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
        paid_amount,
        balance_due,
        status,
        billing_template_snapshot,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        customer_id,
        finalBranchId,
        invoice_number,
        invoice_date || new Date().toISOString().slice(0, 10),
        due_date || null,
        subtotal,
        total_tax,
        total_amount,
        0,
        total_amount,
        "draft",
        billingTemplateSnapshot,
        normalizeNullable(notes),
      ],
    );

    const invoiceId = invoiceResult.insertId;

    for (const item of finalItems) {
      await connection.query(
        `
        INSERT INTO tbl_invoice_items
        (
          invoice_id,
          product_id,
          item_name,
          quantity,
          price,
          tax_rate,
          tax,
          total,
          hsn_sac_code,
          cgst_amount,
          sgst_amount,
          igst_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.price,
          item.tax_rate,
          item.tax,
          item.total,
          item.hsn_sac_code,
          item.cgst_amount,
          item.sgst_amount,
          item.igst_amount,
        ],
      );

      await connection.query(
        `
        UPDATE tbl_products
        SET quantity = quantity - ?
        WHERE id = ?
        AND company_id = ?
        `,
        [item.quantity, item.product_id, company_id],
      );
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Invoice",
      record_id: invoiceId,
      description: `Invoice ${invoice_number} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({
      company_id,
    });

    await connection.commit();

    let savedPdf = null;

    try {
      savedPdf = await saveDocumentPDFToServer({
        type: "invoice",

        document: {
          id: invoiceId,
          invoice_number,
        },

        companyId: company_id,
        authToken: req.headers.authorization,
      });

      await db.query(
        `
    UPDATE tbl_invoices
    SET pdf_path = ?
    WHERE id = ?
    AND company_id = ?
    `,
        [savedPdf.publicPath, invoiceId, company_id],
      );

      console.log("Invoice PDF saved:", savedPdf.publicPath);
    } catch (pdfError) {
      console.error("INVOICE PDF SAVE ERROR:", pdfError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      invoice_id: invoiceId,
      invoice_number,
      pdf_saved: Boolean(savedPdf),
      pdf_path: savedPdf?.publicPath || null,
    });
  } catch (error) {
    await connection.rollback();

    console.error("CREATE INVOICE ERROR:", error);

    return res.status(500).json({
      message: "Failed to create invoice",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const getInvoices = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const [rows] = await db.query(
      `
      SELECT
        i.*,
        c.customer_name,
        c.company_name,
        b.branch_name,
        b.branch_code
      FROM tbl_invoices i
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
        AND c.company_id = i.company_id
      LEFT JOIN tbl_company_branches b
        ON i.branch_id = b.id
        AND b.company_id = i.company_id
      WHERE i.company_id = ?
      ORDER BY i.id DESC
      `,
      [companyId],
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch invoices",
      error: error.message,
    });
  }
};

export const getSingleInvoice = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid invoice id is required" });
    }

    const data = await getInvoiceDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    return res.json({
      invoice: data.invoice,
      items: data.items,
    });
  } catch (error) {
    console.error("GET INVOICE ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch invoice",
      error: error.message,
    });
  }
};

export const cancelInvoice = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid invoice id is required" });
    }

    const [rows] = await db.query(
      `
      SELECT *
      FROM tbl_invoices
      WHERE id = ?
      AND company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const invoice = rows[0];

    if (invoice.status === "paid" || Number(invoice.paid_amount) > 0) {
      return res.status(400).json({
        message: "Paid invoice cannot be cancelled",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        message: "Invoice already cancelled",
      });
    }

    await db.query(
      `
      UPDATE tbl_invoices
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
      module_name: "Invoice",
      record_id: id,
      description: `Invoice ${invoice.invoice_number} cancelled`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({
      company_id: companyId,
    });

    return res.json({
      success: true,
      message: "Invoice cancelled successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to cancel invoice",
      error: error.message,
    });
  }
};

export const downloadInvoice = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const authToken = req.headers.authorization;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid invoice id is required" });
    }

    const data = await getInvoiceDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const { invoice } = data;

    const { pdfBuffer } = await getSavedDocumentPDFBuffer({
      type: "invoice",
      document: invoice,
      companyId,
      authToken,
    });

    await createAuditLog({
      company_id: companyId,
      user_id: req.user.id,
      role: req.user.role,
      action: "DOWNLOAD",
      module_name: "Invoice",
      record_id: id,
      description: `Invoice ${invoice.invoice_number} PDF downloaded`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${invoice.invoice_number}.pdf`,
    );

    return res.end(pdfBuffer);
  } catch (error) {
    console.error("DOWNLOAD INVOICE PDF ERROR:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Invoice PDF download failed",
        error: error.message,
      });
    }
  }
};

export const sendInvoiceEmail = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const authToken = req.headers.authorization;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid invoice id is required" });
    }

    const data = await getInvoiceDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const { invoice } = data;

    if (!invoice.email) {
      return res.status(400).json({
        message: "Customer email not found",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled invoice cannot be emailed",
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
      return res.status(404).json({
        message: "Company not found",
      });
    }

    const company = companyRows[0];

    const { pdfBuffer } = await getSavedDocumentPDFBuffer({
      type: "invoice",
      document: invoice,
      companyId,
      authToken,
    });

    const subject = `Invoice ${invoice.invoice_number} from ${
      company.name || invoice.business_name || "Company"
    }`;

    const html = `
<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#111827">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">

    <div style="padding:22px 24px;background:#0f172a;color:#ffffff">
      <h2 style="margin:0;font-size:20px">
        Invoice ${invoice.invoice_number}
      </h2>

      <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1">
        From ${company.name || invoice.business_name || "Company"}
      </p>
    </div>

    <div style="padding:24px">

      <p style="margin:0 0 14px">
        Hello ${invoice.customer_name || "Customer"},
      </p>

      <p style="margin:0 0 18px;line-height:1.6">
        Please find your invoice details below.
        Your invoice PDF is attached with this email.
      </p>

      <table
        style="width:100%;border-collapse:collapse;margin:18px 0"
      >

        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">
            Invoice Number
          </td>

          <td
            style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700"
          >
            ${invoice.invoice_number}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">
            Invoice Date
          </td>

          <td
            style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right"
          >
            ${invoice.invoice_date || "-"}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">
            Due Date
          </td>

          <td
            style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right"
          >
            ${invoice.due_date || "-"}
          </td>
        </tr>

        ${
          invoice.branch_name
            ? `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#64748b">
            Branch
          </td>

          <td
            style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right"
          >
            ${invoice.branch_name}
          </td>
        </tr>
        `
            : ""
        }

        <tr>
          <td style="padding:10px;color:#64748b">
            Total Amount
          </td>

          <td
            style="padding:10px;text-align:right;font-size:18px;font-weight:800"
          >
            ₹${Number(invoice.total_amount || 0).toFixed(2)}
          </td>
        </tr>

      </table>

      <p style="margin:20px 0 0;line-height:1.6">
        Regards,<br/>
        <strong>
          ${company.name || invoice.business_name || "Company"}
        </strong>
      </p>

    </div>

    <div
      style="
        padding:14px 24px;
        background:#f8fafc;
        border-top:1px solid #e5e7eb;
        color:#64748b;
        font-size:12px;
      "
    >
      This email was sent from
      ${company.name || invoice.business_name || "Company"}.
    </div>

  </div>
</div>
`;

    await sendCompanyEmail({
      company,
      to: invoice.email,
      subject,
      html,
      text: `Invoice ${invoice.invoice_number} from ${
        company.name || invoice.business_name || "Company"
      }

Hello ${invoice.customer_name || "Customer"},

Please find your invoice details below.
The invoice PDF is attached with this email.

Invoice Number: ${invoice.invoice_number}
Invoice Date: ${invoice.invoice_date || "-"}
Due Date: ${invoice.due_date || "-"}
${invoice.branch_name ? `Branch: ${invoice.branch_name}` : ""}
Total Amount: ₹${Number(invoice.total_amount || 0).toFixed(2)}

Regards,
${company.name || invoice.business_name || "Company"}`,
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
      module_type: "invoice",
      reference_id: id,
    });

    if (!["paid", "partial", "cancelled"].includes(invoice.status)) {
      await db.query(
        `
        UPDATE tbl_invoices
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
      module_name: "Invoice",
      record_id: id,
      description: `Invoice ${invoice.invoice_number} emailed to ${invoice.email}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({
      company_id: companyId,
    });

    try {
      await notifyBusinessUsers({
        company_id: companyId,
        actor_id: req.user.id,
        title: "Invoice emailed",
        message: `Invoice ${invoice.invoice_number} emailed to ${invoice.email}`,
        module_name: "Invoice",
        record_id: id,
      });
    } catch (notificationError) {
      console.error(
        "Invoice email notification error:",
        notificationError.message,
      );
    }

    return res.json({
      success: true,
      message: "Invoice email sent successfully",
      status: !["paid", "partial", "cancelled"].includes(invoice.status)
        ? "sent"
        : invoice.status,
    });
  } catch (error) {
    console.error("SEND INVOICE EMAIL ERROR:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    return res.status(500).json({
      message: error.response || error.message || "Invoice email send failed",
    });
  }
};

export const pushInvoiceToCrm = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company id missing",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid invoice id is required",
      });
    }

    // 1. Invoice + customer data
    const data = await getInvoiceDocumentData(id, companyId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const { invoice } = data;

    if (!invoice.customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer not found for this invoice",
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

    // 3. Prepare customer data
    const customer = {
      id: invoice.customer_id,
      customer_name: invoice.customer_name || "",
      company_name: invoice.company_name || "",
      email: invoice.email || "",
    };

    // 4. CUSTOMER SYNC
    // CRM document ke according:
    // customer ko document se pehle sync karna mandatory hai.
    const customerCrmResponse = await syncCustomerToCrm({
      apiKey: crmApiKey,
      customer,
    });

    console.log("CRM CUSTOMER SYNC RESPONSE:", customerCrmResponse);

    // 5. Saved PDF path check
    const pdfPath = String(invoice.pdf_path || "").trim();

    if (!pdfPath) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice PDF is not available. Please generate the invoice PDF before pushing to CRM.",
      });
    }

    // 6. Public backend URL
    const backendPublicUrl = String(process.env.VITE_API_BASE_URL || "")
      .trim()
      .replace(/\/api+$/, "");

    if (!backendPublicUrl) {
      return res.status(500).json({
        success: false,
        message: "VITE_API_BASE_URL is not configured",
      });
    }

    const normalizedPdfPath = pdfPath.startsWith("/") ? pdfPath : `/${pdfPath}`;

    const pdfUrl = `${backendPublicUrl}${normalizedPdfPath}`;

    // Optional safety validation
    let parsedPdfUrl;

    try {
      parsedPdfUrl = new URL(pdfUrl);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Generated invoice PDF URL is invalid",
      });
    }

    if (!["http:", "https:"].includes(parsedPdfUrl.protocol)) {
      return res.status(500).json({
        success: false,
        message: "Invoice PDF URL must use HTTP or HTTPS",
      });
    }

    console.log("CRM INVOICE PDF URL:", pdfUrl);

    // 7. DOCUMENT SYNC
    const documentCrmResponse = await syncDocumentToCrm({
      apiKey: crmApiKey,

      externalType: "INVOICE",

      // Same invoice ko retry/update karne par
      // same externalId rahega.
      externalId: String(invoice.id),

      // Same customer ID jo Customer Sync me gaya.
      externalCustomerId: String(invoice.customer_id),

      pdfUrl,
    });

    console.log("CRM DOCUMENT SYNC RESPONSE:", documentCrmResponse);

    // 8. Final response to frontend
    return res.json({
      success: true,
      message: "Invoice pushed to CRM successfully",
    });
  } catch (error) {
    console.error("PUSH INVOICE TO CRM ERROR:", {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      crmResponse: error.crmResponse,
    });

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Invoice CRM sync failed",

      code: error.code || "CRM_SYNC_FAILED",
    });
  }
};
