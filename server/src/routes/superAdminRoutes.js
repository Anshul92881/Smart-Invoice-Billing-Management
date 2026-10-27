import express from "express";

import authMiddleware, {
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  getSuperAdminStats,
  getSuperAdminCompanyDetails,
  getSuperAdminSmtpSettings,
  saveSuperAdminSmtpSettings,
  testSuperAdminSmtpSettings,
} from "../controllers/superAdminController.js";

const router = express.Router();

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| SUPERADMIN DASHBOARD
|--------------------------------------------------------------------------
*/

router.get("/dashboard", authorizeRoles("superadmin"), getSuperAdminStats);

/*
|--------------------------------------------------------------------------
| SUPERADMIN SMTP SETTINGS
|--------------------------------------------------------------------------
*/

router.get(
  "/smtp-settings",
  authorizeRoles("superadmin"),
  getSuperAdminSmtpSettings,
);

router.put(
  "/smtp-settings",
  authorizeRoles("superadmin"),
  saveSuperAdminSmtpSettings,
);

router.post(
  "/smtp-settings/test",
  authorizeRoles("superadmin"),
  testSuperAdminSmtpSettings,
);

/*
|--------------------------------------------------------------------------
| SUPERADMIN COMPANY DETAILS
|--------------------------------------------------------------------------
*/

router.get(
  "/companies/:id/details",
  authorizeRoles("superadmin"),
  getSuperAdminCompanyDetails,
);

export default router;
