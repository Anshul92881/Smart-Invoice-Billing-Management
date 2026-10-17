import crypto from "node:crypto";
import db from "../config/db.js";

const SKU_REGEX = /^[A-Z0-9_-]{2,50}$/;
const ALLOWED_STATUS = ["active", "inactive"];

const validId = (value) =>
  /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

const clean = (value) => String(value ?? "").trim();

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function prepareAttributes(value) {
  if (!isPlainObject(value)) {
    throw new Error("Attributes must be a JSON object");
  }

  const entries = Object.entries(value);

  if (entries.length < 1 || entries.length > 10) {
    throw new Error("Provide between 1 and 10 variant attributes");
  }

  const normalized = {};
  const usedNames = new Set();

  for (const [rawName, rawValue] of entries) {
    const name = clean(rawName);
    const attributeValue = clean(rawValue);

    if (
      name.length < 1 ||
      name.length > 50 ||
      attributeValue.length < 1 ||
      attributeValue.length > 100
    ) {
      throw new Error(
        "Attribute names and values must be non-empty and within allowed lengths",
      );
    }

    const normalizedName = name.toLowerCase();

    if (usedNames.has(normalizedName)) {
      throw new Error("Duplicate attribute name");
    }

    usedNames.add(normalizedName);

    normalized[normalizedName] = attributeValue.toLowerCase();
  }

  const sortedEntries = Object.entries(normalized).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const canonical = JSON.stringify(sortedEntries);

  const variantKey = crypto
    .createHash("sha256")
    .update(canonical)
    .digest("hex");

  return {
    attributes: Object.fromEntries(sortedEntries),
    variant_key: variantKey,
  };
}

function validateVariant(body) {
  if (!isPlainObject(body)) {
    return { error: "Invalid variant data" };
  }

  const sku = clean(body.sku).toUpperCase();

  const unitPrice = Number(body.unit_price);
  const quantity = Number(body.quantity);

  const status = clean(body.status || "active").toLowerCase();

  if (!SKU_REGEX.test(sku)) {
    return {
      error: "SKU must contain 2-50 letters, numbers, _ or -",
    };
  }

  if (
    body.unit_price === "" ||
    body.unit_price === null ||
    body.unit_price === undefined ||
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0 ||
    unitPrice > 99999999.99 ||
    Math.round(unitPrice * 100) !== unitPrice * 100
  ) {
    return {
      error: "Enter a valid positive price with maximum 2 decimals",
    };
  }

  if (
    body.quantity === "" ||
    body.quantity === null ||
    body.quantity === undefined ||
    !Number.isSafeInteger(quantity) ||
    quantity < 0
  ) {
    return {
      error: "Quantity must be a non-negative whole number",
    };
  }

  if (!ALLOWED_STATUS.includes(status)) {
    return { error: "Invalid variant status" };
  }

  try {
    const prepared = prepareAttributes(body.attributes);

    return {
      data: {
        sku,
        unit_price: unitPrice,
        quantity,
        status,
        ...prepared,
      },
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function getParent(connection, productId, companyId, lock = false) {
  const [rows] = await connection.query(
    `
      SELECT id, company_id, product_name, status
      FROM tbl_products
      WHERE id = ? AND company_id = ?
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}
    `,
    [productId, companyId],
  );

  return rows[0] || null;
}

async function skuAlreadyExists(
  connection,
  companyId,
  sku,
  excludeVariantId = null,
) {
  const [products] = await connection.query(
    `
      SELECT id
      FROM tbl_products
      WHERE company_id = ?
        AND sku = ?
      LIMIT 1
    `,
    [companyId, sku],
  );

  if (products.length) return true;

  let sql = `
    SELECT id
    FROM tbl_product_variants
    WHERE company_id = ?
      AND sku = ?
  `;

  const params = [companyId, sku];

  if (excludeVariantId) {
    sql += " AND id <> ?";
    params.push(excludeVariantId);
  }

  sql += " LIMIT 1";

  const [variants] = await connection.query(sql, params);

  return variants.length > 0;
}

async function combinationAlreadyExists(
  connection,
  productId,
  variantKey,
  excludeVariantId = null,
) {
  let sql = `
    SELECT id
    FROM tbl_product_variants
    WHERE product_id = ?
      AND variant_key = ?
  `;

  const params = [productId, variantKey];

  if (excludeVariantId) {
    sql += " AND id <> ?";
    params.push(excludeVariantId);
  }

  sql += " LIMIT 1";

  const [rows] = await connection.query(sql, params);

  return rows.length > 0;
}

const formatVariant = (row) => ({
  ...row,
  attributes:
    typeof row.attributes === "string"
      ? JSON.parse(row.attributes)
      : row.attributes,
});

/* =========================================
   GET PRODUCT VARIANTS
========================================= */

export const getProductVariants = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const productId = req.params.id;

    if (!validId(companyId) || !validId(productId)) {
      return sendError(res, 400, "Invalid company or product ID");
    }

    const parent = await getParent(db, productId, companyId);

    if (!parent) {
      return sendError(res, 404, "Product not found");
    }

    const [rows] = await db.query(
      `
        SELECT
          id, company_id, product_id,
          sku, attributes, unit_price,
          quantity, status, created_at, updated_at
        FROM tbl_product_variants
        WHERE company_id = ?
          AND product_id = ?
        ORDER BY id DESC
      `,
      [companyId, productId],
    );

    return res.json({
      success: true,
      product_id: Number(productId),
      variants: rows.map(formatVariant),
      total: rows.length,
    });
  } catch (error) {
    console.error("GET VARIANTS ERROR:", error);

    return sendError(res, 500, "Failed to fetch product variants");
  }
};

/* =========================================
   CREATE PRODUCT VARIANT
========================================= */

export const createProductVariant = async (req, res) => {
  const companyId = req.user?.company_id;
  const productId = req.params.id;

  if (!validId(companyId) || !validId(productId)) {
    return sendError(res, 400, "Invalid company or product ID");
  }

  const validation = validateVariant(req.body);

  if (validation.error) {
    return sendError(res, 400, validation.error);
  }

  const data = validation.data;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const parent = await getParent(connection, productId, companyId, true);

    if (!parent) {
      await connection.rollback();
      return sendError(res, 404, "Product not found");
    }

    if (parent.status !== "active") {
      await connection.rollback();
      return sendError(res, 400, "Cannot add variants to an inactive product");
    }

    if (await skuAlreadyExists(connection, companyId, data.sku)) {
      await connection.rollback();
      return sendError(res, 409, "SKU already exists");
    }

    if (
      await combinationAlreadyExists(connection, productId, data.variant_key)
    ) {
      await connection.rollback();
      return sendError(res, 409, "This variant combination already exists");
    }

    const [result] = await connection.query(
      `
        INSERT INTO tbl_product_variants
        (
          company_id,
          product_id,
          sku,
          attributes,
          variant_key,
          unit_price,
          quantity,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        productId,
        data.sku,
        JSON.stringify(data.attributes),
        data.variant_key,
        data.unit_price,
        data.quantity,
        data.status,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      variant_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      return sendError(res, 409, "Duplicate SKU or variant combination");
    }

    console.error("CREATE VARIANT ERROR:", error);
    return sendError(res, 500, "Failed to create product variant");
  } finally {
    connection.release();
  }
};

/* =========================================
   UPDATE PRODUCT VARIANT
========================================= */

export const updateProductVariant = async (req, res) => {
  const companyId = req.user?.company_id;
  const productId = req.params.id;
  const variantId = req.params.variantId;

  if (!validId(companyId) || !validId(productId) || !validId(variantId)) {
    return sendError(res, 400, "Invalid ID");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const parent = await getParent(connection, productId, companyId, true);

    if (!parent) {
      await connection.rollback();
      return sendError(res, 404, "Product not found");
    }

    const [rows] = await connection.query(
      `
        SELECT *
        FROM tbl_product_variants
        WHERE id = ?
          AND product_id = ?
          AND company_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [variantId, productId, companyId],
    );

    if (!rows.length) {
      await connection.rollback();
      return sendError(res, 404, "Variant not found");
    }

    const existing = rows[0];

    const mergedData = {
      ...existing,
      attributes: formatVariant(existing).attributes,
      ...req.body,
    };

    const validation = validateVariant(mergedData);

    if (validation.error) {
      await connection.rollback();
      return sendError(res, 400, validation.error);
    }

    const data = validation.data;

    if (await skuAlreadyExists(connection, companyId, data.sku, variantId)) {
      await connection.rollback();
      return sendError(res, 409, "SKU already exists");
    }

    if (
      await combinationAlreadyExists(
        connection,
        productId,
        data.variant_key,
        variantId,
      )
    ) {
      await connection.rollback();
      return sendError(res, 409, "This variant combination already exists");
    }

    await connection.query(
      `
        UPDATE tbl_product_variants
        SET
          sku = ?,
          attributes = ?,
          variant_key = ?,
          unit_price = ?,
          quantity = ?,
          status = ?
        WHERE id = ?
          AND product_id = ?
          AND company_id = ?
      `,
      [
        data.sku,
        JSON.stringify(data.attributes),
        data.variant_key,
        data.unit_price,
        data.quantity,
        data.status,
        variantId,
        productId,
        companyId,
      ],
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Product variant updated successfully",
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      return sendError(res, 409, "Duplicate SKU or variant combination");
    }

    console.error("UPDATE VARIANT ERROR:", error);
    return sendError(res, 500, "Failed to update product variant");
  } finally {
    connection.release();
  }
};

/* =========================================
   DEACTIVATE PRODUCT VARIANT
========================================= */

export const deleteProductVariant = async (req, res) => {
  const companyId = req.user?.company_id;
  const productId = req.params.id;
  const variantId = req.params.variantId;

  if (!validId(companyId) || !validId(productId) || !validId(variantId)) {
    return sendError(res, 400, "Invalid ID");
  }

  try {
    const [result] = await db.query(
      `
        UPDATE tbl_product_variants v
        INNER JOIN tbl_products p
          ON p.id = v.product_id
          AND p.company_id = v.company_id
        SET v.status = 'inactive'
        WHERE v.id = ?
          AND v.product_id = ?
          AND v.company_id = ?
          AND v.status = 'active'
      `,
      [variantId, productId, companyId],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "Active variant not found");
    }

    return res.json({
      success: true,
      message: "Product variant deactivated successfully",
    });
  } catch (error) {
    console.error("DELETE VARIANT ERROR:", error);

    return sendError(res, 500, "Failed to deactivate variant");
  }
};
