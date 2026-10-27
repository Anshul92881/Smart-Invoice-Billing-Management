import express from "express";

import {
  getPlans,
  createPlan,
  updatePlan,
  getCompanySubscriptions,
  assignSubscription,
  toggleAutoRenewal,
  recordSubscriptionPayment,
  getSubscriptionPayments,
  generateSubscriptionInvoice,
  getSubscriptionInvoices,
  getMySubscription,
  getMySubscriptionInvoices,
  getMySubscriptionPayments,
  payMySubscriptionInvoice,
  getMyAllSubscriptions,
  downloadMySubscriptionInvoice,
  downloadMyPaymentReceipt,
  buySubscriptionPlan,
  deletePlan,
  downloadSubscriptionInvoice,
} from "../controllers/subscriptionController.js";

import authMiddleware, {
  authorizeRoles,
  authorizePermission,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

const allowCompanyBilling = (req, res, next) => {
  return authorizePermission("billing")(req, res, next);
};

const allowSubscriptionAutoRenewal = (req, res, next) => {
  if (req.user.role === "superadmin") {
    return next();
  }

  return authorizePermission("billing")(req, res, next);
};

/* COMPANY SIDE BILLING */
router.get("/my/current", allowCompanyBilling, getMySubscription);
router.get("/my/plans", allowCompanyBilling, getPlans);
router.get("/my/all", allowCompanyBilling, getMyAllSubscriptions);
router.get("/my/invoices", allowCompanyBilling, getMySubscriptionInvoices);
router.get("/my/payments", allowCompanyBilling, getMySubscriptionPayments);
router.post("/my/pay", allowCompanyBilling, payMySubscriptionInvoice);
router.post("/my/buy-plan", allowCompanyBilling, buySubscriptionPlan);

router.get(
  "/my/invoices/:id/download",
  allowCompanyBilling,
  downloadMySubscriptionInvoice,
);

router.get(
  "/my/payments/:id/receipt",
  allowCompanyBilling,
  downloadMyPaymentReceipt,
);

/* SHARED */
router.put(
  "/:id/auto-renewal",
  allowSubscriptionAutoRenewal,
  toggleAutoRenewal,
);

/* SUPERADMIN - PLANS */
router.get("/plans", authorizeRoles("superadmin"), getPlans);
router.post("/plans", authorizeRoles("superadmin"), createPlan);
router.put("/plans/:id", authorizeRoles("superadmin"), updatePlan);
router.delete("/plans/:id", authorizeRoles("superadmin"), deletePlan);

/* SUPERADMIN - PAYMENTS */
router.get(
  "/payments/all",
  authorizeRoles("superadmin"),
  getSubscriptionPayments,
);

router.post(
  "/payments",
  authorizeRoles("superadmin"),
  recordSubscriptionPayment,
);

/* SUPERADMIN - INVOICES */
router.get(
  "/invoices/all",
  authorizeRoles("superadmin"),
  getSubscriptionInvoices,
);

router.get(
  "/invoices/:id/download",
  authorizeRoles("superadmin"),
  downloadSubscriptionInvoice,
);

router.post(
  "/invoices",
  authorizeRoles("superadmin"),
  generateSubscriptionInvoice,
);

/* SUPERADMIN - COMPANY SUBSCRIPTIONS */
router.get("/", authorizeRoles("superadmin"), getCompanySubscriptions);
router.post("/", authorizeRoles("superadmin"), assignSubscription);

export default router;