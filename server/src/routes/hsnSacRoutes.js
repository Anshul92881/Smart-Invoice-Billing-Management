import express from "express";

import {
  searchHsnSac,
  suggestHsnSac,
  getHsnSacByCode,
} from "../controllers/hsnSacController.js";

const router = express.Router();

/*
 * GET /api/hsn-sac/search
 * GET /api/hsn-sac/suggest
 * GET /api/hsn-sac/code/:code
 *
 * Read-only endpoints.
 * Authentication and KYC middleware are already
 * configured globally in app.js.
 */

router.get("/search", searchHsnSac);

router.get("/suggest", suggestHsnSac);

router.get("/code/:code", getHsnSacByCode);

export default router;
