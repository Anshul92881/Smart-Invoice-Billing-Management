import db from "../config/db.js";

/* =========================================
   COMMON HELPERS
========================================= */

const normalizeText = (value) => {
  if (typeof value !== "string") return "";

  return value
    .replace(/<[^>]*>?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeType = (value) => {
  const type = normalizeText(value).toUpperCase();

  return ["HSN", "SAC"].includes(type) ? type : null;
};

const getLimit = (value, fallback = 20, max = 50) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return Math.min(number, max);
};

const getPage = (value) => {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? Math.min(number, 10000) : 1;
};

const escapeLike = (value) => value.replace(/[!%_]/g, (match) => `!${match}`);

// Keep NULL as NULL, not 0%.
const formatGstRate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const rate = Number(value);
  return Number.isFinite(rate) ? rate : null;
};

/* =========================================
   GET /api/hsn-sac/search
========================================= */

export const searchHsnSac = async (req, res) => {
  try {
    const q = normalizeText(req.query.q);
    const rawType = normalizeText(req.query.type);
    const type = normalizeType(rawType);

    const limit = getLimit(req.query.limit);
    const page = getPage(req.query.page);
    const offset = (page - 1) * limit;

    if (q.length < 2 || q.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Search query must contain 2 to 150 characters",
      });
    }

    if (rawType && !type) {
      return res.status(400).json({
        success: false,
        message: "Type must be HSN or SAC",
      });
    }

    const escapedQuery = escapeLike(q);
    const startsWith = `${escapedQuery}%`;
    const contains = `%${escapedQuery}%`;

    let whereClause = `
      WHERE (
        code LIKE ? ESCAPE '!'
        OR description LIKE ? ESCAPE '!'
      )
    `;

    const params = [startsWith, contains];

    if (type) {
      whereClause += " AND type = ?";
      params.push(type);
    }

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM tbl_hsn_sac_master
        ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.query(
      `
        SELECT
          id,
          code,
          description,
          type,
          gst_rate
        FROM tbl_hsn_sac_master
        ${whereClause}
        ORDER BY
          CASE
            WHEN code = ? THEN 0
            WHEN code LIKE ? ESCAPE '!' THEN 1
            WHEN description LIKE ? ESCAPE '!' THEN 2
            ELSE 3
          END,
          CHAR_LENGTH(code) ASC,
          code ASC
        LIMIT ? OFFSET ?
      `,
      [...params, q, startsWith, startsWith, limit, offset],
    );

    return res.json({
      success: true,
      query: q,
      type: type || "ALL",
      results: rows.map((row) => ({
        ...row,
        gst_rate: formatGstRate(row.gst_rate),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("HSN/SAC SEARCH ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to search HSN/SAC codes",
    });
  }
};

/* =========================================
   GET /api/hsn-sac/suggest

   Suggest HSN/SAC from product name.
========================================= */

export const suggestHsnSac = async (req, res) => {
  try {
    const productName = normalizeText(req.query.product_name);
    const rawType = normalizeText(req.query.type);
    const type = normalizeType(rawType);

    const limit = getLimit(req.query.limit, 10, 20);

    if (productName.length < 3 || productName.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Product name must contain 3 to 150 characters",
      });
    }

    if (rawType && !type) {
      return res.status(400).json({
        success: false,
        message: "Type must be HSN or SAC",
      });
    }

    const stopWords = new Set([
      "the",
      "and",
      "for",
      "with",
      "from",
      "this",
      "that",
      "product",
      "item",
      "new",
    ]);

    const keywords = [
      ...new Set(
        productName
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length >= 3 && !stopWords.has(word)),
      ),
    ].slice(0, 6);

    if (keywords.length === 0) {
      return res.json({
        success: true,
        product_name: productName,
        suggestions: [],
        message: "Enter a more descriptive product name",
      });
    }

    const conditions = [];
    const params = [];

    for (const word of keywords) {
      conditions.push("description LIKE ? ESCAPE '!'");
      params.push(`%${escapeLike(word)}%`);
    }

    let whereClause = `
      WHERE (${conditions.join(" OR ")})
    `;

    if (type) {
      whereClause += " AND type = ?";
      params.push(type);
    }

    const scoreExpressions = keywords.map(
      () => "CASE WHEN description LIKE ? ESCAPE '!' THEN 1 ELSE 0 END",
    );

    const scoreParams = keywords.map((word) => `%${escapeLike(word)}%`);

    const [rows] = await db.query(
      `
        SELECT
          id,
          code,
          description,
          type,
          gst_rate,
          (${scoreExpressions.join(" + ")}) AS match_score
        FROM tbl_hsn_sac_master
        ${whereClause}
        ORDER BY
          match_score DESC,
          CHAR_LENGTH(description) ASC,
          CHAR_LENGTH(code) DESC,
          code ASC
        LIMIT ?
      `,
      [...scoreParams, ...params, limit],
    );

    return res.json({
      success: true,
      product_name: productName,
      suggestions: rows.map((row) => ({
        id: row.id,
        code: row.code,
        description: row.description,
        type: row.type,
        gst_rate: formatGstRate(row.gst_rate),
        match_score: Number(row.match_score),
        requires_confirmation: true,
      })),
      message:
        "Suggestions are keyword matches, not verified tax classifications.",
    });
  } catch (error) {
    console.error("HSN/SAC SUGGEST ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to suggest HSN/SAC codes",
    });
  }
};

/* =========================================
   GET /api/hsn-sac/code/:code

   Fetch exact HSN/SAC code.
========================================= */

export const getHsnSacByCode = async (req, res) => {
  try {
    const code = normalizeText(req.params.code);
    const rawType = normalizeText(req.query.type);
    const type = normalizeType(rawType);

    if (!/^\d{2,8}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Valid HSN/SAC code must contain 2 to 8 digits",
      });
    }

    if (rawType && !type) {
      return res.status(400).json({
        success: false,
        message: "Type must be HSN or SAC",
      });
    }

    let query = `
      SELECT
        id,
        code,
        description,
        type,
        gst_rate
      FROM tbl_hsn_sac_master
      WHERE code = ?
    `;

    const params = [code];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY type ASC LIMIT 2";

    const [rows] = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "HSN/SAC code not found",
      });
    }

    return res.json({
      success: true,
      results: rows.map((row) => ({
        ...row,
        gst_rate: formatGstRate(row.gst_rate),
      })),
    });
  } catch (error) {
    console.error("GET HSN/SAC ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch HSN/SAC code",
    });
  }
};
