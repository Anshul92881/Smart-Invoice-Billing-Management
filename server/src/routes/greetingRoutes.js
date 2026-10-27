import crypto from "crypto";
import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";

import {
  cancelGreeting,
  createBulkGreetings,
  createGreeting,
  deleteGreeting,
  getGreetingRecipientCount,
  getGreetings,
  getSingleGreeting,
  updateGreeting,
  uploadGreetingBanner,
} from "../controllers/greetingController.js";

import { authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

const greetingBannerDirectory = path.join(
  process.cwd(),
  "upload",
  "greeting-banners",
);

if (!fs.existsSync(greetingBannerDirectory)) {
  fs.mkdirSync(greetingBannerDirectory, {
    recursive: true,
  });
}

const createRandomCode = () => {
  return crypto
    .randomBytes(8)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, greetingBannerDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(null, `GREETING-${createRandomCode()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPG, JPEG, PNG and WEBP images are allowed"),
      false,
    );
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

router.use(authorizeRoles("superadmin", "company_admin"));

router.get("/recipient-count", getGreetingRecipientCount);

router.post("/banner", upload.single("banner"), uploadGreetingBanner);

router.post("/bulk", createBulkGreetings);

router.get("/", getGreetings);

router.post("/", createGreeting);

router.get("/:id", getSingleGreeting);

router.put("/:id", updateGreeting);

router.patch("/:id/cancel", cancelGreeting);

router.delete("/:id", deleteGreeting);

export default router;
