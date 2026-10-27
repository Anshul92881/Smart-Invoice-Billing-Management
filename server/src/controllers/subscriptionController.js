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

const allowedPlanTypes = ["free", "paid"];
const allowedDurationUnits = ["day", "month", "year"];
const allowedPlanStatuses = ["active", "inactive"];

const buildBillingCycle = (durationValue, durationUnit) => {
  const pluralSuffix = durationValue === 1 ? "" : "s";
  return `${durationValue}_${durationUnit}${pluralSuffix}`;
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
  const pageHeight = doc.page.height;
  const margin = 50;
  const right = pageWidth - margin;
  const contentWidth = pageWidth - margin * 2;

  const colors = {
    dark: "#0f172a",
    slate: "#334155",
    muted: "#64748b",
    light: "#cbd5e1",
    border: "#e2e8f0",
    surface: "#f8fafc",
    tableHead: "#f1f5f9",
    accent: "#6366f1",
    footer: "#94a3b8",
  };

  const isPaid = invoice.invoice_status === "paid";

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString("en-IN") : "-";

  // ---------- Header ----------
  doc.rect(0, 0, pageWidth, 110).fill(colors.dark);
  doc.rect(0, 110, pageWidth, 4).fill(colors.accent);

  doc
    .fillColor("#ffffff")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("Smart Invoice SaaS", margin, 34, { lineBreak: false });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(colors.light)
    .text("Subscription Billing Invoice", margin, 64, { lineBreak: false });

  doc
    .fontSize(26)
    .font("Helvetica-Bold")
    .fillColor("#ffffff")
    .text("INVOICE", right - 220, 30, {
      width: 220,
      align: "right",
      lineBreak: false,
    });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(colors.light)
    .text(invoice.invoice_number || "-", right - 220, 66, {
      width: 220,
      align: "right",
      lineBreak: false,
    });

  // ---------- Bill To (left column) ----------
  const topY = 145;

  doc
    .fillColor(colors.muted)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("BILL TO", margin, topY, { characterSpacing: 1, lineBreak: false });

  doc
    .fillColor(colors.dark)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(invoice.company_name || "-", margin, topY + 18, {
      width: 250,
      height: 20,
      ellipsis: true,
    });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(colors.muted)
    .text("Company subscription billing", margin, topY + 42, {
      lineBreak: false,
    });

  // Status badge (pill)
  const badgeY = topY + 68;
  doc
    .roundedRect(margin, badgeY, 110, 26, 13)
    .fill(isPaid ? "#dcfce7" : "#ffedd5");

  doc
    .fillColor(isPaid ? "#15803d" : "#c2410c")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(
      String(invoice.invoice_status || "generated").toUpperCase(),
      margin,
      badgeY + 8,
      { width: 110, align: "center", lineBreak: false },
    );

  // ---------- Invoice details card (right column) ----------
  const cardW = 220;
  const cardX = right - cardW;
  const cardH = 100;

  doc
    .roundedRect(cardX, topY, cardW, cardH, 12)
    .fillAndStroke(colors.surface, colors.border);

  const detailRow = (label, value, y) => {
    doc
      .fillColor(colors.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(label, cardX + 16, y, { width: 80, lineBreak: false });

    doc
      .fillColor(colors.dark)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(String(value || "-"), cardX + 100, y, {
        width: cardW - 116,
        align: "right",
        lineBreak: false,
      });
  };

  detailRow("Invoice Date", formatDate(invoice.invoice_date), topY + 18);
  detailRow("Due Date", formatDate(invoice.due_date), topY + 46);
  detailRow("Billing Cycle", formatCycle(invoice.billing_cycle), topY + 74);

  // ---------- Plan table ----------
  const tableY = 280;
  const amountW = 130;
  const amountX = right - 16 - amountW;

  doc.roundedRect(margin, tableY, contentWidth, 34, 8).fill(colors.tableHead);

  doc
    .fillColor(colors.slate)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("DESCRIPTION", margin + 16, tableY + 12, {
      characterSpacing: 1,
      lineBreak: false,
    })
    .text("AMOUNT", amountX, tableY + 12, {
      width: amountW,
      align: "right",
      characterSpacing: 1,
      lineBreak: false,
    });

  // Plan row
  const rowY = tableY + 54;

  doc
    .fillColor(colors.dark)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(invoice.plan_name || "Subscription Plan", margin + 16, rowY, {
      width: amountX - margin - 32,
      height: 16,
      ellipsis: true,
    });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(colors.muted)
    .text(
      `SaaS subscription - ${formatCycle(invoice.billing_cycle)}`,
      margin + 16,
      rowY + 20,
      { width: amountX - margin - 32, lineBreak: false },
    );

  doc
    .fillColor(colors.dark)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`INR ${formatAmount(invoice.amount)}`, amountX, rowY, {
      width: amountW,
      align: "right",
      lineBreak: false,
    });

  // Divider
  doc
    .moveTo(margin, tableY + 106)
    .lineTo(right, tableY + 106)
    .lineWidth(1)
    .strokeColor(colors.border)
    .stroke();

  // ---------- Total box (right) ----------
  const totalY = tableY + 130;
  const totalW = 230;
  const totalX = right - totalW;

  doc.roundedRect(totalX, totalY, totalW, 78, 12).fill(colors.dark);

  doc
    .fillColor(colors.light)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("TOTAL PAYABLE", totalX + 20, totalY + 16, {
      characterSpacing: 1,
      lineBreak: false,
    });

  doc
    .fillColor("#ffffff")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(`INR ${formatAmount(invoice.amount)}`, totalX + 20, totalY + 38, {
      width: totalW - 40,
      lineBreak: false,
    });

  // ---------- Notes (left) ----------
  doc
    .fillColor(colors.dark)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Notes", margin, totalY, { lineBreak: false });

  doc
    .fillColor(colors.muted)
    .fontSize(10)
    .font("Helvetica")
    .text(
      "This is a system generated subscription invoice. Please complete payment before the due date to activate or continue your subscription.",
      margin,
      totalY + 20,
      { width: totalX - margin - 30, lineGap: 4 },
    );

  // ---------- Footer ----------
  const footerY = pageHeight - 100;

  doc
    .moveTo(margin, footerY)
    .lineTo(right, footerY)
    .lineWidth(1)
    .strokeColor(colors.border)
    .stroke();

  doc
    .fillColor(colors.footer)
    .fontSize(9)
    .font("Helvetica")
    .text(
      "Generated by Smart Invoice & Billing Management System",
      margin,
      footerY + 14,
      { width: contentWidth, align: "center", lineBreak: false },
    );
};

// GET SUBSCRIPTION PLANS
export const getPlans = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === "superadmin";

    let query = `
      SELECT
        id,
        plan_name,
        plan_type,
        price,
        billing_cycle,
        duration_value,
        duration_unit,
        is_default,
        max_companies,
        max_users,
        max_invoices,
        max_branches,
        features,
        status,
        created_at
      FROM tbl_subscription_plans
    `;

    const params = [];

    // Company Admin ko sirf active plans dikhne chahiye
    if (!isSuperAdmin) {
      query += ` WHERE status = ? `;
      params.push("active");
    }

    query += `
      ORDER BY
        is_default DESC,
        CASE WHEN plan_type = 'free' THEN 1 ELSE 2 END,
        price ASC,
        id DESC
    `;

    const [plans] = await db.query(query, params);

    return res.status(200).json(plans);
  } catch (error) {
    console.error("GET PLANS ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch plans",
      error: error.message,
    });
  }
};

// CREATE PLAN

export const createPlan = async (req, res) => {
  let connection;

  try {
    const {
      plan_name,
      plan_type = "paid",
      price = 0,
      duration_value = 1,
      duration_unit = "month",
      features = "",
      max_branches = 1,
    } = req.body;

    const finalPlanName = String(plan_name || "").trim();
    const finalPlanType = String(plan_type || "")
      .toLowerCase()
      .trim();
    const finalDurationUnit = String(duration_unit || "")
      .toLowerCase()
      .trim();

    const finalDurationValue = Number(duration_value);
    const finalMaxBranches = Number(max_branches);
    const requestedPrice = Number(price);

    if (!finalPlanName) {
      return res.status(400).json({
        message: "Plan name is required",
      });
    }

    if (!allowedPlanTypes.includes(finalPlanType)) {
      return res.status(400).json({
        message: "Plan type must be free or paid",
      });
    }

    if (!Number.isInteger(finalDurationValue) || finalDurationValue <= 0) {
      return res.status(400).json({
        message: "Plan duration must be a positive whole number",
      });
    }

    if (!allowedDurationUnits.includes(finalDurationUnit)) {
      return res.status(400).json({
        message: "Duration unit must be day, month or year",
      });
    }

    if (!Number.isInteger(finalMaxBranches) || finalMaxBranches <= 0) {
      return res.status(400).json({
        message: "Max branches must be a positive whole number",
      });
    }

    if (!Number.isFinite(requestedPrice) || requestedPrice < 0) {
      return res.status(400).json({
        message: "Invalid plan price",
      });
    }

    if (finalPlanType === "paid" && requestedPrice <= 0) {
      return res.status(400).json({
        message: "Paid plan price must be greater than 0",
      });
    }

    const finalPrice = finalPlanType === "free" ? 0 : requestedPrice;
    const finalIsDefault = finalPlanType === "free" ? 1 : 0;

    // Old column ko filhaal compatibility ke liye maintain kar rahe hain
    const finalBillingCycle = buildBillingCycle(
      finalDurationValue,
      finalDurationUnit,
    );

    const finalFeatures = Array.isArray(features)
      ? features.filter(Boolean).join(", ")
      : String(features || "").trim();

    connection = await db.getConnection();
    await connection.beginTransaction();

    /*
     * Ek time par sirf ek Free Plan default rahega.
     * Naya Free Plan create karte hi purana default remove ho jayega.
     */
    if (finalPlanType === "free") {
      await connection.query(
        `
        UPDATE tbl_subscription_plans
        SET is_default = 0
        WHERE is_default = 1
        `,
      );
    }

    const [planResult] = await connection.query(
      `
      INSERT INTO tbl_subscription_plans
      (
        plan_name,
        plan_type,
        price,
        billing_cycle,
        duration_value,
        duration_unit,
        is_default,
        trial_days,
        max_companies,
        max_users,
        max_invoices,
        max_branches,
        features,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalPlanName,
        finalPlanType,
        finalPrice,
        finalBillingCycle,
        finalDurationValue,
        finalDurationUnit,
        finalIsDefault,
        0,
        1,
        1,
        999999,
        finalMaxBranches,
        finalFeatures,
        "active",
      ],
    );

    await connection.commit();

    await createAuditLog({
      company_id: null,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription Plan",
      record_id: planResult.insertId,
      description: `Subscription plan ${finalPlanName} created`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Plan created successfully",
      plan_id: planResult.insertId,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.log("CREATE PLAN ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "A plan with this name already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to create plan",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// UPDATE PLAN
// UPDATE PLAN

export const updatePlan = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;

    const {
      plan_name,
      plan_type = "paid",
      price = 0,
      duration_value = 1,
      duration_unit = "month",
      features = "",
      status = "active",
      max_branches = 1,
    } = req.body;

    const planId = Number(id);
    const finalPlanName = String(plan_name || "").trim();
    const finalPlanType = String(plan_type || "")
      .toLowerCase()
      .trim();
    const finalDurationUnit = String(duration_unit || "")
      .toLowerCase()
      .trim();
    const finalStatus = String(status || "active")
      .toLowerCase()
      .trim();

    const finalDurationValue = Number(duration_value);
    const finalMaxBranches = Number(max_branches);
    const requestedPrice = Number(price);

    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({
        message: "Invalid plan ID",
      });
    }

    if (!finalPlanName) {
      return res.status(400).json({
        message: "Plan name is required",
      });
    }

    if (!allowedPlanTypes.includes(finalPlanType)) {
      return res.status(400).json({
        message: "Plan type must be free or paid",
      });
    }

    if (!Number.isInteger(finalDurationValue) || finalDurationValue <= 0) {
      return res.status(400).json({
        message: "Plan duration must be a positive whole number",
      });
    }

    if (!allowedDurationUnits.includes(finalDurationUnit)) {
      return res.status(400).json({
        message: "Duration unit must be day, month or year",
      });
    }

    if (!Number.isInteger(finalMaxBranches) || finalMaxBranches <= 0) {
      return res.status(400).json({
        message: "Max branches must be a positive whole number",
      });
    }

    if (!allowedPlanStatuses.includes(finalStatus)) {
      return res.status(400).json({
        message: "Plan status must be active or inactive",
      });
    }

    if (!Number.isFinite(requestedPrice) || requestedPrice < 0) {
      return res.status(400).json({
        message: "Invalid plan price",
      });
    }

    if (finalPlanType === "paid" && requestedPrice <= 0) {
      return res.status(400).json({
        message: "Paid plan price must be greater than 0",
      });
    }

    const finalPrice = finalPlanType === "free" ? 0 : requestedPrice;
    const finalIsDefault = finalPlanType === "free" ? 1 : 0;

    const finalBillingCycle = buildBillingCycle(
      finalDurationValue,
      finalDurationUnit,
    );

    const finalFeatures = Array.isArray(features)
      ? features.filter(Boolean).join(", ")
      : String(features || "").trim();

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existingPlans] = await connection.query(
      `
      SELECT id
      FROM tbl_subscription_plans
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [planId],
    );

    if (existingPlans.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Plan not found",
      });
    }

    /*
     * Agar plan ko Free banaya ja raha hai to doosre plan ka
     * default status remove kar diya jayega.
     */
    if (finalPlanType === "free") {
      await connection.query(
        `
        UPDATE tbl_subscription_plans
        SET is_default = 0
        WHERE id <> ?
          AND is_default = 1
        `,
        [planId],
      );
    }

    await connection.query(
      `
      UPDATE tbl_subscription_plans
      SET
        plan_name = ?,
        plan_type = ?,
        price = ?,
        billing_cycle = ?,
        duration_value = ?,
        duration_unit = ?,
        is_default = ?,
        trial_days = ?,
        max_branches = ?,
        features = ?,
        status = ?
      WHERE id = ?
      `,
      [
        finalPlanName,
        finalPlanType,
        finalPrice,
        finalBillingCycle,
        finalDurationValue,
        finalDurationUnit,
        finalIsDefault,
        0,
        finalMaxBranches,
        finalFeatures,
        finalStatus,
        planId,
      ],
    );

    await connection.commit();

    await createAuditLog({
      company_id: null,
      user_id: req.user?.id || null,
      action: "UPDATE",
      module_name: "Subscription Plan",
      record_id: planId,
      description: `Subscription plan ${finalPlanName} updated`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Plan updated successfully",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.log("UPDATE PLAN ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "A plan with this name already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to update plan",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
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

// COMPANY SIDE: GET COMPLETE SUBSCRIPTION HISTORY
export const getMyAllSubscriptions = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID missing",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        cs.plan_id,

        CASE
          WHEN cs.status = 'active'
            AND cs.renewal_date IS NOT NULL
            AND cs.renewal_date < CURDATE()
          THEN 'expired'
          ELSE cs.status
        END AS status,

        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        cs.created_at,

        sp.plan_name,
        sp.plan_type,
        sp.price,
        sp.billing_cycle,
        sp.duration_value,
        sp.duration_unit,
        sp.is_default,
        sp.features,
        sp.max_users,
        sp.max_invoices,

        GREATEST(
          COALESCE(c.branch_limit, 0),
          COALESCE(sp.max_branches, 0)
        ) AS max_branches,

        CASE
          WHEN cs.renewal_date IS NULL THEN NULL
          ELSE GREATEST(DATEDIFF(cs.renewal_date, CURDATE()), 0)
        END AS remaining_days,

        latest_invoice.id AS latest_invoice_id,
        latest_invoice.invoice_number AS latest_invoice_number,
        latest_invoice.invoice_status AS latest_invoice_status,
        latest_invoice.amount AS latest_invoice_amount,
        latest_invoice.due_date AS latest_invoice_due_date,

        CASE
          WHEN cs.status = 'pending_payment'
          THEN 'Waiting for payment'

          WHEN cs.status = 'active'
            AND cs.start_date > CURDATE()
          THEN 'Upcoming plan'

          WHEN cs.status = 'active'
            AND cs.renewal_date IS NOT NULL
            AND cs.renewal_date < CURDATE()
          THEN 'Expired plan'

          WHEN cs.status = 'active'
          THEN 'Current active plan'

          WHEN cs.status = 'trial'
          THEN 'Trial plan'

          WHEN cs.status = 'cancelled'
          THEN 'Previous plan'

          WHEN cs.status = 'expired'
          THEN 'Expired plan'

          ELSE cs.status
        END AS display_status

      FROM tbl_company_subscriptions cs

      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id

      JOIN tbl_companies c
        ON cs.company_id = c.id

      LEFT JOIN (
        SELECT si1.*
        FROM tbl_subscription_invoices si1

        INNER JOIN (
          SELECT
            subscription_id,
            MAX(id) AS max_invoice_id
          FROM tbl_subscription_invoices
          GROUP BY subscription_id
        ) si2
          ON si1.id = si2.max_invoice_id
      ) latest_invoice
        ON latest_invoice.subscription_id = cs.id

      WHERE cs.company_id = ?

      ORDER BY
        cs.id DESC
      `,
      [companyId],
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("GET MY ALL SUBSCRIPTIONS ERROR:", error);

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

  let transactionCommitted = false;

  try {
    const companyId = req.user.company_id;
    const { plan_id } = req.body;

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID missing",
      });
    }

    if (!plan_id) {
      return res.status(400).json({
        message: "Plan is required",
      });
    }

    await connection.beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | 1. COMPANY LOCK
    |--------------------------------------------------------------------------
    | Same company ke multiple purchase requests ko simultaneously process
    | hone se rokega.
    */

    const [companyRows] = await connection.query(
      `
      SELECT
        id,
        name,
        branch_limit
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [companyId],
    );

    if (!companyRows.length) {
      await connection.rollback();

      return res.status(404).json({
        message: "Company not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 2. SELECTED PAID PLAN
    |--------------------------------------------------------------------------
    */

    const [planRows] = await connection.query(
      `
      SELECT
        id,
        plan_name,
        plan_type,
        price,
        billing_cycle,
        duration_value,
        duration_unit,
        max_branches,
        status
      FROM tbl_subscription_plans
      WHERE id = ?
        AND status = 'active'
      LIMIT 1
      `,
      [plan_id],
    );

    if (!planRows.length) {
      await connection.rollback();

      return res.status(404).json({
        message: "Active subscription plan not found",
      });
    }

    const plan = planRows[0];

    if (plan.plan_type !== "paid") {
      await connection.rollback();

      return res.status(400).json({
        message: "Only paid plans can be purchased",
      });
    }

    const planPrice = Number(plan.price || 0);
    const durationValue = Number(plan.duration_value || 0);
    const purchasedBranches = Number(plan.max_branches || 0);

    if (planPrice <= 0) {
      await connection.rollback();

      return res.status(400).json({
        message: "Paid plan price must be greater than zero",
      });
    }

    if (durationValue <= 0) {
      await connection.rollback();

      return res.status(400).json({
        message: "Plan duration is invalid",
      });
    }

    const allowedDurationUnits = {
      day: "DAY",
      month: "MONTH",
      year: "YEAR",
    };

    const intervalUnit = allowedDurationUnits[plan.duration_unit];

    if (!intervalUnit) {
      await connection.rollback();

      return res.status(400).json({
        message: "Plan duration unit is invalid",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 3. CALCULATE PAID PLAN START DATE
    |--------------------------------------------------------------------------
    | Agar current free/paid plan ki validity baaki hai to new paid plan
    | current validity ke end se start hoga.
    |
    | Example:
    | Current free expiry: 22 Nov
    | Paid duration: 3 months
    | Paid start: 22 Nov
    | Paid renewal: 22 Feb
    */

    const [baseDateRows] = await connection.query(
      `
      SELECT
        DATE_FORMAT(
          CASE
            WHEN MAX(renewal_date) IS NOT NULL
              AND MAX(renewal_date) > CURDATE()
            THEN MAX(renewal_date)
            ELSE CURDATE()
          END,
          '%Y-%m-%d'
        ) AS start_date
      FROM tbl_company_subscriptions
      WHERE company_id = ?
        AND status = 'active'
      `,
      [companyId],
    );

    const startDate = baseDateRows[0]?.start_date;

    const [renewalDateRows] = await connection.query(
      `
      SELECT DATE_FORMAT(
        DATE_ADD(
          ?,
          INTERVAL ? ${intervalUnit}
        ),
        '%Y-%m-%d'
      ) AS renewal_date
      `,
      [startDate, durationValue],
    );

    const renewalDate = renewalDateRows[0]?.renewal_date;

    if (!startDate || !renewalDate) {
      throw new Error("Unable to calculate subscription validity");
    }

    /*
    |--------------------------------------------------------------------------
    | 4. CURRENT EFFECTIVE BRANCH LIMIT
    |--------------------------------------------------------------------------
    | Existing company branch_limit aur active plan limit me jo bada hai
    | usko current limit maana jayega.
    */

    const [activePlanLimitRows] = await connection.query(
      `
      SELECT
        COALESCE(MAX(sp.max_branches), 0) AS active_plan_branches
      FROM tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE cs.company_id = ?
        AND cs.status = 'active'
      `,
      [companyId],
    );

    const companyBranchLimit = Number(companyRows[0].branch_limit || 0);

    const activePlanBranchLimit = Number(
      activePlanLimitRows[0]?.active_plan_branches || 0,
    );

    const existingBranchLimit = Math.max(
      companyBranchLimit,
      activePlanBranchLimit,
    );

    const updatedBranchLimit = existingBranchLimit + purchasedBranches;

    /*
    |--------------------------------------------------------------------------
    | 5. CREATE ACTIVE PAID SUBSCRIPTION
    |--------------------------------------------------------------------------
    | Payment demo mode mein direct paid hai isliye pending_payment nahi hoga.
    */

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
      VALUES (?, ?, 'active', ?, NULL, ?, 1)
      `,
      [companyId, plan.id, startDate, renewalDate],
    );

    const subscriptionId = subscriptionResult.insertId;

    /*
    |--------------------------------------------------------------------------
    | 6. GENERATE PAID SUBSCRIPTION INVOICE
    |--------------------------------------------------------------------------
    */

    const invoiceNumber = `SUB-INV-${Date.now()}-${companyId}`;

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
      VALUES (?, ?, ?, ?, 'paid', CURDATE(), CURDATE())
      `,
      [subscriptionId, companyId, invoiceNumber, planPrice],
    );

    const invoiceId = invoiceResult.insertId;

    /*
    |--------------------------------------------------------------------------
    | 7. CREATE DEMO PAID PAYMENT
    |--------------------------------------------------------------------------
    */

    const transactionId = `DEMO-${Date.now()}-${companyId}`;

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
      VALUES (?, ?, ?, 'paid', 'demo', ?, CURDATE())
      `,
      [subscriptionId, companyId, planPrice, transactionId],
    );

    /*
    |--------------------------------------------------------------------------
    | 8. INCREASE COMPANY BRANCH LIMIT
    |--------------------------------------------------------------------------
    */

    await connection.query(
      `
      UPDATE tbl_companies
      SET branch_limit = ?
      WHERE id = ?
      `,
      [updatedBranchLimit, companyId],
    );

    await connection.commit();
    transactionCommitted = true;

    /*
    |--------------------------------------------------------------------------
    | 9. AUDIT LOG
    |--------------------------------------------------------------------------
    | Audit fail hone par successful purchase rollback nahi hoga.
    */

    try {
      await createAuditLog({
        company_id: companyId,
        user_id: req.user?.id || null,
        action: "CREATE",
        module_name: "Subscription",
        record_id: subscriptionId,
        description:
          `${plan.plan_name} purchased. ` +
          `Valid from ${startDate} to ${renewalDate}. ` +
          `Invoice ${invoiceNumber} paid through demo payment.`,
        ip_address: req.ip,
      });
    } catch (auditError) {
      console.error("SUBSCRIPTION PURCHASE AUDIT ERROR:", auditError);
    }

    /*
    |--------------------------------------------------------------------------
    | 10. NOTIFICATION
    |--------------------------------------------------------------------------
    */

    try {
      await notifyCompanyAdmins({
        company_id: companyId,
        exclude_user_id: req.user.id,
        type: "subscription",
        severity: "medium",
        title: "Subscription Purchased",
        message:
          `${plan.plan_name} purchased successfully. ` +
          `Valid from ${startDate} to ${renewalDate}.`,
      });
    } catch (notificationError) {
      console.error(
        "SUBSCRIPTION PURCHASE NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return res.status(201).json({
      message: "Subscription purchased successfully",

      subscription: {
        id: subscriptionId,
        plan_id: plan.id,
        plan_name: plan.plan_name,
        plan_type: plan.plan_type,
        start_date: startDate,
        renewal_date: renewalDate,
        auto_renewal: true,
        status: "active",
      },

      invoice: {
        id: invoiceId,
        invoice_number: invoiceNumber,
        amount: planPrice,
        invoice_status: "paid",
      },

      payment: {
        id: paymentResult.insertId,
        amount: planPrice,
        payment_status: "paid",
        payment_method: "demo",
        transaction_id: transactionId,
      },

      branches: {
        previous_limit: existingBranchLimit,
        purchased_branches: purchasedBranches,
        updated_limit: updatedBranchLimit,
      },
    });
  } catch (error) {
    if (!transactionCommitted) {
      await connection.rollback();
    }

    console.error("BUY SUBSCRIPTION PLAN ERROR:", error);

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
// ASSIGN SUBSCRIPTION
export const assignSubscription = async (req, res) => {
  try {
    const { company_id, plan_id, auto_renewal } = req.body;

    if (!company_id || !plan_id) {
      return res.status(400).json({
        message: "Company and plan are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ACTIVE PLAN CHECK
    |--------------------------------------------------------------------------
    */

    const [planRows] = await db.query(
      `
      SELECT
        id,
        plan_name,
        plan_type,
        status
      FROM tbl_subscription_plans
      WHERE id = ?
        AND status = 'active'
      LIMIT 1
      `,
      [plan_id],
    );

    if (planRows.length === 0) {
      return res.status(404).json({
        message: "Active plan not found",
      });
    }

    const plan = planRows[0];

    /*
    |--------------------------------------------------------------------------
    | FREE PLAN BLOCK
    |--------------------------------------------------------------------------
    |
    | Free Plan KYC approve hone ke baad automatically assign hota hai.
    | Is manual assignment function se sirf Paid Plan assign hoga.
    |
    */

    if (plan.plan_type === "free") {
      return res.status(400).json({
        message: "Free Plan is automatically assigned after KYC approval.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | COMPANY CHECK
    |--------------------------------------------------------------------------
    */

    const [companyRows] = await db.query(
      `
      SELECT
        id,
        name
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [company_id],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DUPLICATE SUBSCRIPTION CHECK
    |--------------------------------------------------------------------------
    |
    | Trial compatibility abhi rakhi gayi hai.
    |
    */

    const [existingRows] = await db.query(
      `
      SELECT id
      FROM tbl_company_subscriptions
      WHERE company_id = ?
        AND status IN (
          'trial',
          'active',
          'pending_payment'
        )
      LIMIT 1
      `,
      [company_id],
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        message: "Company already has an active or pending subscription.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE PENDING PAID SUBSCRIPTION
    |--------------------------------------------------------------------------
    |
    | Payment hone ke baad subscription active hogi.
    |
    */

    const finalAutoRenewal = Number(auto_renewal) === 0 ? 0 : 1;

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
        ?,
        ?,
        'pending_payment',
        CURDATE(),
        NULL,
        NULL,
        ?
      )
      `,
      [company_id, plan.id, finalAutoRenewal],
    );

    await createAuditLog({
      company_id,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription",
      record_id: subscriptionResult.insertId,
      description: `${plan.plan_name} assigned to ` + `${companyRows[0].name}`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Subscription assigned. Generate invoice to activate.",

      subscription: {
        id: subscriptionResult.insertId,
        company_id: Number(company_id),
        plan_id: plan.id,
        plan_name: plan.plan_name,
        plan_type: plan.plan_type,
        status: "pending_payment",
        auto_renewal: finalAutoRenewal,
      },
    });
  } catch (error) {
    console.error("ASSIGN SUBSCRIPTION ERROR:", error);

    return res.status(500).json({
      message: "Failed to assign subscription",
      error: error.message,
    });
  }
};

// CHANGE PLAN
// CHANGE SUBSCRIPTION PLAN
export const changeSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        message: "Plan is required",
      });
    }

    const [planRows] = await db.query(
      `
      SELECT
        id,
        plan_name,
        plan_type,
        duration_value,
        duration_unit,
        status
      FROM tbl_subscription_plans
      WHERE id = ?
        AND status = 'active'
      LIMIT 1
      `,
      [plan_id],
    );

    if (planRows.length === 0) {
      return res.status(404).json({
        message: "Active plan not found",
      });
    }

    const plan = planRows[0];

    const durationValue = Number(plan.duration_value);

    const durationUnit = String(plan.duration_unit || "").toLowerCase();

    if (
      !Number.isInteger(durationValue) ||
      durationValue <= 0 ||
      !["day", "month", "year"].includes(durationUnit)
    ) {
      return res.status(400).json({
        message: "Plan duration configuration is invalid",
      });
    }

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        c.name AS company_name,
        sp.plan_name AS old_plan_name
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c
        ON cs.company_id = c.id
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

    const [result] = await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET
        plan_id = ?,
        status = 'active',

        renewal_date = CASE
          WHEN ? = 'day'
            THEN DATE_ADD(
              CURDATE(),
              INTERVAL ? DAY
            )

          WHEN ? = 'month'
            THEN DATE_ADD(
              CURDATE(),
              INTERVAL ? MONTH
            )

          WHEN ? = 'year'
            THEN DATE_ADD(
              CURDATE(),
              INTERVAL ? YEAR
            )
        END,

        auto_renewal = CASE
          WHEN ? = 'free' THEN 0
          ELSE auto_renewal
        END

      WHERE id = ?
      `,
      [
        plan.id,

        durationUnit,
        durationValue,

        durationUnit,
        durationValue,

        durationUnit,
        durationValue,

        plan.plan_type,
        id,
      ],
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
      description:
        `Subscription plan changed from ` +
        `${subscription.old_plan_name} to ` +
        `${plan.plan_name}`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Subscription plan changed successfully",
    });
  } catch (error) {
    console.error("CHANGE PLAN ERROR:", error);

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

    if (![0, 1, "0", "1"].includes(auto_renewal)) {
      return res.status(400).json({
        message: "Auto renewal value must be 0 or 1",
      });
    }

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        cs.status,
        cs.auto_renewal,
        sp.plan_name,
        sp.plan_type
      FROM tbl_company_subscriptions cs
      JOIN tbl_subscription_plans sp
        ON sp.id = cs.plan_id
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

    /*
    |--------------------------------------------------------------------------
    | COMPANY SECURITY CHECK
    |--------------------------------------------------------------------------
    */

    if (
      req.user.role !== "superadmin" &&
      Number(subscription.company_id) !== Number(req.user.company_id)
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FREE PLAN AUTO RENEWAL BLOCK
    |--------------------------------------------------------------------------
    */

    if (subscription.plan_type === "free") {
      // Safety: Free plan hamesha auto-renewal OFF rahega
      await db.query(
        `
        UPDATE tbl_company_subscriptions
        SET auto_renewal = 0
        WHERE id = ?
        `,
        [id],
      );

      return res.status(400).json({
        message: "Auto renewal is not available for the Free plan.",
        auto_renewal: 0,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ONLY ACTIVE PAID PLAN
    |--------------------------------------------------------------------------
    */

    if (subscription.status !== "active") {
      return res.status(400).json({
        message: "Auto renewal can only be changed for an active subscription.",
      });
    }

    const newAutoRenewal = Number(auto_renewal) === 1 ? 1 : 0;

    await db.query(
      `
      UPDATE tbl_company_subscriptions
      SET auto_renewal = ?
      WHERE id = ?
      `,
      [newAutoRenewal, id],
    );

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
      message: newAutoRenewal
        ? "Auto renewal enabled successfully"
        : "Auto renewal disabled successfully",
      auto_renewal: newAutoRenewal,
    });
  } catch (error) {
    console.log("AUTO RENEWAL ERROR:", error);

    return res.status(500).json({
      message: "Failed to update auto renewal",
      error: error.message,
    });
  }
};

// RECORD PAYMENT
// RECORD SUBSCRIPTION PAYMENT
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
        sp.plan_type,
        sp.duration_value,
        sp.duration_unit
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c
        ON cs.company_id = c.id
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE cs.id = ?
        AND cs.company_id = ?
      LIMIT 1
      `,
      [subscription_id, company_id],
    );

    if (subscriptionRows.length === 0) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    const subscription = subscriptionRows[0];

    const durationValue = Number(subscription.duration_value);

    const durationUnit = String(subscription.duration_unit || "").toLowerCase();

    if (
      !Number.isInteger(durationValue) ||
      durationValue <= 0 ||
      !["day", "month", "year"].includes(durationUnit)
    ) {
      return res.status(400).json({
        message: "Plan duration configuration is invalid",
      });
    }

    const finalPaymentStatus = payment_status || "paid";

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
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        CURDATE()
      )
      `,
      [
        subscription_id,
        company_id,
        finalAmount,
        finalPaymentStatus,
        payment_method || "manual",
        transaction_id || null,
      ],
    );

    /*
    |--------------------------------------------------------------------------
    | ACTIVATE SUBSCRIPTION AFTER PAID PAYMENT
    |--------------------------------------------------------------------------
    */

    if (finalPaymentStatus === "paid") {
      await db.query(
        `
        UPDATE tbl_company_subscriptions
        SET
          status = 'active',

          renewal_date = CASE
            WHEN ? = 'day'
              THEN DATE_ADD(
                CURDATE(),
                INTERVAL ? DAY
              )

            WHEN ? = 'month'
              THEN DATE_ADD(
                CURDATE(),
                INTERVAL ? MONTH
              )

            WHEN ? = 'year'
              THEN DATE_ADD(
                CURDATE(),
                INTERVAL ? YEAR
              )
          END,

          auto_renewal = CASE
            WHEN ? = 'free' THEN 0
            ELSE auto_renewal
          END

        WHERE id = ?
          AND company_id = ?
        `,
        [
          durationUnit,
          durationValue,

          durationUnit,
          durationValue,

          durationUnit,
          durationValue,

          subscription.plan_type,
          subscription_id,
          company_id,
        ],
      );
    }

    await createAuditLog({
      company_id,
      user_id: req.user?.id || null,
      action: "CREATE",
      module_name: "Subscription Payment",
      record_id: paymentResult.insertId,
      description: `Subscription payment ₹${formatAmount(
        finalAmount,
      )} recorded for ${subscription.plan_name}`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Payment recorded successfully",

      payment: {
        id: paymentResult.insertId,
        subscription_id: Number(subscription_id),
        company_id: Number(company_id),
        amount: finalAmount,
        payment_status: finalPaymentStatus,
        payment_method: payment_method || "manual",
        transaction_id: transaction_id || null,
      },
    });
  } catch (error) {
    console.error("RECORD PAYMENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to record payment",
      error: error.message,
    });
  }
};

// SUPERADMIN: GET SUBSCRIPTION PAYMENTS
export const getSubscriptionPayments = async (
  req,
  res,
) => {
  try {
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
        c.name AS company_name,
        plan.plan_name,

        (
          SELECT si.invoice_number
          FROM tbl_subscription_invoices si
          WHERE si.subscription_id =
            spay.subscription_id
            AND si.company_id =
              spay.company_id
            AND si.amount = spay.amount

          ORDER BY
            CASE
              WHEN si.invoice_date =
                spay.payment_date
              THEN 0
              ELSE 1
            END,
            si.id DESC

          LIMIT 1
        ) AS invoice_number

      FROM tbl_subscription_payments spay

      JOIN tbl_companies c
        ON spay.company_id = c.id

      JOIN tbl_company_subscriptions cs
        ON spay.subscription_id = cs.id

      JOIN tbl_subscription_plans plan
        ON cs.plan_id = plan.id

      ORDER BY spay.id DESC
      `,
    );

    return res.status(200).json(payments);
  } catch (error) {
    console.error(
      "GET SUBSCRIPTION PAYMENTS ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Failed to fetch subscription payments",
      error: error.message,
    });
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
      return res.status(400).json({
        message: "Company ID missing",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        cs.id,
        cs.company_id,
        cs.plan_id,

        CASE
          WHEN cs.status = 'active'
            AND cs.renewal_date IS NOT NULL
            AND cs.renewal_date < CURDATE()
          THEN 'expired'
          ELSE cs.status
        END AS status,

        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        cs.created_at,

        sp.plan_name,
        sp.plan_type,
        sp.price,
        sp.billing_cycle,
        sp.duration_value,
        sp.duration_unit,
        sp.is_default,
        sp.max_users,
        sp.max_invoices,
        sp.features,

        GREATEST(
          COALESCE(c.branch_limit, 0),
          COALESCE(sp.max_branches, 0)
        ) AS max_branches,

        COALESCE(branch_data.used_branches, 0) AS used_branches,

        GREATEST(
          GREATEST(
            COALESCE(c.branch_limit, 0),
            COALESCE(sp.max_branches, 0)
          ) - COALESCE(branch_data.used_branches, 0),
          0
        ) AS remaining_branches,

        CASE
          WHEN cs.renewal_date IS NULL THEN NULL
          ELSE GREATEST(DATEDIFF(cs.renewal_date, CURDATE()), 0)
        END AS remaining_days

      FROM tbl_company_subscriptions cs

      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id

      JOIN tbl_companies c
        ON cs.company_id = c.id

      LEFT JOIN (
        SELECT
          company_id,
          COUNT(*) AS used_branches
        FROM tbl_company_branches
        GROUP BY company_id
      ) branch_data
        ON branch_data.company_id = cs.company_id

      WHERE cs.company_id = ?
        AND cs.status IN (
          'trial',
          'active',
          'pending_payment',
          'expired'
        )

      ORDER BY
        CASE
          WHEN cs.status = 'active'
            AND cs.start_date <= CURDATE()
            AND (
              cs.renewal_date IS NULL
              OR cs.renewal_date >= CURDATE()
            )
          THEN 1

          WHEN cs.status = 'trial'
            AND cs.start_date <= CURDATE()
            AND (
              cs.trial_end_date IS NULL
              OR cs.trial_end_date >= CURDATE()
            )
          THEN 2

          WHEN cs.status = 'pending_payment'
          THEN 3

          WHEN cs.status = 'expired'
            OR (
              cs.renewal_date IS NOT NULL
              AND cs.renewal_date < CURDATE()
            )
          THEN 4

          ELSE 5
        END,

        cs.id DESC

      LIMIT 1
      `,
      [companyId],
    );

    return res.status(200).json(rows[0] || null);
  } catch (error) {
    console.error("GET MY SUBSCRIPTION ERROR:", error);

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
export const getMySubscriptionPayments = async (
  req,
  res,
) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID missing",
      });
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
        plan.plan_name,

        (
          SELECT si.invoice_number
          FROM tbl_subscription_invoices si
          WHERE si.subscription_id =
            spay.subscription_id
            AND si.company_id =
              spay.company_id
            AND si.amount = spay.amount

          ORDER BY
            CASE
              WHEN si.invoice_date =
                spay.payment_date
              THEN 0
              ELSE 1
            END,
            si.id DESC

          LIMIT 1
        ) AS invoice_number

      FROM tbl_subscription_payments spay

      JOIN tbl_company_subscriptions cs
        ON spay.subscription_id = cs.id

      JOIN tbl_subscription_plans plan
        ON cs.plan_id = plan.id

      WHERE spay.company_id = ?

      ORDER BY spay.id DESC
      `,
      [companyId],
    );

    return res.status(200).json(payments);
  } catch (error) {
    console.error(
      "GET MY SUBSCRIPTION PAYMENTS ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Failed to fetch subscription payments",
      error: error.message,
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
      return res.status(400).json({
        message: "Company ID missing",
      });
    }

    if (!invoice_id) {
      return res.status(400).json({
        message: "Invoice is required",
      });
    }

    await connection.beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | GET AND LOCK INVOICE
    |--------------------------------------------------------------------------
    */

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
        sp.plan_type,
        sp.duration_value,
        sp.duration_unit
      FROM tbl_subscription_invoices si
      JOIN tbl_company_subscriptions cs
        ON si.subscription_id = cs.id
      JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE si.id = ?
        AND si.company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [invoice_id, companyId],
    );

    if (invoiceRows.length === 0) {
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

    const durationValue = Number(invoice.duration_value);

    const durationUnit = String(invoice.duration_unit || "").toLowerCase();

    if (
      !Number.isInteger(durationValue) ||
      durationValue <= 0 ||
      !["day", "month", "year"].includes(durationUnit)
    ) {
      await connection.rollback();

      return res.status(400).json({
        message: "Plan duration configuration is invalid",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE PAID PAYMENT
    |--------------------------------------------------------------------------
    */

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
        VALUES
        (
          ?,
          ?,
          ?,
          'paid',
          ?,
          ?,
          CURDATE()
        )
        `,
      [
        invoice.subscription_id,
        companyId,
        invoice.amount,
        payment_method,
        transaction_id,
      ],
    );

    /*
    |--------------------------------------------------------------------------
    | MARK INVOICE PAID
    |--------------------------------------------------------------------------
    */

    await connection.query(
      `
      UPDATE tbl_subscription_invoices
      SET invoice_status = 'paid'
      WHERE id = ?
        AND company_id = ?
      `,
      [invoice_id, companyId],
    );

    /*
    |--------------------------------------------------------------------------
    | CANCEL OTHER OLD SUBSCRIPTIONS
    |--------------------------------------------------------------------------
    |
    | Trial compatibility retained.
    |
    */

    await connection.query(
      `
      UPDATE tbl_company_subscriptions
      SET status = 'cancelled'
      WHERE company_id = ?
        AND id != ?
        AND status IN (
          'trial',
          'active',
          'pending_payment',
          'expired'
        )
      `,
      [companyId, invoice.subscription_id],
    );

    /*
    |--------------------------------------------------------------------------
    | ACTIVATE PAID SUBSCRIPTION
    |--------------------------------------------------------------------------
    */

    await connection.query(
      `
      UPDATE tbl_company_subscriptions
      SET
        status = 'active',

        renewal_date = CASE
          WHEN ? = 'day'
            THEN DATE_ADD(
              CURDATE(),
              INTERVAL ? DAY
            )

          WHEN ? = 'month'
            THEN DATE_ADD(
              CURDATE(),
              INTERVAL ? MONTH
            )

          WHEN ? = 'year'
            THEN DATE_ADD(
              CURDATE(),
              INTERVAL ? YEAR
            )
        END,

        auto_renewal = CASE
          WHEN ? = 'free' THEN 0
          ELSE auto_renewal
        END

      WHERE id = ?
        AND company_id = ?
      `,
      [
        durationUnit,
        durationValue,

        durationUnit,
        durationValue,

        durationUnit,
        durationValue,

        invoice.plan_type,
        invoice.subscription_id,
        companyId,
      ],
    );

    await connection.commit();

    /*
    |--------------------------------------------------------------------------
    | AUDIT LOGS
    |--------------------------------------------------------------------------
    */

    try {
      await createAuditLog({
        company_id: companyId,
        user_id: req.user?.id || null,
        action: "CREATE",
        module_name: "Subscription Payment",
        record_id: paymentResult.insertId,
        description:
          `Subscription invoice ` +
          `${invoice.invoice_number} paid for ` +
          `${invoice.plan_name}`,
        ip_address: req.ip,
      });

      await createAuditLog({
        company_id: companyId,
        user_id: req.user?.id || null,
        action: "UPDATE",
        module_name: "Subscription",
        record_id: invoice.subscription_id,
        description:
          `Subscription ${invoice.plan_name} ` + "activated after payment",
        ip_address: req.ip,
      });
    } catch (auditError) {
      console.error("SUBSCRIPTION PAYMENT AUDIT ERROR:", auditError);
    }

    /*
    |--------------------------------------------------------------------------
    | NOTIFICATION
    |--------------------------------------------------------------------------
    */

    try {
      await notifyCompanyAdmins({
        company_id: companyId,
        type: "subscription",
        exclude_user_id: req.user.id,
        severity: "medium",
        title: "Subscription Activated",
        message: `${invoice.plan_name} subscription activated.`,
      });
    } catch (notificationError) {
      console.error(
        "SUBSCRIPTION PAYMENT NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return res.status(200).json({
      message: "Subscription payment completed and plan activated successfully",

      subscription: {
        id: invoice.subscription_id,
        plan_name: invoice.plan_name,
        status: "active",
      },

      payment: {
        id: paymentResult.insertId,
        amount: Number(invoice.amount),
        payment_status: "paid",
        payment_method,
        transaction_id,
      },
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure
    }

    console.error("PAY MY SUBSCRIPTION ERROR:", error);

    return res.status(500).json({
      message: "Failed to pay subscription invoice",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
