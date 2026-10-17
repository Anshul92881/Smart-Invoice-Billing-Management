import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  createProduct,
  getProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from "../controllers/productController.js";

import {
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
} from "../controllers/productVariantController.js";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

const productImageDir = path.join(process.cwd(), "upload", "product-images");

if (!fs.existsSync(productImageDir)) {
  fs.mkdirSync(productImageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productImageDir);
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

router.get(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getProducts,
);

router.get(
  "/dropdown",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getProducts,
);

router.get(
  "/:id",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getSingleProduct,
);

router.post(
  "/:id/image",
  authorizePermission("products"),
  upload.single("image"),
  uploadProductImage,
);

router.post("/", authorizePermission("products"), createProduct);
router.put("/:id", authorizePermission("products"), updateProduct);
router.delete("/:id", authorizePermission("products"), deleteProduct);

/* =========================================
   PRODUCT VARIANT ROUTES
========================================= */

router.get(
  "/:id/variants",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getProductVariants,
);

router.post(
  "/:id/variants",
  authorizePermission("products"),
  createProductVariant,
);

router.put(
  "/:id/variants/:variantId",
  authorizePermission("products"),
  updateProductVariant,
);

router.delete(
  "/:id/variants/:variantId",
  authorizePermission("products"),
  deleteProductVariant,
);

export default router;
