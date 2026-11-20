import db from "../config/db.js";

export const getReports = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { branch_id } = req.query;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const hasBranch = branch_id && branch_id !== "all";

    if (hasBranch) {
      const [branchRows] = await db.query(
        `
        SELECT id
        FROM tbl_company_branches
        WHERE id = ?
        AND company_id = ?
        AND status = 'active'
        LIMIT 1
        `,
        [branch_id, company_id],
      );

      if (branchRows.length === 0) {
        return res.status(404).json({ message: "Branch not found" });
      }
    }

    const customerWhere = hasBranch
      ? `WHERE company_id = ? AND branch_id = ?`
      : `WHERE company_id = ?`;

    const productWhere = hasBranch
      ? `WHERE company_id = ? AND branch_id = ?`
      : `WHERE company_id = ?`;

    const invoiceWhere = hasBranch
      ? `WHERE company_id = ? AND branch_id = ?`
      : `WHERE company_id = ?`;

    const expenseWhere = hasBranch
      ? `WHERE company_id = ? AND branch_id = ?`
      : `WHERE company_id = ?`;

    const baseParams = hasBranch ? [company_id, branch_id] : [company_id];

    const [branchRows] = await db.query(
      `
      SELECT id, branch_name, branch_code
      FROM tbl_company_branches
      WHERE company_id = ?
      ORDER BY is_main DESC, branch_name ASC
      `,
      [company_id],
    );

    const [customerRows] = await db.query(
      `SELECT COUNT(*) AS total_customers FROM tbl_customers ${customerWhere}`,
      baseParams,
    );

    const [productRows] = await db.query(
      `SELECT COUNT(*) AS total_products FROM tbl_products ${productWhere}`,
      baseParams,
    );

    const [invoiceRows] = await db.query(
      `
  SELECT
    COUNT(*) AS total_invoices,

    COALESCE(SUM(total_amount), 0) AS total_sales,

    COALESCE(SUM(total_tax), 0) AS total_tax,

    SUM(
      CASE
        WHEN status = 'paid' THEN 1
        ELSE 0
      END
    ) AS paid_invoices,

    SUM(
      CASE
        WHEN status = 'partial' THEN 1
        ELSE 0
      END
    ) AS partial_invoices,

    SUM(
      CASE
        WHEN status NOT IN ('paid', 'cancelled') THEN 1
        ELSE 0
      END
    ) AS pending_invoices,

    SUM(
      CASE
        WHEN status = 'cancelled' THEN 1
        ELSE 0
      END
    ) AS cancelled_invoices,

    COALESCE(
      SUM(
        CASE
          WHEN status NOT IN ('paid', 'cancelled')
          THEN balance_due
          ELSE 0
        END
      ),
      0
    ) AS pending_amount

  FROM tbl_invoices
  ${invoiceWhere}
  `,
      baseParams,
    );

    const [paymentRows] = await db.query(
      `
      SELECT COALESCE(SUM(p.amount), 0) AS total_received
      FROM tbl_payments p
      JOIN tbl_invoices i ON p.invoice_id = i.id
      WHERE i.company_id = ?
      ${hasBranch ? "AND i.branch_id = ?" : ""}
      `,
      baseParams,
    );

    const [expenseRows] = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS total_expense
      FROM tbl_expenses
      ${expenseWhere}
      `,
      baseParams,
    );

    const totalSales = Number(invoiceRows[0].total_sales || 0);
    const totalReceived = Number(paymentRows[0].total_received || 0);
    const totalExpense = Number(expenseRows[0].total_expense || 0);
    const pendingAmount = Number(invoiceRows[0].pending_amount || 0);
    const netProfit = totalReceived - totalExpense;

    const [monthlySales] = await db.query(
      `
  SELECT
    DATE_FORMAT(invoice_date, '%b') AS month,
    MONTH(invoice_date) AS month_number,
    COALESCE(SUM(total_amount), 0) AS sales
  FROM tbl_invoices
  ${invoiceWhere}
  AND status != 'cancelled'
  GROUP BY MONTH(invoice_date), DATE_FORMAT(invoice_date, '%b')
  ORDER BY month_number
  `,
      baseParams,
    );

    const [monthlyExpenses] = await db.query(
      `
      SELECT
        DATE_FORMAT(expense_date, '%b') AS month,
        MONTH(expense_date) AS month_number,
        COALESCE(SUM(amount), 0) AS expenses
      FROM tbl_expenses
      ${expenseWhere}
      GROUP BY MONTH(expense_date), DATE_FORMAT(expense_date, '%b')
      ORDER BY month_number
      `,
      baseParams,
    );

    const [topCustomers] = await db.query(
  `
  SELECT
    i.customer_id,
    c.customer_name,

    CASE
      WHEN COUNT(DISTINCT i.branch_id) > 1
      THEN 'Multiple Branches'
      ELSE MAX(b.branch_name)
    END AS branch_name,

    COALESCE(SUM(i.total_amount), 0) AS total_sales

  FROM tbl_invoices i

  LEFT JOIN tbl_customers c
    ON i.customer_id = c.id

  LEFT JOIN tbl_company_branches b
    ON i.branch_id = b.id

  WHERE i.company_id = ?
    ${hasBranch ? "AND i.branch_id = ?" : ""}
    AND i.status != 'cancelled'

  GROUP BY
    i.customer_id,
    c.customer_name

  ORDER BY total_sales DESC
  LIMIT 5
  `,
  baseParams,
);

    const [recentInvoices] = await db.query(
      `
      SELECT 
        i.*, 
        c.customer_name,
        b.branch_name,
        b.branch_code
      FROM tbl_invoices i
      LEFT JOIN tbl_customers c ON i.customer_id = c.id
      LEFT JOIN tbl_company_branches b ON i.branch_id = b.id
      WHERE i.company_id = ?
      ${hasBranch ? "AND i.branch_id = ?" : ""}
      ORDER BY i.id DESC
      LIMIT 5
      `,
      baseParams,
    );

    const [recentPayments] = await db.query(
      `
      SELECT
        p.*,
        i.invoice_number,
        i.branch_id,
        c.customer_name,
        b.branch_name,
        b.branch_code
      FROM tbl_payments p
      JOIN tbl_invoices i ON p.invoice_id = i.id
      LEFT JOIN tbl_customers c ON i.customer_id = c.id
      LEFT JOIN tbl_company_branches b ON i.branch_id = b.id
      WHERE p.company_id = ?
      ${hasBranch ? "AND i.branch_id = ?" : ""}
      ORDER BY p.id DESC
      LIMIT 5
      `,
      baseParams,
    );

    const [monthlyInvoices] = await db.query(
      `
  SELECT
    DATE_FORMAT(invoice_date, '%b') AS month,
    MONTH(invoice_date) AS month_number,
    COUNT(*) AS invoice_count
  FROM tbl_invoices
  ${invoiceWhere}
  GROUP BY MONTH(invoice_date), DATE_FORMAT(invoice_date, '%b')
  ORDER BY month_number
  `,
      baseParams,
    );

    const [topProducts] = await db.query(
      `
  SELECT
    p.product_name,
    p.sku,
    COALESCE(SUM(ii.quantity), 0) AS quantity_sold,
    COALESCE(SUM(ii.total), 0) AS total_sales
  FROM tbl_invoice_items ii
  JOIN tbl_invoices i ON ii.invoice_id = i.id
  LEFT JOIN tbl_products p ON ii.product_id = p.id
  WHERE i.company_id = ?
  ${hasBranch ? "AND i.branch_id = ?" : ""}
  GROUP BY ii.product_id, p.product_name, p.sku
  ORDER BY total_sales DESC
  LIMIT 5
  `,
      baseParams,
    );

    const [branchPerformance] = await db.query(
      `
  SELECT
    b.id,
    b.branch_name,
    b.branch_code,
    COALESCE(inv.total_sales, 0) AS total_sales,
    COALESCE(exp.total_expense, 0) AS total_expense,
    COALESCE(inv.total_sales, 0) - COALESCE(exp.total_expense, 0) AS profit
  FROM tbl_company_branches b
  LEFT JOIN (
    SELECT branch_id, SUM(total_amount) AS total_sales
    FROM tbl_invoices
    WHERE company_id = ?
    GROUP BY branch_id
  ) inv ON inv.branch_id = b.id
  LEFT JOIN (
    SELECT branch_id, SUM(amount) AS total_expense
    FROM tbl_expenses
    WHERE company_id = ?
    GROUP BY branch_id
  ) exp ON exp.branch_id = b.id
  WHERE b.company_id = ?
  ORDER BY total_sales DESC
  LIMIT 5
  `,
      [company_id, company_id, company_id],
    );

    const [outstandingCollections] = await db.query(
      `
  SELECT
    c.customer_name,
    b.branch_name,
    COALESCE(SUM(i.balance_due), 0) AS pending_amount
  FROM tbl_invoices i
  LEFT JOIN tbl_customers c ON i.customer_id = c.id
  LEFT JOIN tbl_company_branches b ON i.branch_id = b.id
  WHERE i.company_id = ?
  ${hasBranch ? "AND i.branch_id = ?" : ""}
  AND i.status NOT IN ('paid', 'cancelled')
  GROUP BY i.customer_id, c.customer_name, b.branch_name
  HAVING pending_amount > 0
  ORDER BY pending_amount DESC
  LIMIT 5
  `,
      baseParams,
    );

    const [taxReport] = await db.query(
      `
  SELECT
    'GST' AS tax_name,
    COALESCE(SUM(total_tax), 0) AS amount
  FROM tbl_invoices
  ${invoiceWhere}
  `,
      baseParams,
    );

    return res.json({
      branches: branchRows,
      selected_branch_id: hasBranch ? Number(branch_id) : null,
      summary: {
        total_customers: Number(customerRows[0].total_customers || 0),
        total_products: Number(productRows[0].total_products || 0),
        total_invoices: Number(invoiceRows[0].total_invoices || 0),
        paid_invoices: Number(invoiceRows[0].paid_invoices || 0),
        partial_invoices: Number(invoiceRows[0].partial_invoices || 0),
        pending_invoices: Number(invoiceRows[0].pending_invoices || 0),
        cancelled_invoices: Number(invoiceRows[0].cancelled_invoices || 0),
        total_sales: totalSales,
        total_received: totalReceived,
        pending_amount: pendingAmount,
        total_expense: totalExpense,
        total_tax: Number(invoiceRows[0].total_tax || 0),
        net_profit: netProfit,
      },
      monthlySales,
      monthlyExpenses,
      topCustomers,
      recentInvoices,
      recentPayments,
      monthlyInvoices,
      topProducts,
      branchPerformance,
      outstandingCollections,
      taxReport,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Reports fetch error",
      error: error.message,
    });
  }
};
