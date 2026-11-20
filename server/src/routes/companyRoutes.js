import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import authMiddleware, {
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  createCompany,
  getCompanies,
  getMyCompany,
  updateCompany,
  deleteCompany,
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
  getInactiveCompanies,
  getRolePermissions,
  updateRolePermissions,
  getBillingTemplate,
  updateBillingTemplate,
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
} from "../controllers/companyController.js";

const router = express.Router();

/* =========================
   MULTER CONFIG
========================= */

const logoDir = path.join(process.cwd(), "upload", "company-logos");

if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${randomNumber}${ext}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

router.use(authMiddleware);

/* =========================
   COMPANY ADMIN
========================= */

router.get("/my-company", authorizeRoles("company_admin"), getMyCompany);
router.put("/my-company", authorizeRoles("company_admin"), updateCompany);

router.get(
  "/email-settings",
  authorizeRoles("company_admin"),
  getEmailSettings,
);

router.put(
  "/email-settings",
  authorizeRoles("company_admin"),
  updateEmailSettings,
);

router.post("/test-email", authorizeRoles("company_admin"), sendTestEmail);

router.post(
  "/my-company/logo",
  authorizeRoles("company_admin"),
  upload.single("logo"),
  uploadCompanyLogo,
);

router.get(
  "/my-company/settings",
  authorizeRoles("company_admin"),
  getCompanySettings,
);

router.put(
  "/my-company/settings",
  authorizeRoles("company_admin"),
  updateCompanySettings,
);

router.get(
  "/role-permissions",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getRolePermissions,
);

router.put(
  "/role-permissions",
  authorizeRoles("company_admin"),
  updateRolePermissions,
);

router.get(
  "/billing-template",
  authorizeRoles("company_admin"),
  getBillingTemplate,
);

router.put(
  "/billing-template",
  authorizeRoles("company_admin"),
  updateBillingTemplate,
);

/* =========================
   SUPERADMIN
========================= */

router.post("/", authorizeRoles("superadmin"), createCompany);
router.get("/", authorizeRoles("superadmin"), getCompanies);

router.get(
  "/inactive-companies",
  authorizeRoles("superadmin"),
  getInactiveCompanies,
);

router.put("/:id", authorizeRoles("superadmin"), updateCompany);
router.delete("/:id", authorizeRoles("superadmin"), deleteCompany);


export default router;
