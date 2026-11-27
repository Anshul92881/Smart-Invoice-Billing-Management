import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";
import { emitDashboardUpdate } from "../utils/socketEvents.js";

const CATEGORY_REGEX = /^[a-zA-Z0-9\s&.,'()/-]+$/;

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/<[^>]*>?/gm, "")
    .trim();
};

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const isValidDate = (value) => {
  if (!value) return false;

  const text = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const date = new Date(`${text}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
};

const formatAmount = (amount) => Number(amount || 0).toFixed(2);

const getUserAgent = (req) => req.headers["user-agent"] || null;

const validateExpensePayload = ({
  vendor_id,
  branch_id,
  amount,
  category,
  notes,
  expense_date,
}) => {
  if (vendor_id && !isPositiveInteger(vendor_id)) {
    return "Valid vendor is required";
  }

  if (branch_id && !isPositiveInteger(branch_id)) {
    return "Valid branch is required";
  }

  const expenseAmount = toNumber(amount, NaN);
  const expenseCategory = normalizeText(category);
  const expenseNotes = normalizeText(notes);

  if (!Number.isFinite(expenseAmount)) {
    return "Valid expense amount is required";
  }

  if (expenseAmount <= 0) {
    return "Expense amount must be greater than 0";
  }

  if (expenseAmount > 999999999) {
    return "Expense amount is too large";
  }

  if (!expenseCategory) {
    return "Category is required";
  }

  if (expenseCategory.length < 2 || expenseCategory.length > 100) {
    return "Category must be between 2 and 100 characters";
  }

  if (!CATEGORY_REGEX.test(expenseCategory)) {
    return "Category contains invalid characters";
  }

  if (!isValidDate(expense_date)) {
    return "Valid expense date is required";
  }

  if (expenseNotes.length > 1000) {
    return "Notes must be less than 1000 characters";
  }

  return null;
};

const validateBranch = async (company_id, branch_id) => {
  if (!branch_id) return null;

  const [branchRows] = await db.query(
    `
    SELECT id, branch_name
    FROM tbl_company_branches
    WHERE id = ? AND company_id = ? AND status = 'active'
    LIMIT 1
    `,
    [branch_id, company_id],
  );

  if (branchRows.length === 0) {
    return { error: "Branch must be active and belong to the same company" };
  }

  return { branch: branchRows[0] };
};

const validateVendor = async (company_id, vendor_id) => {
  if (!vendor_id) return null;

  const [vendorRows] = await db.query(
    `
    SELECT id, vendor_name
    FROM tbl_vendors
    WHERE id = ? AND company_id = ? AND status = 'active'
    LIMIT 1
    `,
    [vendor_id, company_id],
  );

  if (vendorRows.length === 0) {
    return { error: "Vendor must be active and belong to the same company" };
  }

  return { vendor: vendorRows[0] };
};

const getMainBranchId = async (companyId) => {
  const [rows] = await db.query(
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

const getExpenseById = async (id, company_id) => {
  if (!isPositiveInteger(id)) return null;

  const [expenses] = await db.query(
    `
    SELECT
      e.*,
      v.vendor_name,
      v.company_name AS vendor_company_name,
      b.branch_name,
      b.branch_code
    FROM tbl_expenses e
    LEFT JOIN tbl_vendors v
      ON e.vendor_id = v.id
      AND v.company_id = e.company_id
    LEFT JOIN tbl_company_branches b
      ON e.branch_id = b.id
      AND b.company_id = e.company_id
    WHERE e.id = ? AND e.company_id = ?
    LIMIT 1
    `,
    [id, company_id],
  );

  return expenses[0] || null;
};

// CREATE EXPENSE
export const createExpense = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    const { vendor_id, branch_id, amount, category, notes, expense_date } =
      req.body;

    const validationError = validateExpensePayload({
      vendor_id,
      branch_id,
      amount,
      category,
      notes,
      expense_date,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const finalVendorId = vendor_id ? Number(vendor_id) : null;
    let finalBranchId = branch_id ? Number(branch_id) : null;

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(company_id);
    }

    if (!finalBranchId) {
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const expenseAmount = toNumber(amount);
    const expenseCategory = normalizeText(category);
    const expenseNotes = normalizeText(notes) || null;

    const branchValidation = await validateBranch(company_id, finalBranchId);

    if (branchValidation?.error) {
      return res.status(400).json({ message: branchValidation.error });
    }

    const vendorValidation = await validateVendor(company_id, finalVendorId);

    if (vendorValidation?.error) {
      return res.status(400).json({ message: vendorValidation.error });
    }

    const [expenseResult] = await db.query(
      `
      INSERT INTO tbl_expenses
      (
        company_id,
        vendor_id,
        branch_id,
        amount,
        category,
        notes,
        expense_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        finalVendorId,
        finalBranchId,
        expenseAmount,
        expenseCategory,
        expenseNotes,
        expense_date,
      ],
    );

    const expense = await getExpenseById(expenseResult.insertId, company_id);

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Expense",
      record_id: expenseResult.insertId,
      description: `Expense ${expenseCategory} of ₹${formatAmount(
        expenseAmount,
      )} created${
        vendorValidation?.vendor?.vendor_name
          ? ` for vendor ${vendorValidation.vendor.vendor_name}`
          : " as direct company expense"
      }${
        branchValidation?.branch?.branch_name
          ? ` in ${branchValidation.branch.branch_name}`
          : ""
      }`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({
      company_id,
    });

    return res.status(201).json({
      message: "Expense created successfully",
      expense,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create expense error",
      error: error.message,
    });
  }
};

// GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { branch_id } = req.query;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    const hasBranch = branch_id && branch_id !== "all";

    if (hasBranch && !isPositiveInteger(branch_id)) {
      return res.status(400).json({
        message: "Valid branch is required",
      });
    }

    if (hasBranch) {
      const branchValidation = await validateBranch(
        company_id,
        Number(branch_id),
      );

      if (branchValidation?.error) {
        return res.status(400).json({ message: branchValidation.error });
      }
    }

    const params = hasBranch ? [company_id, Number(branch_id)] : [company_id];

    const [expenses] = await db.query(
      `
      SELECT
        e.*,
        v.vendor_name,
        v.company_name AS vendor_company_name,
        b.branch_name,
        b.branch_code
      FROM tbl_expenses e
      LEFT JOIN tbl_vendors v
        ON e.vendor_id = v.id
        AND v.company_id = e.company_id
      LEFT JOIN tbl_company_branches b
        ON e.branch_id = b.id
        AND b.company_id = e.company_id
      WHERE e.company_id = ?
      ${hasBranch ? "AND e.branch_id = ?" : ""}
      ORDER BY e.expense_date DESC, e.id DESC
      `,
      params,
    );

    return res.json(expenses);
  } catch (error) {
    return res.status(500).json({
      message: "Get expenses error",
      error: error.message,
    });
  }
};

// GET SINGLE EXPENSE
export const getSingleExpense = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid expense id is required",
      });
    }

    const expense = await getExpenseById(id, company_id);

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    return res.json(expense);
  } catch (error) {
    return res.status(500).json({
      message: "Get expense error",
      error: error.message,
    });
  }
};

// UPDATE EXPENSE
export const updateExpense = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const { vendor_id, branch_id, amount, category, notes, expense_date } =
      req.body;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid expense id is required",
      });
    }

    const validationError = validateExpensePayload({
      vendor_id,
      branch_id,
      amount,
      category,
      notes,
      expense_date,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingExpense = await getExpenseById(id, company_id);

    if (!existingExpense) {
      return res.status(404).json({
        message: "Expense not found or not allowed",
      });
    }

    const finalVendorId = vendor_id ? Number(vendor_id) : null;
    let finalBranchId = branch_id ? Number(branch_id) : null;

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(company_id);
    }

    if (!finalBranchId) {
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const expenseAmount = toNumber(amount);
    const expenseCategory = normalizeText(category);
    const expenseNotes = normalizeText(notes) || null;

    const branchValidation = await validateBranch(company_id, finalBranchId);

    if (branchValidation?.error) {
      return res.status(400).json({ message: branchValidation.error });
    }

    const vendorValidation = await validateVendor(company_id, finalVendorId);

    if (vendorValidation?.error) {
      return res.status(400).json({ message: vendorValidation.error });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_expenses
      SET
        vendor_id = ?,
        branch_id = ?,
        amount = ?,
        category = ?,
        notes = ?,
        expense_date = ?
      WHERE id = ? AND company_id = ?
      `,
      [
        finalVendorId,
        finalBranchId,
        expenseAmount,
        expenseCategory,
        expenseNotes,
        expense_date,
        id,
        company_id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Expense not found or not allowed",
      });
    }

    const expense = await getExpenseById(id, company_id);

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Expense",
      record_id: id,
      description: `Expense ${expenseCategory} of ₹${formatAmount(
        expenseAmount,
      )} updated${
        vendorValidation?.vendor?.vendor_name
          ? ` for vendor ${vendorValidation.vendor.vendor_name}`
          : " as direct company expense"
      }${
        branchValidation?.branch?.branch_name
          ? ` in ${branchValidation.branch.branch_name}`
          : ""
      }`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({
      company_id,
    });

    return res.json({
      message: "Expense updated successfully",
      expense,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update expense error",
      error: error.message,
    });
  }
};

// DELETE EXPENSE
export const deleteExpense = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid expense id is required",
      });
    }

    const expense = await getExpenseById(id, company_id);

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found or not allowed",
      });
    }

    const [result] = await db.query(
      `
      DELETE FROM tbl_expenses
      WHERE id = ? AND company_id = ?
      `,
      [id, company_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Expense not found or not allowed",
      });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "DELETE",
      module_name: "Expense",
      record_id: id,
      description: `Expense ${expense.category} of ₹${formatAmount(
        expense.amount,
      )} deleted${expense.branch_name ? ` from ${expense.branch_name}` : ""}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    emitDashboardUpdate({
      company_id,
    });

    return res.json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete expense error",
      error: error.message,
    });
  }
};

// Get categories for the logged-in company
export const getExpenseCategories = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    const [categories] = await db.query(
      `
      SELECT
        id,
        category_name
      FROM tbl_expense_categories
      WHERE company_id = ?
        AND status = 'active'
      ORDER BY category_name ASC
      `,
      [company_id],
    );

    return res.status(200).json({
      categories,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch expense categories",
      error: error.message,
    });
  }
};

// Create category for the logged-in company
export const createExpenseCategory = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const categoryName = normalizeText(req.body.category_name);

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    if (!categoryName) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    if (categoryName.length < 2 || categoryName.length > 100) {
      return res.status(400).json({
        message: "Category must be between 2 and 100 characters",
      });
    }

    if (!CATEGORY_REGEX.test(categoryName)) {
      return res.status(400).json({
        message: "Category contains invalid characters",
      });
    }

    const [existingCategories] = await db.query(
      `
      SELECT id
      FROM tbl_expense_categories
      WHERE company_id = ?
        AND LOWER(category_name) = LOWER(?)
      LIMIT 1
      `,
      [company_id, categoryName],
    );

    if (existingCategories.length > 0) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO tbl_expense_categories
      (
        company_id,
        category_name,
        is_system,
        status
      )
      VALUES (?, ?, 0, 'active')
      `,
      [company_id, categoryName],
    );

    return res.status(201).json({
      message: "Category added successfully",
      category: {
        id: result.insertId,
        category_name: categoryName,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to add expense category",
      error: error.message,
    });
  }
};
