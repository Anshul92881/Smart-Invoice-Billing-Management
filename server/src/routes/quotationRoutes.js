import express from "express";

import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  cancelQuotation,
  convertQuotationToInvoice,
  downloadQuotation,
  sendQuotationEmail,
  pushQuotationToCrm,
  updateQuotation,
} from "../controllers/quotationController.js";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// Create
router.post(
  "/",
  authorizePermission("quotations"),
  createQuotation,
);

// List
router.get(
  "/",
  authorizePermission("quotations"),
  getQuotations,
);

// Download PDF
router.get(
  "/:id/download",
  authorizePermission("quotations"),
  downloadQuotation,
);

// Send Email
router.post(
  "/send-email/:id",
  authorizePermission("quotations"),
  sendQuotationEmail,
);

// Push to CRM
router.post(
  "/:id/push-to-crm",
  authorizeRoles(
    "company_admin",
    "accountant",
    "sales_user",
  ),
  pushQuotationToCrm,
);


// Edit Quotation
router.put(
  "/:id",
  authorizePermission("quotations"),
  updateQuotation,
);

// Get Single
router.get(
  "/:id",
  authorizePermission("quotations"),
  getQuotationById,
);

// Update Status
router.patch(
  "/:id/status",
  authorizePermission("quotations"),
  updateQuotationStatus,
);

// Cancel
router.patch(
  "/:id/cancel",
  authorizePermission("quotations"),
  cancelQuotation,
);

// Convert to Invoice
router.post(
  "/:id/convert-to-invoice",
  authorizePermission("quotations"),
  convertQuotationToInvoice,
);

export default router;