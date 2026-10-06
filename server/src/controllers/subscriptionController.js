import db from "../config/db.js";
import transporter from "../utils/emailService.js";
import { createAuditLog } from "../utils/auditLogger.js";
import {
  notifyCompanyAdmins,
  notifySuperAdmins,
} from "../utils/notificationLoggers.js";
import PDFDocument from "pdfkit";

const allowedBillingCycles = ["1_month", "3_months", "6_months", "1_year"];

const validateBillingCycle = (billingCycle) => {
  return allowedBillingCycles.includes(billingCycle);
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatAmount = (amount) => {
  return Number(amount || 0).toFixed(2);
};

const formatCycle = (cycle) => {
  if (cycle === "1_month") return "1 Month";
  if (cycle === "3_months") return "3 Months";
  if (cycle === "6_months") return "6 Months";
  if (cycle === "1_year") return "1 Year";
  return cycle || "-";
};

const drawSubscriptionInvoicePdf = ({ doc, invoice }) => {
  const pageWidth = doc.page.width;
  const margin = 50;

  // Header
  doc.rect(0, 0, pageWidth, 115).fill("#0f172a");

  doc
    .fillColor("#ffffff")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("Smart Invoice SaaS", margin, 32);

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#cbd5e1")
    .text("Subscription Billing Invoice", margin, 62);

  doc
    .fontSize(26)
    .font("Helvetica-Bold")
    .fillColor("#ffffff")
    .text("INVOICE", 390, 32, { align: "right" });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#cbd5e1")
    .text(invoice.invoice_number || "-", 390, 65, { align: "right" });

  // Invoice status badge
  doc
    .roundedRect(margin, 140, 120, 30, 8)
    .fill(invoice.invoice_status === "paid" ? "#dcfce7" : "#ffedd5");

  doc
    .fillColor(invoice.invoice_status === "paid" ? "#15803d" : "#c2410c")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(
      String(invoice.invoice_status || "generated").toUpperCase(),
      margin,
      149,
      { width: 120, align: "center" },
    );

  // Bill To
  doc
    .fillColor("#0f172a")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("BILL TO", margin, 195);

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(invoice.company_name || "-", margin, 215);

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#64748b")
    .text("Company subscription billing", margin, 240);

  // Invoice details box
  const boxX = 340;
  const boxY = 180;

  doc
    .roundedRect(boxX, boxY, 205, 110, 12)
    .strokeColor("#e2e8f0")
    .lineWidth(1)
    .stroke();

  const detailRow = (label, value, y) => {
    doc
      .fillColor("#64748b")
      .fontSize(9)
      .font("Helvetica")
      .text(label, boxX + 15, y);

    doc
      .fillColor("#0f172a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(value || "-", boxX + 95, y);
  };

  detailRow(
    "Invoice Date",
    invoice.invoice_date
      ? new Date(invoice.invoice_date).toLocaleDateString("en-IN")
      : "-",
    boxY + 18,
  );

  detailRow(
    "Due Date",
    invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString("en-IN")
      : "-",
    boxY + 43,
  );

  detailRow("Billing Cycle", formatCycle(invoice.billing_cycle), boxY + 68);

  // Plan table header
  const tableY = 340;

  doc
    .roundedRect(margin, tableY, pageWidth - margin * 2, 38, 8)
    .fill("#f1f5f9");

  doc
    .fillColor("#334155")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("DESCRIPTION", margin + 18, tableY + 14)
    .text("AMOUNT", 430, tableY + 14, { width: 95, align: "right" });

  // Plan row
  doc
    .fillColor("#0f172a")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(invoice.plan_name || "Subscription Plan", margin + 18, tableY + 62);

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#64748b")
    .text(
      `SaaS subscription - ${formatCycle(invoice.billing_cycle)}`,
      margin + 18,
      tableY + 82,
    );

  doc
    .fillColor("#0f172a")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`INR ${formatAmount(invoice.amount)}`, 430, tableY + 66, {
      width: 95,
      align: "right",
    });

  doc
    .moveTo(margin, tableY + 120)
    .lineTo(pageWidth - margin, tableY + 120)
    .strokeColor("#e2e8f0")
    .stroke();

  // Total box
  doc.roundedRect(330, tableY + 145, 215, 72, 12).fill("#0f172a");

  doc
    .fillColor("#cbd5e1")
    .fontSize(10)
    .font("Helvetica")
    .text("TOTAL PAYABLE", 350, tableY + 162);

  doc
    .fillColor("#ffffff")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(`INR ${formatAmount(invoice.amount)}`, 350, tableY + 184);

  // Notes
  doc
    .fillColor("#0f172a")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Notes", margin, tableY + 165);

  doc
    .fillColor("#64748b")
    .fontSize(10)
    .font("Helvetica")
    .text(
      "This is a system generated subscription invoice. Please complete payment before the due date to activate or continue your subscription.",
      margin,
      tableY + 185,
      { width: 250, lineGap: 4 },
    );

  // Footer
  doc
    .moveTo(margin, 735)
    .lineTo(pageWidth - margin, 735)
    .strokeColor("#e2e8f0")
    .stroke();

  doc
    .fillColor("#94a3b8")
    .fontSize(9)
    .font("Helvetica")
    .text(
      "Generated by Smart Invoice & Billing Management System",
      margin,
      750,
      {
        align: "center",
        width: pageWidth - margin * 2,
      },
    );
};

// GET ALL PLANS
export const getPlans = async (req, res) => {
  try {
    const [plans] = await db.query(`
      SELECT *
      FROM tbl_subscription_plans
      ORDER BY price ASC
    `);

    return res.status(200).json(plans);
  } catch (error) {
    console.log("GET PLANS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
};

// CREATE PLAN
export const createPlan = async (req, res) => {
  try {
    const {
      plan_name,
      price,
      billing_cycle = "3_months",
      trial_days = 0,
      features,
      max_branches = 2,
    } = req.body;

    const finalPrice = toNumber(price);
    const finalTrialDays = toNumber(trial_days);
    const finalMaxBranches = toNumber(max_branches, 2);

    if (!plan_name?.trim()) {
      return res.status(400).json({ message: "Plan name is required" });
    }

    if (finalPrice <= 0) {
      return res.status(400).json({
        message: "Plan price must be greater than 0",
      });
    }

    if (!validateBillingCycle(billing_cycle)) {
      return res.status(400).json({ message: "Invalid billing cycle" });
    }

    if (finalTrialDays < 0) {
      return res.status(400).json({ message: "Trial days cannot be negative" });
    }

    if (finalMaxBranches <= 0) {
      return res.status(400).json({
        message: "Max branches must be greater than 0",
      });
    }

    const [planResult] = await db.query(
      `
      INSERT INTO tbl_subscription_plans
      (
        plan_name,
        price,
        billing_cycle,
        trial_days,
        max_companies,
        max_users,
        max_invoices,
        max_branches,
        features
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        plan_name.trim(),
        finalPrice,
        billing_cycle,
        finalTrialDays,
        1,
        1,
        999999,
        finalMaxBranches,
        features || "",
      ],
    );

    await createAuditLog({
      company_id: null,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription Plan",
      record_id: planResult.insertId,
      description: `Subscription plan ${plan_name.trim()} created`,
      ip_address: req.ip,
    });

    return res.status(201).json({ message: "Plan created successfully" });
  } catch (error) {
    console.log("CREATE PLAN ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Plan already exists" });
    }

    return res.status(500).json({
      message: "Failed to create plan",
      error: error.message,
    });
  }
};

// UPDATE PLAN
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      plan_name,
      price,
      billing_cycle = "3_months",
      trial_days = 0,
      features,
      status = "active",
      max_branches = 2,
    } = req.body;

    const finalPrice = toNumber(price);
    const finalTrialDays = toNumber(trial_days);
    const finalMaxBranches = toNumber(max_branches, 2);

    if (!plan_name?.trim()) {
      return res.status(400).json({ message: "Plan name is required" });
    }

    if (finalPrice <= 0) {
      return res.status(400).json({
        message: "Plan price must be greater than 0",
      });
    }

    if (!validateBillingCycle(billing_cycle)) {
      return res.status(400).json({ message: "Invalid billing cycle" });
    }

    if (finalTrialDays < 0) {
      return res.status(400).json({ message: "Trial days cannot be negative" });
    }

    if (finalMaxBranches <= 0) {
      return res.status(400).json({
        message: "Max branches must be greater than 0",
      });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_subscription_plans
      SET
        plan_name = ?,
        price = ?,
        billing_cycle = ?,
        trial_days = ?,
        max_branches = ?,
        features = ?,
        status = ?
      WHERE id = ?
      `,
      [
        plan_name.trim(),
        finalPrice,
        billing_cycle,
        finalTrialDays,
        finalMaxBranches,
        features || "",
        status || "active",
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    await createAuditLog({
      company_id: null,
      user_id: req.user?.id || null,
      action: "UPDATE",
      module_name: "Subscription Plan",
      record_id: id,
      description: `Subscription plan ${plan_name.trim()} updated`,
      ip_address: req.ip,
    });

    return res.status(200).json({ message: "Plan updated successfully" });
  } catch (error) {
    console.log("UPDATE PLAN ERROR:", error);
    return res.status(500).json({
      message: "Failed to update plan",
      error: error.message,
    });
  }
};

// GET COMPANY SUBSCRIPTIONS
export const getCompanySubscriptions = async (req, res) => {
  try {
    const [subscriptions] = await db.query(`
      SELECT
        cs.id,
        cs.company_id,
        cs.plan_id,
        cs.status,
        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        cs.created_at,
        c.name AS company_name,
        sp.plan_name,
        sp.price,
        sp.billing_cycle,
        sp.max_branches
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c ON cs.company_id = c.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      ORDER BY cs.id DESC
    `);

    return res.status(200).json(subscriptions);
  } catch (error) {
    console.log("GET SUBSCRIPTIONS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
};

export const getMyAllSubscriptions = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [rows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        cs.plan_id,
        cs.status,
        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        cs.created_at,

        sp.plan_name,
        sp.price,
        sp.billing_cycle,
        sp.features,
        sp.max_branches,

        latest_invoice.id AS latest_invoice_id,
        latest_invoice.invoice_number AS latest_invoice_number,
        latest_invoice.invoice_status AS latest_invoice_status,
        latest_invoice.amount AS latest_invoice_amount,
        latest_invoice.due_date AS latest_invoice_due_date,

        CASE
          WHEN cs.status = 'pending_payment' THEN 'Waiting for payment'
          WHEN cs.status = 'active' THEN 'Current active plan'
          WHEN cs.status = 'trial' THEN 'Trial plan'
          WHEN cs.status = 'cancelled' THEN 'Previous plan'
          WHEN cs.status = 'expired' THEN 'Expired plan'
          ELSE cs.status
        END AS display_status
      FROM tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id

      LEFT JOIN (
        SELECT
          si1.*
        FROM tbl_subscription_invoices si1
        INNER JOIN (
          SELECT subscription_id, MAX(id) AS max_invoice_id
          FROM tbl_subscription_invoices
          GROUP BY subscription_id
        ) si2
          ON si1.id = si2.max_invoice_id
      ) latest_invoice
        ON latest_invoice.subscription_id = cs.id

      WHERE cs.company_id = ?
      ORDER BY cs.id DESC
      `,
      [companyId],
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.log("GET MY ALL SUBSCRIPTIONS ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch subscriptions",
      error: error.message,
    });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `
      UPDATE tbl_subscription_plans
      SET status = 'inactive'
      WHERE id = ?
      `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    await createAuditLog({
      company_id: null,
      user_id: req.user?.id || null,
      action: "DELETE",
      module_name: "Subscription Plan",
      record_id: id,
      description: "Subscription plan deactivated",
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Plan deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to deactivate plan",
      error: error.message,
    });
  }
};

export const buySubscriptionPlan = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const companyId = req.user.company_id;
    const { plan_id } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!plan_id) {
      return res.status(400).json({ message: "Plan is required" });
    }

    await connection.beginTransaction();

    const [unpaidInvoices] = await connection.query(
      `
      SELECT id
      FROM tbl_subscription_invoices
      WHERE company_id = ?
      AND invoice_status != 'paid'
      LIMIT 1
      `,
      [companyId],
    );

    if (unpaidInvoices.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Please pay existing subscription invoice first",
      });
    }

    const [plans] = await connection.query(
      `
      SELECT *
      FROM tbl_subscription_plans
      WHERE id = ?
      AND status = 'active'
      LIMIT 1
      `,
      [plan_id],
    );

    if (plans.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Active plan not found" });
    }

    const plan = plans[0];

    const [existingPending] = await connection.query(
      `
      SELECT cs.id, si.invoice_number
      FROM tbl_company_subscriptions cs
      LEFT JOIN tbl_subscription_invoices si
        ON si.subscription_id = cs.id
        AND si.invoice_status != 'paid'
      WHERE cs.company_id = ?
      AND cs.plan_id = ?
      AND cs.status = 'pending_payment'
      LIMIT 1
      `,
      [companyId, plan_id],
    );

    if (existingPending.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "An unpaid invoice for this plan already exists",
      });
    }

    const [subscriptionResult] = await connection.query(
      `
      INSERT INTO tbl_company_subscriptions
      (
        company_id,
        plan_id,
        status,
        start_date,
        trial_end_date,
        renewal_date,
        auto_renewal
      )
      VALUES (?, ?, 'pending_payment', CURDATE(), NULL, NULL, 1)
      `,
      [companyId, plan_id],
    );

    const subscriptionId = subscriptionResult.insertId;
    const invoiceNumber = `SUB-INV-${Date.now()}`;

    const [invoiceResult] = await connection.query(
      `
      INSERT INTO tbl_subscription_invoices
      (
        subscription_id,
        company_id,
        invoice_number,
        amount,
        invoice_status,
        invoice_date,
        due_date
      )
      VALUES (?, ?, ?, ?, 'generated', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY))
      `,
      [subscriptionId, companyId, invoiceNumber, plan.price],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription",
      record_id: subscriptionId,
      description: `Pending payment subscription created for ${plan.plan_name}. Invoice ${invoiceNumber} generated`,
      ip_address: req.ip,
    });

    await notifyCompanyAdmins({
      company_id: companyId,
      exclude_user_id: req.user.id,
      type: "subscription",
      severity: "medium",
      title: "Subscription Invoice Generated",
      message: `Invoice generated for ${plan.plan_name}.`,
    });

    await connection.commit();

    return res.status(201).json({
      message: "Subscription invoice generated successfully",
      subscription_id: subscriptionId,
      invoice_id: invoiceResult.insertId,
      invoice_number: invoiceNumber,
    });
  } catch (error) {
    await connection.rollback();

    console.log("BUY SUBSCRIPTION PLAN ERROR:", error);

    return res.status(500).json({
      message: "Failed to buy subscription plan",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
export const downloadMySubscriptionInvoice = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [rows] = await db.query(
      `
      SELECT
        si.id,
        si.invoice_number,
        si.amount,
        si.invoice_status,
        si.invoice_date,
        si.due_date,
        c.name AS company_name,
        sp.plan_name,
        sp.billing_cycle
      FROM tbl_subscription_invoices si
      JOIN tbl_companies c ON si.company_id = c.id
      JOIN tbl_company_subscriptions cs ON si.subscription_id = cs.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE si.id = ?
      AND si.company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const invoice = rows[0];

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoice_number || "subscription-invoice"}.pdf"`,
    );

    doc.pipe(res);

    drawSubscriptionInvoicePdf({
      doc,
      invoice,
    });

    doc.end();
  } catch (error) {
    console.log("DOWNLOAD SUBSCRIPTION INVOICE ERROR:", error);
    return res.status(500).json({
      message: "Failed to download subscription invoice",
      error: error.message,
    });
  }
};

export const downloadSubscriptionInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        si.id,
        si.invoice_number,
        si.amount,
        si.invoice_status,
        si.invoice_date,
        si.due_date,
        c.name AS company_name,
        sp.plan_name,
        sp.billing_cycle
      FROM tbl_subscription_invoices si
      JOIN tbl_companies c ON si.company_id = c.id
      JOIN tbl_company_subscriptions cs ON si.subscription_id = cs.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE si.id = ?
      LIMIT 1
      `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const invoice = rows[0];

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoice_number || "subscription-invoice"}.pdf"`,
    );

    doc.pipe(res);

    drawSubscriptionInvoicePdf({
      doc,
      invoice,
    });

    doc.end();
  } catch (error) {
    console.log("DOWNLOAD SUPERADMIN SUBSCRIPTION INVOICE ERROR:", error);
    return res.status(500).json({
      message: "Failed to download subscription invoice",
      error: error.message,
    });
  }
};

export const downloadMyPaymentReceipt = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [rows] = await db.query(
      `
      SELECT
        spay.id,
        spay.amount,
        spay.payment_status,
        spay.payment_method,
        spay.transaction_id,
        spay.payment_date,
        c.name AS company_name,
        plan.plan_name
      FROM tbl_subscription_payments spay
      JOIN tbl_companies c ON spay.company_id = c.id
      JOIN tbl_company_subscriptions cs ON spay.subscription_id = cs.id
      JOIN tbl_subscription_plans plan ON cs.plan_id = plan.id
      WHERE spay.id = ?
      AND spay.company_id = ?
      LIMIT 1
      `,
      [id, companyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Payment receipt not found" });
    }

    const payment = rows[0];

    const receiptNumber = `SUB-REC-${String(payment.id).padStart(5, "0")}`;

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${receiptNumber}.pdf"`,
    );

    doc.pipe(res);

    doc.fontSize(22).text("Subscription Payment Receipt", {
      align: "center",
    });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Receipt No: ${receiptNumber}`);
    doc.text(`Company: ${payment.company_name || "-"}`);
    doc.text(`Plan: ${payment.plan_name || "-"}`);
    doc.text(
      `Payment Date: ${
        payment.payment_date
          ? new Date(payment.payment_date).toLocaleDateString("en-IN")
          : "-"
      }`,
    );
    doc.text(`Payment Method: ${payment.payment_method || "-"}`);
    doc.text(`Transaction ID: ${payment.transaction_id || "-"}`);
    doc.text(`Status: ${payment.payment_status || "-"}`);

    doc.moveDown();
    doc.fontSize(16).text(`Paid Amount: ₹${formatAmount(payment.amount)}`);

    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray");
    doc.text("This is a system generated subscription payment receipt.");

    doc.end();
  } catch (error) {
    console.log("DOWNLOAD PAYMENT RECEIPT ERROR:", error);
    return res.status(500).json({
      message: "Failed to download payment receipt",
      error: error.message,
    });
  }
};

// ASSIGN SUBSCRIPTION
export const assignSubscription = async (req, res) => {
  try {
    const { company_id, plan_id, auto_renewal } = req.body;

    if (!company_id || !plan_id) {
      return res.status(400).json({
        message: "Company and plan are required",
      });
    }

    const [plans] = await db.query(
      `
      SELECT *
      FROM tbl_subscription_plans
      WHERE id = ?
      LIMIT 1
      `,
      [plan_id],
    );

    if (plans.length === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const [companyRows] = await db.query(
      `
      SELECT id, name
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [company_id],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [existing] = await db.query(
      `
      SELECT id
      FROM tbl_company_subscriptions
      WHERE company_id = ?
      AND status IN ('trial', 'active')
      LIMIT 1
      `,
      [company_id],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Company already has an active subscription",
      });
    }

    const plan = plans[0];

    const [subscriptionResult] = await db.query(
      `
  INSERT INTO tbl_company_subscriptions
  (
    company_id,
    plan_id,
    status,
    start_date,
    trial_end_date,
    renewal_date,
    auto_renewal
  )
  VALUES
  (
    ?, ?,
    'pending_payment',
    CURDATE(),
    NULL,
    NULL,
    ?
  )
  `,
      [company_id, plan_id, Number(auto_renewal) === 0 ? 0 : 1],
    );

    await createAuditLog({
      company_id,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription",
      record_id: subscriptionResult.insertId,
      description: `Subscription ${plan.plan_name} assigned to ${companyRows[0].name}`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Subscription assigned. Generate invoice to activate.",
    });
  } catch (error) {
    console.log("ASSIGN SUBSCRIPTION ERROR:", error);
    return res.status(500).json({ message: "Failed to assign subscription" });
  }
};

// CHANGE PLAN
export const changeSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({ message: "Plan is required" });
    }

    const [plans] = await db.query(
      `
      SELECT *
      FROM tbl_subscription_plans
      WHERE id = ?
      LIMIT 1
      `,
      [plan_id],
    );

    if (plans.length === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        c.name AS company_name,
        sp.plan_name AS old_plan_name
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c ON cs.company_id = c.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.id = ?
      LIMIT 1
      `,
      [id],
    );

    if (subscriptionRows.length === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const plan = plans[0];
    const subscription = subscriptionRows[0];

    const [result] = await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET
        plan_id = ?,
        status = 'active',
        renewal_date = CASE
          WHEN ? = '1_month' THEN DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
          WHEN ? = '3_months' THEN DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
          WHEN ? = '6_months' THEN DATE_ADD(CURDATE(), INTERVAL 6 MONTH)
          WHEN ? = '1_year' THEN DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
          ELSE renewal_date
        END
      WHERE id = ?
      `,
      [
        plan_id,
        plan.billing_cycle,
        plan.billing_cycle,
        plan.billing_cycle,
        plan.billing_cycle,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    await createAuditLog({
      company_id: subscription.company_id,
      user_id: req.user?.id || null,
      action: "UPDATE",
      module_name: "Subscription",
      record_id: id,
      description: `Subscription plan changed from ${subscription.old_plan_name} to ${plan.plan_name}`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Subscription plan changed successfully",
    });
  } catch (error) {
    console.log("CHANGE PLAN ERROR:", error);
    return res.status(500).json({
      message: "Failed to change subscription plan",
      error: error.message,
    });
  }
};

// TOGGLE AUTO RENEWAL
export const toggleAutoRenewal = async (req, res) => {
  try {
    const { id } = req.params;
    const { auto_renewal } = req.body;

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        sp.plan_name
      FROM tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE cs.id = ?
      LIMIT 1
      `,
      [id],
    );

    if (subscriptionRows.length === 0) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    const subscription = subscriptionRows[0];

    // SECURITY CHECK
    if (
      req.user.role !== "superadmin" &&
      subscription.company_id !== req.user.company_id
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const newAutoRenewal = Number(auto_renewal) === 1 ? 1 : 0;

    const [result] = await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET auto_renewal = ?
      WHERE id = ?
      `,
      [newAutoRenewal, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    await createAuditLog({
      company_id: subscription.company_id,
      user_id: req.user?.id || null,
      action: "UPDATE",
      module_name: "Subscription",
      record_id: id,
      description: `Auto renewal ${
        newAutoRenewal ? "enabled" : "disabled"
      } for ${subscription.plan_name}`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Auto renewal updated successfully",
    });
  } catch (error) {
    console.log("AUTO RENEWAL ERROR:", error);

    return res.status(500).json({
      message: "Failed to update auto renewal",
    });
  }
};

// RECORD PAYMENT
export const recordSubscriptionPayment = async (req, res) => {
  try {
    const {
      subscription_id,
      company_id,
      amount,
      payment_status,
      payment_method,
      transaction_id,
    } = req.body;

    if (!subscription_id || !company_id || !amount) {
      return res.status(400).json({
        message: "Subscription, company and amount are required",
      });
    }

    const finalAmount = toNumber(amount);

    if (finalAmount <= 0) {
      return res.status(400).json({
        message: "Payment amount must be greater than 0",
      });
    }

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        c.name AS company_name,
        sp.plan_name,
        sp.billing_cycle
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c ON cs.company_id = c.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.id = ?
      AND cs.company_id = ?
      LIMIT 1
      `,
      [subscription_id, company_id],
    );

    if (subscriptionRows.length === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const [paymentResult] = await db.query(
      `
      INSERT INTO tbl_subscription_payments
      (
        subscription_id,
        company_id,
        amount,
        payment_status,
        payment_method,
        transaction_id,
        payment_date
      )
      VALUES (?, ?, ?, ?, ?, ?, CURDATE())
      `,
      [
        subscription_id,
        company_id,
        finalAmount,
        payment_status || "paid",
        payment_method || "manual",
        transaction_id || null,
      ],
    );

    if (!payment_status || payment_status === "paid") {
      await db.query(
        `
        UPDATE tbl_company_subscriptions cs
        JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
        SET cs.status = 'active',
            cs.renewal_date = CASE
              WHEN sp.billing_cycle = '1_month' THEN DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
              WHEN sp.billing_cycle = '3_months' THEN DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
              WHEN sp.billing_cycle = '6_months' THEN DATE_ADD(CURDATE(), INTERVAL 6 MONTH)
              WHEN sp.billing_cycle = '1_year' THEN DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
              ELSE cs.renewal_date
            END
        WHERE cs.id = ?
        `,
        [subscription_id],
      );
    }

    await createAuditLog({
      company_id,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription Payment",
      record_id: paymentResult.insertId,
      description: `Subscription payment ₹${formatAmount(finalAmount)} recorded for ${subscriptionRows[0].plan_name}`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Payment recorded successfully",
    });
  } catch (error) {
    console.log("RECORD PAYMENT ERROR:", error);
    return res.status(500).json({ message: "Failed to record payment" });
  }
};

// GET PAYMENTS
export const getSubscriptionPayments = async (req, res) => {
  try {
    const [payments] = await db.query(`
      SELECT
        spay.id,
        spay.subscription_id,
        spay.company_id,
        spay.amount,
        spay.payment_status,
        spay.payment_method,
        spay.transaction_id,
        spay.payment_date,
        spay.created_at,
        c.name AS company_name,
        plan.plan_name
      FROM tbl_subscription_payments spay
      JOIN tbl_companies c ON spay.company_id = c.id
      JOIN tbl_company_subscriptions cs ON spay.subscription_id = cs.id
      JOIN tbl_subscription_plans plan ON cs.plan_id = plan.id
      ORDER BY spay.id DESC
    `);

    return res.status(200).json(payments);
  } catch (error) {
    console.log("GET PAYMENTS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch payments" });
  }
};

// GENERATE SUBSCRIPTION INVOICE
export const generateSubscriptionInvoice = async (req, res) => {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        message: "Subscription is required",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        cs.id AS subscription_id,
        cs.company_id,
        sp.plan_name,
        sp.price
      FROM tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.id = ?
      LIMIT 1
      `,
      [subscription_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    const [existingInvoice] = await db.query(
      `
  SELECT id
  FROM tbl_subscription_invoices
  WHERE subscription_id = ?
  AND invoice_status != 'paid'
  LIMIT 1
  `,
      [subscription_id],
    );

    if (existingInvoice.length > 0) {
      return res.status(400).json({
        message: "Unpaid invoice already exists for this subscription",
      });
    }

    const subscription = rows[0];
    const invoiceNumber = `SUB-INV-${Date.now()}`;

    const [invoiceResult] = await db.query(
      `
      INSERT INTO tbl_subscription_invoices
      (
        subscription_id,
        company_id,
        invoice_number,
        amount,
        invoice_date,
        due_date
      )
      VALUES (?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY))
      `,
      [
        subscription.subscription_id,
        subscription.company_id,
        invoiceNumber,
        subscription.price,
      ],
    );

    await createAuditLog({
      company_id: subscription.company_id,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription Invoice",
      record_id: invoiceResult.insertId,
      description: `Subscription invoice ${invoiceNumber} generated for ${subscription.plan_name}`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Subscription invoice generated successfully",
      invoice_number: invoiceNumber,
    });
  } catch (error) {
    console.log("GENERATE INVOICE ERROR:", error);
    return res.status(500).json({ message: "Failed to generate invoice" });
  }
};

// GET INVOICES
export const getSubscriptionInvoices = async (req, res) => {
  try {
    const [invoices] = await db.query(`
      SELECT
        si.id,
        si.subscription_id,
        si.company_id,
        si.invoice_number,
        si.amount,
        si.invoice_status,
        si.invoice_date,
        si.due_date,
        si.created_at,
        c.name AS company_name,
        sp.plan_name
      FROM tbl_subscription_invoices si
      JOIN tbl_companies c ON si.company_id = c.id
      JOIN tbl_company_subscriptions cs ON si.subscription_id = cs.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      ORDER BY si.id DESC
    `);

    return res.status(200).json(invoices);
  } catch (error) {
    console.log("GET INVOICES ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch subscription invoices",
    });
  }
};

// COMPANY SIDE: GET CURRENT SUBSCRIPTION
export const getMySubscription = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [rows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        cs.plan_id,
        cs.status,
        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        cs.created_at,

        cs.trial_extension_requested,
        cs.trial_extension_status,
        cs.trial_extension_used,
        cs.trial_extension_requested_at,
        cs.trial_extension_approved_at,
        cs.trial_extension_approved_by,

        sp.plan_name,
        sp.price,
        sp.billing_cycle,
        sp.trial_days,
        sp.max_branches,
        sp.features
      FROM tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE cs.company_id = ?
      AND cs.status IN ('trial', 'active', 'pending_payment', 'expired')
      ORDER BY
        CASE
          WHEN cs.status = 'active' THEN 1
          WHEN cs.status = 'trial' THEN 2
          WHEN cs.status = 'pending_payment' THEN 3
          WHEN cs.status = 'expired' THEN 4
          ELSE 5
        END,
        cs.id DESC
      LIMIT 1
      `,
      [companyId],
    );

    return res.status(200).json(rows[0] || null);
  } catch (error) {
    console.log("GET MY SUBSCRIPTION ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch company subscription",
      error: error.message,
    });
  }
};

// COMPANY SIDE: GET OWN SUBSCRIPTION INVOICES
export const getMySubscriptionInvoices = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [invoices] = await db.query(
      `
      SELECT
        si.id,
        si.subscription_id,
        si.company_id,
        si.invoice_number,
        si.amount,
        si.invoice_status,
        si.invoice_date,
        si.due_date,
        si.created_at,
        sp.plan_name
      FROM tbl_subscription_invoices si
      JOIN tbl_company_subscriptions cs ON si.subscription_id = cs.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE si.company_id = ?
      ORDER BY si.id DESC
      `,
      [companyId],
    );

    return res.status(200).json(invoices);
  } catch (error) {
    console.log("GET MY SUBSCRIPTION INVOICES ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch subscription invoices",
    });
  }
};

// COMPANY SIDE: GET OWN SUBSCRIPTION PAYMENTS
export const getMySubscriptionPayments = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [payments] = await db.query(
      `
      SELECT
        spay.id,
        spay.subscription_id,
        spay.company_id,
        spay.amount,
        spay.payment_status,
        spay.payment_method,
        spay.transaction_id,
        spay.payment_date,
        spay.created_at,
        plan.plan_name
      FROM tbl_subscription_payments spay
      JOIN tbl_company_subscriptions cs ON spay.subscription_id = cs.id
      JOIN tbl_subscription_plans plan ON cs.plan_id = plan.id
      WHERE spay.company_id = ?
      ORDER BY spay.id DESC
      `,
      [companyId],
    );

    return res.status(200).json(payments);
  } catch (error) {
    console.log("GET MY SUBSCRIPTION PAYMENTS ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch subscription payments",
    });
  }
};

// COMPANY SIDE: PAY OWN SUBSCRIPTION INVOICE
export const payMySubscriptionInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const companyId = req.user.company_id;
    const {
      invoice_id,
      payment_method = "manual",
      transaction_id = null,
    } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    if (!invoice_id) {
      return res.status(400).json({ message: "Invoice is required" });
    }

    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      `
      SELECT
        si.id,
        si.subscription_id,
        si.company_id,
        si.invoice_number,
        si.amount,
        si.invoice_status,
        cs.status AS subscription_status,
        sp.plan_name,
        sp.billing_cycle
      FROM tbl_subscription_invoices si
      JOIN tbl_company_subscriptions cs
        ON si.subscription_id = cs.id
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE si.id = ?
      AND si.company_id = ?
      LIMIT 1
      `,
      [invoice_id, companyId],
    );

    if (!invoiceRows.length) {
      await connection.rollback();
      return res.status(404).json({
        message: "Subscription invoice not found",
      });
    }

    const invoice = invoiceRows[0];

    if (invoice.invoice_status === "paid") {
      await connection.rollback();
      return res.status(400).json({
        message: "Invoice already paid",
      });
    }

    const [paymentResult] = await connection.query(
      `
      INSERT INTO tbl_subscription_payments
      (
        subscription_id,
        company_id,
        amount,
        payment_status,
        payment_method,
        transaction_id,
        payment_date
      )
      VALUES (?, ?, ?, 'paid', ?, ?, CURDATE())
      `,
      [
        invoice.subscription_id,
        companyId,
        invoice.amount,
        payment_method,
        transaction_id,
      ],
    );

    await connection.query(
      `
      UPDATE tbl_subscription_invoices
      SET invoice_status = 'paid'
      WHERE id = ?
      AND company_id = ?
      `,
      [invoice_id, companyId],
    );

    await connection.query(
      `
      UPDATE tbl_company_subscriptions
      SET status = 'cancelled'
      WHERE company_id = ?
      AND id != ?
      AND status IN ('trial', 'active', 'pending_payment', 'expired')
      `,
      [companyId, invoice.subscription_id],
    );

    await connection.query(
      `
      UPDATE tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      SET
        cs.status = 'active',
        cs.renewal_date = CASE
          WHEN sp.billing_cycle = '1_month'
            THEN DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
          WHEN sp.billing_cycle = '3_months'
            THEN DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
          WHEN sp.billing_cycle = '6_months'
            THEN DATE_ADD(CURDATE(), INTERVAL 6 MONTH)
          WHEN sp.billing_cycle = '1_year'
            THEN DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
          ELSE cs.renewal_date
        END
      WHERE cs.id = ?
      AND cs.company_id = ?
      `,
      [invoice.subscription_id, companyId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription Payment",
      record_id: paymentResult.insertId,
      description: `Subscription invoice ${invoice.invoice_number} paid for ${invoice.plan_name}`,
      ip_address: req.ip,
    });

    await createAuditLog({
      company_id: companyId,
      user_id: req.user?.id || null,
      action: "UPDATE",
      module_name: "Subscription",
      record_id: invoice.subscription_id,
      description: `Subscription ${invoice.plan_name} activated after payment`,
      ip_address: req.ip,
    });

    await notifyCompanyAdmins({
      company_id: companyId,
      type: "subscription",
      exclude_user_id: req.user.id,
      severity: "medium",
      title: "Subscription Activated",
      message: `${invoice.plan_name} subscription activated.`,
    });

    await connection.commit();

    return res.status(200).json({
      message: "Subscription payment completed and plan activated successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.log("PAY MY SUBSCRIPTION ERROR:", error);

    return res.status(500).json({
      message: "Failed to pay subscription invoice",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const requestTrialExtension = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID missing" });
    }

    const [rows] = await db.query(
      `
      SELECT id, status, trial_extension_used, trial_extension_status
      FROM tbl_company_subscriptions
      WHERE company_id = ?
      AND status = 'expired'
      ORDER BY id DESC
      LIMIT 1
      `,
      [companyId],
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: "Trial extension can be requested only after trial expiry",
      });
    }

    const subscription = rows[0];

    if (Number(subscription.trial_extension_used) === 1) {
      return res.status(400).json({
        message: "Trial extension has already been used",
      });
    }

    if (subscription.trial_extension_status === "pending") {
      return res.status(400).json({
        message: "Trial extension request is already pending",
      });
    }

    await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET
        trial_extension_requested = 1,
        trial_extension_status = 'pending',
        trial_extension_requested_at = NOW()
      WHERE id = ?
      `,
      [subscription.id],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: userId,
      action: "TRIAL_EXTENSION_REQUESTED",
      module_name: "Subscription",
      record_id: subscription.id,
      description: "Company Admin requested a 10-day trial extension",
      ip_address: req.ip,
    });

    await notifySuperAdmins({
      type: "subscription",
      severity: "high",
      title: "Trial Extension Requested",
      message: "A company has requested a trial extension.",
    });

    return res.status(200).json({
      message: "Trial extension request submitted successfully",
    });
  } catch (error) {
    console.log("REQUEST TRIAL EXTENSION ERROR:", error);
    return res.status(500).json({
      message: "Failed to request trial extension",
      error: error.message,
    });
  }
};

export const getTrialExtensionRequests = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        cs.status,
        cs.start_date,
        cs.trial_end_date,
        cs.trial_extension_requested,
        cs.trial_extension_status,
        cs.trial_extension_used,
        cs.trial_extension_requested_at,
        cs.trial_extension_approved_at,
        c.name AS company_name,
        c.email AS company_email,
        sp.plan_name
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c ON cs.company_id = c.id
      JOIN tbl_subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.trial_extension_requested = 1
      ORDER BY cs.trial_extension_requested_at DESC, cs.id DESC
      `,
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.log("GET TRIAL EXTENSION REQUESTS ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch trial extension requests",
      error: error.message,
    });
  }
};

export const approveTrialExtension = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const superAdminId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT id, company_id, status, trial_end_date, trial_extension_used, trial_extension_status
      FROM tbl_company_subscriptions
      WHERE id = ?
      LIMIT 1
      `,
      [subscriptionId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const subscription = rows[0];

    if (subscription.status !== "expired") {
      return res.status(400).json({
        message: "Only expired trial subscriptions can be extended",
      });
    }

    if (subscription.trial_extension_status !== "pending") {
      return res.status(400).json({
        message: "No pending trial extension request found",
      });
    }

    if (Number(subscription.trial_extension_used) === 1) {
      return res.status(400).json({
        message: "Trial extension has already been used",
      });
    }

    await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET
        status = 'trial',
        trial_end_date = DATE_ADD(CURDATE(), INTERVAL 10 DAY),
        trial_extension_status = 'approved',
        trial_extension_used = 1,
        trial_extension_approved_at = NOW(),
        trial_extension_approved_by = ?
      WHERE id = ?
      `,
      [superAdminId, subscriptionId],
    );

    await createAuditLog({
      company_id: subscription.company_id,
      user_id: superAdminId,
      action: "TRIAL_EXTENSION_APPROVED",
      module_name: "Subscription",
      record_id: subscriptionId,
      description: "SuperAdmin approved 10-day trial extension",
      ip_address: req.ip,
    });

    await notifyCompanyAdmins({
      company_id: subscription.company_id,
      exclude_user_id: req.user.id,
      type: "subscription",
      severity: "medium",
      title: "Trial Extension Approved",
      message: "Your trial extension has been approved.",
    });

    return res.status(200).json({
      message: "Trial extension approved successfully",
    });
  } catch (error) {
    console.log("APPROVE TRIAL EXTENSION ERROR:", error);
    return res.status(500).json({
      message: "Failed to approve trial extension",
      error: error.message,
    });
  }
};

export const rejectTrialExtension = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const superAdminId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT id, company_id, trial_extension_status
      FROM tbl_company_subscriptions
      WHERE id = ?
      LIMIT 1
      `,
      [subscriptionId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const subscription = rows[0];

    if (subscription.trial_extension_status !== "pending") {
      return res.status(400).json({
        message: "No pending trial extension request found",
      });
    }

    await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET trial_extension_status = 'rejected'
      WHERE id = ?
      `,
      [subscriptionId],
    );

    await createAuditLog({
      company_id: subscription.company_id,
      user_id: superAdminId,
      action: "TRIAL_EXTENSION_REJECTED",
      module_name: "Subscription",
      record_id: subscriptionId,
      description: "SuperAdmin rejected trial extension request",
      ip_address: req.ip,
    });

    await notifyCompanyAdmins({
      company_id: subscription.company_id,
      exclude_user_id: req.user.id,
      type: "subscription",
      severity: "high",
      title: "Trial Extension Rejected",
      message: "Your trial extension request has been rejected.",
    });

    return res.status(200).json({
      message: "Trial extension rejected successfully",
    });
  } catch (error) {
    console.log("REJECT TRIAL EXTENSION ERROR:", error);
    return res.status(500).json({
      message: "Failed to reject trial extension",
      error: error.message,
    });
  }
};
