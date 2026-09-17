import express from "express";

import {
  createInvoice,
  getInvoices,
  getSingleInvoice,
  updateInvoice,
  cancelInvoice,
  downloadInvoice,
  sendInvoiceEmail,
} from "../controllers/invoiceController.js";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", authorizePermission("invoices"), createInvoice);

router.get(
  "/:id/download",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  downloadInvoice,
);

router.get(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getInvoices,
);

router.get(
  "/:id",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getSingleInvoice,
);

router.put("/:id", authorizePermission("invoices"), updateInvoice);

router.patch("/:id/cancel", authorizePermission("invoices"), cancelInvoice);

router.post(
  "/send-email/:id",
  authorizePermission("invoices"),
  sendInvoiceEmail,
);

export default router;
