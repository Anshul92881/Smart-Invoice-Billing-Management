import express from "express";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  createExpense,
  getExpenses,
  getSingleExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories,
  createExpenseCategory,
} from "../controllers/expenseController.js";

const router = express.Router();

router.use(authMiddleware);

const allowedExpenseRoles = authorizeRoles(
  "company_admin",
  "accountant",
  "sales_user",
);

// Get expense list
router.get(
  "/",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  getExpenses,
);

// Get categories for the logged-in company
router.get(
  "/categories",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  getExpenseCategories,
);

// Create category for the logged-in company
router.post(
  "/categories",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  createExpenseCategory,
);

// Get single expense
router.get(
  "/:id",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  getSingleExpense,
);

// Create expense
router.post(
  "/",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  createExpense,
);

// Update expense
router.put(
  "/:id",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  updateExpense,
);

// Delete expense
router.delete(
  "/:id",
  allowedExpenseRoles,
  authorizePermission("expenses"),
  deleteExpense,
);

export default router;
