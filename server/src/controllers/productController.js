import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";

const ALLOWED_PRODUCT_STATUS = ["active", "inactive"];
const ALLOWED_UNIT_TYPES = [
  "pcs",
  "kg",
  "g",
  "ltr",
  "ml",
  "box",
  "pack",
  "meter",
  "hour",
  "day",
  "service",
];

const PRODUCT_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),/_-]+$/;
const SKU_REGEX = /^[a-zA-Z0-9_-]{2,50}$/;
const HSN_SAC_REGEX = /^[0-9]{4,8}$/;

const getUserAgent = (req) => req.headers["user-agent"] || null;

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/<[^>]*>?/gm, "")
    .trim();
};

const normalizeNullable = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const isOnlyNumbers = (value) => /^[0-9]+$/.test(String(value || "").trim());

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
};

const validateBranch = async (branchId, companyId) => {
  if (!branchId || !isPositiveInteger(branchId)) return null;

  const [branchRows] = await db.query(
    `
    SELECT id
    FROM tbl_company_branches
    WHERE id = ? AND company_id = ? AND status = 'active'
    LIMIT 1
    `,
    [branchId, companyId],
  );

  return branchRows.length > 0 ? branchRows[0] : null;
};

const getMainBranchId = async (companyId) => {
  const [rows] = await db.query(
    `
    SELECT id
    FROM tbl_company_branches
    WHERE company_id = ?
    AND is_main = 1
    AND status = 'active'
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0]?.id || null;
};

const getFinalBranchId = (branch_id) => {
  const id = Number(branch_id);

  return Number.isInteger(id) && id > 0 ? id : null;
};

const getBranchCondition = () => {
  return { clause: "", params: [] };
};

const validateProductPayload = ({
  product_name,
  sku,
  hsn_sac_code,
  description,
  unit_price,
  tax_rate,
  quantity,
  unit_type,
  category,
  status,
}) => {
  const productName = normalizeText(product_name);
  const finalSku = normalizeUpper(sku);
  const finalHsnSac = normalizeText(hsn_sac_code);
  const finalDescription = normalizeText(description);
  const finalUnitPrice = toNumber(unit_price);
  const finalTaxRate = toNumber(tax_rate);
  const finalQuantity = toNumber(quantity);
  const finalUnitType = normalizeText(unit_type).toLowerCase() || "pcs";
  const finalCategory = normalizeText(category);
  const finalStatus = normalizeText(status).toLowerCase() || "active";

  if (!productName) return "Product name is required";

  if (productName.length < 2 || productName.length > 120) {
    return "Product name must be between 2 and 120 characters";
  }

  if (isOnlyNumbers(productName)) {
    return "Product name cannot contain only numbers";
  }

  if (!PRODUCT_NAME_REGEX.test(productName)) {
    return "Product name contains invalid characters";
  }

  if (finalSku && !SKU_REGEX.test(finalSku)) {
    return "SKU must be 2-50 characters and can contain letters, numbers, underscore or hyphen";
  }

  if (finalHsnSac && !HSN_SAC_REGEX.test(finalHsnSac)) {
    return "HSN/SAC code must be 4 to 8 digits";
  }

  if (Number.isNaN(finalUnitPrice)) {
    return "Unit price must be a valid number";
  }

  if (finalUnitPrice <= 0) {
    return "Unit price must be greater than 0";
  }

  if (Number.isNaN(finalTaxRate)) {
    return "Tax rate must be a valid number";
  }

  if (finalTaxRate < 0 || finalTaxRate > 100) {
    return "Tax rate must be between 0 and 100";
  }

  if (Number.isNaN(finalQuantity)) {
    return "Quantity must be a valid number";
  }

  if (finalQuantity < 0) {
    return "Quantity cannot be negative";
  }

  if (!Number.isInteger(finalQuantity)) {
    return "Quantity must be a whole number";
  }

  if (!ALLOWED_UNIT_TYPES.includes(finalUnitType)) {
    return `Unit type must be one of: ${ALLOWED_UNIT_TYPES.join(", ")}`;
  }

  if (finalCategory && finalCategory.length > 80) {
    return "Category must be less than 80 characters";
  }

  if (finalDescription && finalDescription.length > 500) {
    return "Description must be less than 500 characters";
  }

  if (!ALLOWED_PRODUCT_STATUS.includes(finalStatus)) {
    return "Status must be active or inactive";
  }

  return null;
};

const normalizeProductPayload = (body) => {
  return {
    branch_id: body.branch_id,
    product_name: normalizeText(body.product_name),
    sku: normalizeUpper(body.sku) || null,
    hsn_sac_code: normalizeText(body.hsn_sac_code) || null,
    description: normalizeNullable(body.description),
    unit_price: toNumber(body.unit_price),
    tax_id: body.tax_id ? Number(body.tax_id) : null,
    tax_rate: toNumber(body.tax_rate),
    quantity: toNumber(body.quantity),
    unit_type: normalizeText(body.unit_type).toLowerCase() || "pcs",
    category: normalizeNullable(body.category),
    status: normalizeText(body.status).toLowerCase() || "active",
  };
};

const getTaxDetails = async ({ taxId, companyId }) => {
  if (!taxId) return null;

  if (!isPositiveInteger(taxId)) {
    return false;
  }

  const [taxRows] = await db.query(
    `
    SELECT *
    FROM tbl_taxes
    WHERE id = ?
    AND company_id = ?
    AND is_active = 1
    LIMIT 1
    `,
    [taxId, companyId],
  );

  return taxRows[0] || false;
};

const getProductById = async (productId, companyId) => {
  const [rows] = await db.query(
    `
    SELECT
      p.*,
      b.branch_name,
      b.branch_code,
      t.tax_name,
      t.tax_type,
      t.cgst_percentage,
      t.sgst_percentage,
      t.igst_percentage,
      t.tds_percentage,
      t.tcs_percentage,
      t.reverse_charge
    FROM tbl_products p
    LEFT JOIN tbl_company_branches b
      ON p.branch_id = b.id
      AND b.company_id = p.company_id
    LEFT JOIN tbl_taxes t
      ON p.tax_id = t.id
      AND t.company_id = p.company_id
    WHERE p.id = ?
    AND p.company_id = ?
    LIMIT 1
    `,
    [productId, companyId],
  );

  return rows[0] || null;
};

const checkDuplicateSku = async ({
  companyId,
  sku,
  excludeProductId = null,
}) => {
  if (!sku) return false;

  // Check existing parent product SKUs.
  let productQuery = `
    SELECT id
    FROM tbl_products
    WHERE company_id = ? AND sku = ?
  `;

  const productParams = [companyId, sku];

  if (excludeProductId) {
    productQuery += " AND id != ?";
    productParams.push(excludeProductId);
  }

  productQuery += " LIMIT 1";

  const [products] = await db.query(productQuery, productParams);

  if (products.length > 0) return true;

  // Also check variant SKUs.
  const [variants] = await db.query(
    `
      SELECT id
      FROM tbl_product_variants
      WHERE company_id = ?
        AND sku = ?
      LIMIT 1
    `,
    [companyId, sku],
  );

  return variants.length > 0;
};

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const payload = normalizeProductPayload(req.body);

    let finalBranchId = getFinalBranchId(payload.branch_id);

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(company_id);
    }

    if (!finalBranchId) {
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const branch = await validateBranch(finalBranchId, company_id);

    if (!branch) {
      return res.status(400).json({ message: "Invalid branch selected" });
    }

    let finalTaxRate = payload.tax_rate;
    let finalHsnSac = payload.hsn_sac_code;

    if (payload.tax_id) {
      const tax = await getTaxDetails({
        taxId: payload.tax_id,
        companyId: company_id,
      });

      if (!tax) {
        return res.status(400).json({ message: "Invalid tax selected" });
      }

      finalTaxRate = toNumber(tax.tax_percentage);
      finalHsnSac = finalHsnSac || tax.hsn_sac_code || null;
    }

    const validationError = validateProductPayload({
      ...payload,
      hsn_sac_code: finalHsnSac,
      tax_rate: finalTaxRate,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const duplicateSku = await checkDuplicateSku({
      companyId: company_id,
      sku: payload.sku,
    });

    if (duplicateSku) {
      return res.status(409).json({
        message: "SKU already exists for this company",
      });
    }

    const [productResult] = await db.query(
      `
      INSERT INTO tbl_products
      (
        company_id,
        branch_id,
        product_name,
        sku,
        hsn_sac_code,
        description,
        unit_price,
        tax_id,
        tax_rate,
        quantity,
        unit_type,
        category,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        finalBranchId,
        payload.product_name,
        payload.sku,
        finalHsnSac,
        payload.description,
        payload.unit_price,
        payload.tax_id,
        finalTaxRate,
        payload.quantity,
        payload.unit_type,
        payload.category,
        payload.status,
      ],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Product",
      record_id: productResult.insertId,
      description: `Product ${payload.product_name} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    const product = await getProductById(productResult.insertId, company_id);

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create product error",
      error: error.message,
    });
  }
};

// GET PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 1000, 1000);
    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (status !== "all" && !ALLOWED_PRODUCT_STATUS.includes(status)) {
      return res.status(400).json({
        message: "Status must be all, active or inactive",
      });
    }

    const branchCondition = getBranchCondition(req, "p");

    let whereClause = `
      WHERE p.company_id = ?
      ${branchCondition.clause}
    `;

    const params = [company_id, ...branchCondition.params];

    if (search) {
      whereClause += `
        AND (
          p.product_name LIKE ?
          OR p.sku LIKE ?
          OR p.hsn_sac_code LIKE ?
          OR p.category LIKE ?
          OR p.unit_type LIKE ?
          OR b.branch_name LIKE ?
          OR b.branch_code LIKE ?
          OR t.tax_name LIKE ?
        )
      `;

      const keyword = `%${search}%`;
      params.push(
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
      );
    }

    if (status !== "all") {
      whereClause += " AND p.status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_products p
      LEFT JOIN tbl_company_branches b
        ON p.branch_id = b.id
        AND b.company_id = p.company_id
      LEFT JOIN tbl_taxes t
        ON p.tax_id = t.id
        AND t.company_id = p.company_id
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [products] = await db.query(
      `
      SELECT
        p.*,
        b.branch_name,
        b.branch_code,
        t.tax_name,
        t.tax_type,
        t.cgst_percentage,
        t.sgst_percentage,
        t.igst_percentage,
        t.tds_percentage,
        t.tcs_percentage,
        t.reverse_charge
      FROM tbl_products p
      LEFT JOIN tbl_company_branches b
        ON p.branch_id = b.id
        AND b.company_id = p.company_id
      LEFT JOIN tbl_taxes t
        ON p.tax_id = t.id
        AND t.company_id = p.company_id
      ${whereClause}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      products,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get products error",
      error: error.message,
    });
  }
};

// GET SINGLE PRODUCT
export const getSingleProduct = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid product id is required" });
    }

    const branchCondition = getBranchCondition(req, "p");

    const [products] = await db.query(
      `
      SELECT
        p.*,
        b.branch_name,
        b.branch_code,
        t.tax_name,
        t.tax_type,
        t.cgst_percentage,
        t.sgst_percentage,
        t.igst_percentage,
        t.tds_percentage,
        t.tcs_percentage,
        t.reverse_charge
      FROM tbl_products p
      LEFT JOIN tbl_company_branches b
        ON p.branch_id = b.id
        AND b.company_id = p.company_id
      LEFT JOIN tbl_taxes t
        ON p.tax_id = t.id
        AND t.company_id = p.company_id
      WHERE p.id = ?
      AND p.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (products.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = products[0];

    const [variants] = await db.query(
      `
    SELECT
      id,
      product_id,
      sku,
      attributes,
      unit_price,
      quantity,
      status
    FROM tbl_product_variants
    WHERE product_id = ?
      AND company_id = ?
    ORDER BY id DESC
  `,
      [id, company_id],
    );

    const formattedVariants = variants.map((variant) => ({
      ...variant,
      attributes:
        typeof variant.attributes === "string"
          ? JSON.parse(variant.attributes)
          : variant.attributes,
    }));

    const activeVariants = formattedVariants.filter(
      (variant) => variant.status === "active",
    );

    return res.json({
      ...product,
      has_variants: formattedVariants.length > 0,
      variant_count: formattedVariants.length,
      variant_stock: activeVariants.reduce(
        (total, variant) => total + Number(variant.quantity || 0),
        0,
      ),
      variants: formattedVariants,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get product error",
      error: error.message,
    });
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid product id is required" });
    }

    const payload = normalizeProductPayload(req.body);

    let finalBranchId = getFinalBranchId(payload.branch_id);

    if (!finalBranchId) {
      finalBranchId = await getMainBranchId(company_id);
    }

    if (!finalBranchId) {
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const branchCondition = getBranchCondition(req, "p");

    const [existingRows] = await db.query(
      `
      SELECT p.id
      FROM tbl_products p
      WHERE p.id = ?
      AND p.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        message: "Product not found or not allowed",
      });
    }

    const branch = await validateBranch(finalBranchId, company_id);

    if (!branch) {
      return res.status(400).json({ message: "Invalid branch selected" });
    }

    let finalTaxRate = payload.tax_rate;
    let finalHsnSac = payload.hsn_sac_code;

    if (payload.tax_id) {
      const tax = await getTaxDetails({
        taxId: payload.tax_id,
        companyId: company_id,
      });

      if (!tax) {
        return res.status(400).json({ message: "Invalid tax selected" });
      }

      finalTaxRate = toNumber(tax.tax_percentage);
    }

    const validationError = validateProductPayload({
      ...payload,
      hsn_sac_code: finalHsnSac,
      tax_rate: finalTaxRate,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const duplicateSku = await checkDuplicateSku({
      companyId: company_id,
      sku: payload.sku,
      excludeProductId: id,
    });

    if (duplicateSku) {
      return res.status(409).json({
        message: "SKU already exists for this company",
      });
    }

    const [variantCountRows] = await db.query(
      `
    SELECT COUNT(*) AS total
    FROM tbl_product_variants
    WHERE company_id = ?
      AND product_id = ?
  `,
      [company_id, id],
    );

    if (Number(variantCountRows[0]?.total || 0) > 0) {
      const [currentRows] = await db.query(
        `
      SELECT quantity
      FROM tbl_products
      WHERE id = ? AND company_id = ?
      LIMIT 1
    `,
        [id, company_id],
      );

      if (Number(payload.quantity) !== Number(currentRows[0]?.quantity)) {
        return res.status(400).json({
          message:
            "This product has variants. Manage stock individually for each variant.",
        });
      }
    }

    const [result] = await db.query(
      `
      UPDATE tbl_products
      SET
        branch_id = ?,
        product_name = ?,
        sku = ?,
        hsn_sac_code = ?,
        description = ?,
        unit_price = ?,
        tax_id = ?,
        tax_rate = ?,
        quantity = ?,
        unit_type = ?,
        category = ?,
        status = ?
      WHERE id = ? AND company_id = ?
      `,
      [
        finalBranchId,
        payload.product_name,
        payload.sku,
        finalHsnSac,
        payload.description,
        payload.unit_price,
        payload.tax_id,
        finalTaxRate,
        payload.quantity,
        payload.unit_type,
        payload.category,
        payload.status,
        id,
        company_id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Product not found or not allowed",
      });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Product",
      record_id: id,
      description: `Product ${payload.product_name} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    const product = await getProductById(id, company_id);

    return res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update product error",
      error: error.message,
    });
  }
};

// DELETE PRODUCT / DEACTIVATE
export const deleteProduct = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid product id is required" });
    }

    const branchCondition = getBranchCondition(req, "p");

    const [productRows] = await db.query(
      `
      SELECT p.product_name, p.status
      FROM tbl_products p
      WHERE p.id = ?
      AND p.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (productRows.length === 0) {
      return res.status(404).json({
        message: "Product not found or not allowed",
      });
    }

    if (productRows[0].status === "inactive") {
      return res.status(400).json({
        message: "Product already inactive",
      });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_products
      SET status = 'inactive'
      WHERE id = ? AND company_id = ?
      `,
      [id, company_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Product not found or not allowed",
      });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "DELETE",
      module_name: "Product",
      record_id: id,
      description: `Product ${productRows[0].product_name} deactivated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Product deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete product error",
      error: error.message,
    });
  }
};

// UPLOAD PRODUCT IMAGE
export const uploadProductImage = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid product id is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: "Only JPG, PNG or WEBP product images are allowed",
      });
    }

    const maxSize = 2 * 1024 * 1024;

    if (req.file.size > maxSize) {
      return res.status(400).json({
        message: "Product image size must be less than 2MB",
      });
    }

    const branchCondition = getBranchCondition(req, "p");

    const imageName = req.file.filename;

    const [productRows] = await db.query(
      `
      SELECT p.id, p.product_name
      FROM tbl_products p
      WHERE p.id = ?
      AND p.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (productRows.length === 0) {
      return res.status(404).json({
        message: "Product not found or not allowed",
      });
    }

    await db.query(
      `
      UPDATE tbl_products
      SET image = ?
      WHERE id = ? AND company_id = ?
      `,
      [imageName, id, company_id],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Product",
      record_id: id,
      description: `Product image updated for ${productRows[0].product_name}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Product image uploaded successfully",
      image: imageName,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Product image upload failed",
      error: error.message,
    });
  }
};
