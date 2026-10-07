import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import authMiddleware, {
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  getMyKycStatus,
  uploadCompanyKycDocuments,
  getAllKycRequests,
  getKycRequestByCompany,
  uploadSuperAdminKycDocuments,
  saveSuperAdminKycDetails,
  addOrUpdateVerifiedKycDetails,
  rejectKyc,
  unblockCompany,
  skipKyc,
} from "../controllers/kycController.js";

import {
  sendAadhaarOtp,
  verifyAadhaarOtp,
  verifyPan,
  verifyGst,
  verifyTan,
} from "../controllers/kycVerificationController.js";

const router = express.Router();

const kycUploadDir = path.join(
  process.cwd(),
  "upload",
  "kyc-documents",
);

if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, kycUploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    const fileName = `${Date.now()}-${Math.floor(
      100000 + Math.random() * 900000,
    )}${ext}`;

    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only PDF, JPG, PNG and WEBP files are allowed",
      ),
      false,
    );
  }
};

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const kycFiles = upload.fields([
  {
    name: "aadhaar_card",
    maxCount: 1,
  },
  {
    name: "pan_card",
    maxCount: 1,
  },
  {
    name: "gst_certificate",
    maxCount: 1,
  },
  {
    name: "tan_document",
    maxCount: 1,
  },
]);

const handleKycFiles = (
  req,
  res,
  next,
) => {
  kycFiles(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message:
          error.message ||
          "KYC file upload failed",
      });
    }

    next();
  });
};

/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| COMPANY ADMIN KYC
|--------------------------------------------------------------------------
*/

router.get(
  "/my-status",
  authorizeRoles("company_admin"),
  getMyKycStatus,
);

router.post(
  "/skip",
  authorizeRoles("company_admin"),
  skipKyc,
);

router.post(
  "/upload",
  authorizeRoles("company_admin"),
  handleKycFiles,
  uploadCompanyKycDocuments,
);

router.post(
  "/aadhaar/send-otp",
  authorizeRoles("company_admin"),
  sendAadhaarOtp,
);

router.post(
  "/aadhaar/verify-otp",
  authorizeRoles("company_admin"),
  verifyAadhaarOtp,
);

router.post(
  "/pan/verify",
  authorizeRoles("company_admin"),
  verifyPan,
);

router.post(
  "/gst/verify",
  authorizeRoles("company_admin"),
  verifyGst,
);

router.post(
  "/tan/verify",
  authorizeRoles("company_admin"),
  verifyTan,
);

/*
|--------------------------------------------------------------------------
| SUPER ADMIN KYC MANAGEMENT
|--------------------------------------------------------------------------
*/

router.get(
  "/requests",
  authorizeRoles("superadmin"),
  getAllKycRequests,
);

router.get(
  "/requests/:companyId",
  authorizeRoles("superadmin"),
  getKycRequestByCompany,
);

/*
|--------------------------------------------------------------------------
| SUPER ADMIN - UNIFIED KYC DETAILS
|--------------------------------------------------------------------------
|
| This is the main SuperAdmin KYC endpoint.
|
| Used for:
|
| pending / submitted / rejected / blocked
| -> manual verification + activation
|
| approved / manual_verified
| -> only update KYC details/documents
|
|--------------------------------------------------------------------------
*/

router.patch(
  "/superadmin/:companyId/kyc-details",
  authorizeRoles("superadmin"),
  handleKycFiles,
  saveSuperAdminKycDetails,
);

/*
|--------------------------------------------------------------------------
| LEGACY SUPER ADMIN KYC ROUTES
|--------------------------------------------------------------------------
|
| Keep temporarily during migration/testing.
|
| Frontend should NOT use these anymore.
|
| Remove only after the new /kyc-details flow
| has been fully tested.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/superadmin/:companyId/upload",
  authorizeRoles("superadmin"),
  handleKycFiles,
  uploadSuperAdminKycDocuments,
);

router.patch(
  "/superadmin/:companyId/verified-details",
  authorizeRoles("superadmin"),
  handleKycFiles,
  addOrUpdateVerifiedKycDetails,
);

/*
|--------------------------------------------------------------------------
| SUPER ADMIN KYC VERIFICATION APIs
|--------------------------------------------------------------------------
|
| Existing API verification routes.
| Do not change during unified KYC migration.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/superadmin/:companyId/aadhaar/send-otp",
  authorizeRoles("superadmin"),
  sendAadhaarOtp,
);

router.post(
  "/superadmin/:companyId/aadhaar/verify-otp",
  authorizeRoles("superadmin"),
  verifyAadhaarOtp,
);

router.post(
  "/superadmin/:companyId/pan/verify",
  authorizeRoles("superadmin"),
  verifyPan,
);

router.post(
  "/superadmin/:companyId/gst/verify",
  authorizeRoles("superadmin"),
  verifyGst,
);

router.post(
  "/superadmin/:companyId/tan/verify",
  authorizeRoles("superadmin"),
  verifyTan,
);

/*
|--------------------------------------------------------------------------
| SUPER ADMIN KYC ACTIONS
|--------------------------------------------------------------------------
*/

router.patch(
  "/superadmin/:companyId/reject",
  authorizeRoles("superadmin"),
  rejectKyc,
);

router.patch(
  "/superadmin/:companyId/unblock",
  authorizeRoles("superadmin"),
  unblockCompany,
);

export default router;