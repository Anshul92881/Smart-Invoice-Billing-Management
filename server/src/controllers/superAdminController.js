import db from "../config/db.js";
import nodemailer from "nodemailer";

// SUPERADMIN DASHBOARD
export const getSuperAdminStats = async (req, res) => {
  try {
    const [companyRows] = await db.query(`
      SELECT COUNT(*) AS total_companies
      FROM tbl_companies
    `);

    const [activeRows] = await db.query(`
      SELECT COUNT(*) AS active_companies
      FROM tbl_companies
      WHERE status = 'active'
    `);

    const [adminRows] = await db.query(`
      SELECT COUNT(*) AS total_admins
      FROM tbl_users
      WHERE role = 'company_admin'
    `);

    const [revenueRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_revenue
      FROM tbl_subscription_payments
      WHERE payment_status = 'paid'
    `);

    const [recentCompanies] = await db.query(`
      SELECT
        id,
        name,
        email,
        phone,
        gst_number,
        pan_number,
        website,
        address,
        currency,
        status,
        created_at
      FROM tbl_companies
      ORDER BY id DESC
      LIMIT 5
    `);

    return res.json({
      stats: {
        total_companies: Number(companyRows[0].total_companies || 0),
        active_companies: Number(activeRows[0].active_companies || 0),
        total_admins: Number(adminRows[0].total_admins || 0),
        total_revenue: Number(revenueRows[0].total_revenue || 0),
      },
      recentCompanies,
    });
  } catch (error) {
    return res.status(500).json({
      message: "SuperAdmin dashboard error",
      error: error.message,
    });
  }
};

// SUPERADMIN COMPANY DETAILS + DRILLDOWN LISTS
export const getSuperAdminCompanyDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [companyRows] = await db.query(
      `
      SELECT
  id,
  name,
  email,
  phone,
  gst_number,
  pan_number,
  website,
  address,
  currency,
  status,

  kyc_status,
  kyc_attempts,
  kyc_verified_at,
  kyc_verified_by,
  kyc_rejection_reason,

  created_at
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

    const [adminRows] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        status,
        last_login_at,
        created_at
      FROM tbl_users
      WHERE company_id = ?
      AND role = 'company_admin'
      ORDER BY id DESC
      LIMIT 1
      `,
      [id],
    );

    const [branchRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_branches,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_branches,
        COALESCE(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), 0) AS inactive_branches
      FROM tbl_company_branches
      WHERE company_id = ?
      `,
      [id],
    );

    const [userRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_users,
        COALESCE(SUM(CASE WHEN role = 'accountant' THEN 1 ELSE 0 END), 0) AS accountants,
        COALESCE(SUM(CASE WHEN role = 'sales_user' THEN 1 ELSE 0 END), 0) AS sales_users
      FROM tbl_users
      WHERE company_id = ?
      `,
      [id],
    );

    const [invoiceRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_invoices,
        COALESCE(SUM(total_amount), 0) AS invoice_value,
        COALESCE(SUM(paid_amount), 0) AS paid_amount,
        COALESCE(SUM(balance_due), 0) AS pending_amount
      FROM tbl_invoices
      WHERE company_id = ?
      `,
      [id],
    );

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.status,
        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        sp.plan_name,
        sp.price,
        sp.billing_cycle,
        sp.max_users,
        sp.max_invoices,
        sp.max_branches
      FROM tbl_company_subscriptions cs
      LEFT JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE cs.company_id = ?
      ORDER BY cs.id DESC
      LIMIT 1
      `,
      [id],
    );

    const [subscriptionHistory] = await db.query(
  `
  SELECT
    cs.id,
    cs.status,
    cs.start_date,
    cs.trial_end_date,
    cs.renewal_date,
    cs.auto_renewal,
    cs.created_at,
    sp.plan_name,
    sp.price,
    sp.billing_cycle,
    sp.max_users,
    sp.max_invoices,
    sp.max_branches
  FROM tbl_company_subscriptions cs
  LEFT JOIN tbl_subscription_plans sp
    ON cs.plan_id = sp.id
  WHERE cs.company_id = ?
  ORDER BY cs.id DESC
  `,
  [id],
);

    const [subscriptionPaymentRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS total_revenue
      FROM tbl_subscription_payments
      WHERE company_id = ?
      `,
      [id],
    );

    const [branchList] = await db.query(
      `
      SELECT
        id,
        branch_name,
        branch_code,
        email,
        phone,
        city,
        state,
        status,
        created_at
      FROM tbl_company_branches
      WHERE company_id = ?
      ORDER BY id DESC
      `,
      [id],
    );

    const [userList] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.last_login_at,
        u.created_at,
        b.branch_name
      FROM tbl_users u
      LEFT JOIN tbl_company_branches b
        ON u.branch_id = b.id
      WHERE u.company_id = ?
      ORDER BY u.id DESC
      `,
      [id],
    );

    const [invoiceList] = await db.query(
      `
      SELECT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.paid_amount,
        i.balance_due,
        i.status,
        i.created_at,
        c.customer_name,
        b.branch_name
      FROM tbl_invoices i
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
      LEFT JOIN tbl_company_branches b
        ON i.branch_id = b.id
      WHERE i.company_id = ?
      ORDER BY i.id DESC
      LIMIT 25
      `,
      [id],
    );

    const [paymentList] = await db.query(
      `
      SELECT
        id,
        subscription_id,
        amount,
        payment_status,
        payment_method,
        transaction_id,
        payment_date,
        created_at
      FROM tbl_subscription_payments
      WHERE company_id = ?
      ORDER BY id DESC
      LIMIT 25
      `,
      [id],
    );

    return res.json({
      company: companyRows[0],
      admin: adminRows[0] || null,
      subscription: subscriptionRows[0] || null,
      subscriptionHistory: subscriptionHistory || [],
      branches: {
        total: Number(branchRows[0].total_branches || 0),
        active: Number(branchRows[0].active_branches || 0),
        inactive: Number(branchRows[0].inactive_branches || 0),
      },
      users: {
        total: Number(userRows[0].total_users || 0),
        accountants: Number(userRows[0].accountants || 0),
        sales_users: Number(userRows[0].sales_users || 0),
      },
      invoices: {
        total: Number(invoiceRows[0].total_invoices || 0),
        invoice_value: Number(invoiceRows[0].invoice_value || 0),
        paid_amount: Number(invoiceRows[0].paid_amount || 0),
        pending_amount: Number(invoiceRows[0].pending_amount || 0),
      },
      revenue: {
        total_payments: Number(subscriptionPaymentRows[0].total_payments || 0),
        total_revenue: Number(subscriptionPaymentRows[0].total_revenue || 0),
      },
      lists: {
        branches: branchList || [],
        users: userList || [],
        invoices: invoiceList || [],
        payments: paymentList || [],
      },
    });
  } catch (error) {
    console.error("Company details error:", error);

    return res.status(500).json({
      message: "Company details error",
      error: error.message,
    });
  }
};

const normalizeSmtpSecure = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
};

const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim(),
  );
};

const createSmtpTransporter = (settings) => {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port),
    secure: normalizeSmtpSecure(
      settings.smtp_secure,
    ),

    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });
};

/*
|--------------------------------------------------------------------------
| GET SUPERADMIN SMTP SETTINGS
|--------------------------------------------------------------------------
*/

export const getSuperAdminSmtpSettings = async (
  req,
  res,
) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_secure,
        from_email,
        from_name,
        reply_to,
        created_at,
        updated_at,

        CASE
          WHEN smtp_pass IS NOT NULL
            AND TRIM(smtp_pass) != ''
          THEN 1
          ELSE 0
        END AS has_password

      FROM tbl_superadmin_smtp_settings
      WHERE id = 1
      LIMIT 1
      `,
    );

    if (!rows.length) {
      return res.status(200).json({
        configured: false,
        settings: null,
      });
    }

    return res.status(200).json({
      configured: true,
      settings: {
        ...rows[0],

        smtp_secure:
          Number(rows[0].smtp_secure) === 1,

        has_password:
          Number(rows[0].has_password) === 1,
      },
    });
  } catch (error) {
    console.error(
      "GET SUPERADMIN SMTP SETTINGS ERROR:",
      error,
    );

    return res.status(500).json({
      message: "Failed to fetch SMTP settings",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| SAVE OR UPDATE SUPERADMIN SMTP SETTINGS
|--------------------------------------------------------------------------
*/

export const saveSuperAdminSmtpSettings = async (
  req,
  res,
) => {
  try {
    const smtpHost = String(
      req.body.smtp_host || "",
    ).trim();

    const smtpPort = Number(req.body.smtp_port);

    const smtpUser = String(
      req.body.smtp_user || "",
    ).trim();

    const enteredPassword = String(
      req.body.smtp_pass || "",
    ).trim();

    const smtpSecure = normalizeSmtpSecure(
      req.body.smtp_secure,
    );

    const fromEmail = String(
      req.body.from_email || "",
    ).trim();

    const fromName =
      String(req.body.from_name || "").trim() ||
      "Smart Invoice & Billing";

    const replyTo =
      String(req.body.reply_to || "").trim() ||
      null;

    if (!smtpHost) {
      return res.status(400).json({
        message: "SMTP host is required",
      });
    }

    if (
      !Number.isInteger(smtpPort) ||
      smtpPort < 1 ||
      smtpPort > 65535
    ) {
      return res.status(400).json({
        message: "Valid SMTP port is required",
      });
    }

    if (!smtpUser) {
      return res.status(400).json({
        message: "SMTP username is required",
      });
    }

    if (!isValidEmail(fromEmail)) {
      return res.status(400).json({
        message: "Valid from email is required",
      });
    }

    if (replyTo && !isValidEmail(replyTo)) {
      return res.status(400).json({
        message: "Reply-to email is invalid",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PASSWORD HANDLING
    |--------------------------------------------------------------------------
    | Update ke waqt blank password ka matlab existing password preserve karna.
    */

    const [existingRows] = await db.query(
      `
      SELECT smtp_pass
      FROM tbl_superadmin_smtp_settings
      WHERE id = 1
      LIMIT 1
      `,
    );

    let finalPassword = enteredPassword;

    if (!finalPassword && existingRows.length) {
      finalPassword =
        existingRows[0].smtp_pass;
    }

    if (!finalPassword) {
      return res.status(400).json({
        message: "SMTP password is required",
      });
    }

    await db.query(
      `
      INSERT INTO tbl_superadmin_smtp_settings
      (
        id,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_secure,
        from_email,
        from_name,
        reply_to
      )
      VALUES
      (
        1, ?, ?, ?, ?, ?, ?, ?, ?
      )

      ON DUPLICATE KEY UPDATE
        smtp_host = VALUES(smtp_host),
        smtp_port = VALUES(smtp_port),
        smtp_user = VALUES(smtp_user),
        smtp_pass = VALUES(smtp_pass),
        smtp_secure = VALUES(smtp_secure),
        from_email = VALUES(from_email),
        from_name = VALUES(from_name),
        reply_to = VALUES(reply_to)
      `,
      [
        smtpHost,
        smtpPort,
        smtpUser,
        finalPassword,
        smtpSecure ? 1 : 0,
        fromEmail,
        fromName,
        replyTo,
      ],
    );

    return res.status(200).json({
      message: "SMTP settings saved successfully",
      configured: true,
    });
  } catch (error) {
    console.error(
      "SAVE SUPERADMIN SMTP SETTINGS ERROR:",
      error,
    );

    return res.status(500).json({
      message: "Failed to save SMTP settings",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| TEST SUPERADMIN SMTP
|--------------------------------------------------------------------------
*/

export const testSuperAdminSmtpSettings = async (
  req,
  res,
) => {
  try {
    const testEmail = String(
      req.body.test_email || "",
    ).trim();

    if (!isValidEmail(testEmail)) {
      return res.status(400).json({
        message: "Valid test email is required",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_secure,
        from_email,
        from_name,
        reply_to
      FROM tbl_superadmin_smtp_settings
      WHERE id = 1
      LIMIT 1
      `,
    );

    if (!rows.length) {
      return res.status(400).json({
        message:
          "Please save SuperAdmin SMTP settings first",
      });
    }

    const settings = rows[0];

    const smtpTransporter =
      createSmtpTransporter(settings);

    await smtpTransporter.verify();

    await smtpTransporter.sendMail({
      from: {
        name:
          settings.from_name ||
          "Smart Invoice & Billing",

        address: settings.from_email,
      },

      to: testEmail,

      subject:
        "SuperAdmin SMTP Test - Smart Invoice",

      text:
        "Your SuperAdmin SMTP settings are working correctly.",

      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
          <h2 style="margin:0 0 12px;">
            SMTP Test Successful
          </h2>

          <p style="margin:0;line-height:1.6;">
            Your SuperAdmin SMTP settings are working correctly.
          </p>
        </div>
      `,

      ...(settings.reply_to
        ? {
            replyTo: settings.reply_to,
          }
        : {}),
    });

    return res.status(200).json({
      message: `Test email sent successfully to ${testEmail}`,
    });
  } catch (error) {
    console.error(
      "TEST SUPERADMIN SMTP ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Unable to send test email. Please check SMTP settings.",

      error: error.message,
    });
  }
};