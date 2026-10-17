import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";

const ALLOWED_CUSTOMER_STATUS = ["active", "inactive"];
const ALLOWED_CUSTOMER_TYPES = ["business", "individual"];
const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;

const getUserAgent = (req) => req.headers["user-agent"] || null;

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).replace(/<[^>]*>?/gm, "").trim();
};

const normalizeNullable = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const normalizeEmail = (email) => normalizeText(email).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
};

const validateCustomerPayload = ({
  customer_name,
  company_name,
  email,
  phone,
  gstin,
  customer_type,
  payment_terms,
  currency,
  opening_balance,
  customer_group,
  credit_limit,
  status,
}) => {
  const customerName = normalizeText(customer_name);
  const companyName = normalizeText(company_name);
  const customerEmail = normalizeEmail(email);
  const finalPhone = normalizeText(phone);
  const finalGstin = normalizeUpper(gstin);
  const finalCustomerType = normalizeText(customer_type).toLowerCase() || "business";
  const finalPaymentTerms = normalizeText(payment_terms) || "Due on Receipt";
  const finalCurrency = normalizeUpper(currency) || "INR";
  const finalOpeningBalance = toNumber(opening_balance);
  const finalCreditLimit = toNumber(credit_limit);
  const finalCustomerGroup = normalizeText(customer_group);
  const finalStatus = normalizeText(status).toLowerCase() || "active";

  if (!customerName) return "Customer name is required";

  if (customerName.length < 2 || customerName.length > 100) {
    return "Customer name must be between 2 and 100 characters";
  }

  if (!NAME_REGEX.test(customerName)) {
    return "Customer name contains invalid characters";
  }

  if (companyName && companyName.length > 100) {
    return "Company name must be less than 100 characters";
  }

  if (companyName && !NAME_REGEX.test(companyName)) {
    return "Company name contains invalid characters";
  }

  if (!customerEmail) return "Customer email is required";

  if (!EMAIL_REGEX.test(customerEmail)) {
    return "Please enter a valid customer email";
  }

  if (finalPhone && !PHONE_REGEX.test(finalPhone)) {
    return "Phone must be a valid 10 digit Indian mobile number";
  }

  if (finalGstin && !GST_REGEX.test(finalGstin)) {
    return "Invalid GST number format";
  }

  if (!ALLOWED_CUSTOMER_TYPES.includes(finalCustomerType)) {
    return "Customer type must be business or individual";
  }

  if (!ALLOWED_CURRENCIES.includes(finalCurrency)) {
    return `Currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`;
  }

  if (Number.isNaN(finalOpeningBalance)) {
    return "Opening balance must be a valid number";
  }

  if (finalOpeningBalance < 0) {
    return "Opening balance cannot be negative";
  }

  if (Number.isNaN(finalCreditLimit)) {
    return "Credit limit must be a valid number";
  }

  if (finalCreditLimit < 0) {
    return "Credit limit cannot be negative";
  }

  if (finalPaymentTerms.length > 100) {
    return "Payment terms must be less than 100 characters";
  }

  if (finalCustomerGroup.length > 100) {
    return "Customer group must be less than 100 characters";
  }

  if (!ALLOWED_CUSTOMER_STATUS.includes(finalStatus)) {
    return "Status must be active or inactive";
  }

  return null;
};

const validateBranch = async (branchId, companyId) => {
  if (!branchId) return null;

  if (!isPositiveInteger(branchId)) {
    return null;
  }

  const [branchRows] = await db.query(
    `
    SELECT id, branch_name
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
  return branch_id ? Number(branch_id) : null;
};

const getBranchCondition = () => {
  return { clause: "", params: [] };
};

const getCustomerById = async (customerId, companyId) => {
  const [rows] = await db.query(
    `
    SELECT
      c.*,
      b.branch_name,
      b.branch_code
    FROM tbl_customers c
    LEFT JOIN tbl_company_branches b
      ON c.branch_id = b.id
      AND b.company_id = c.company_id
    WHERE c.id = ? AND c.company_id = ?
    LIMIT 1
    `,
    [customerId, companyId],
  );

  return rows[0] || null;
};

const normalizeCustomerPayload = (body) => {
  const finalOpeningBalance = toNumber(body.opening_balance);
  const finalCreditLimit = toNumber(body.credit_limit);

  return {
    branch_id: body.branch_id,
    customer_name: normalizeText(body.customer_name),
    company_name: normalizeNullable(body.company_name),
    email: normalizeEmail(body.email),
    phone: normalizeNullable(body.phone),
    gstin: normalizeUpper(body.gstin) || null,
    customer_type: normalizeText(body.customer_type).toLowerCase() || "business",
    billing_address: normalizeNullable(body.billing_address),
    shipping_address: normalizeNullable(body.shipping_address),
    payment_terms: normalizeText(body.payment_terms) || "Due on Receipt",
    currency: normalizeUpper(body.currency) || "INR",
    opening_balance: Number.isNaN(finalOpeningBalance) ? NaN : finalOpeningBalance,
    customer_group: normalizeNullable(body.customer_group),
    credit_limit: Number.isNaN(finalCreditLimit) ? NaN : finalCreditLimit,
    notes: normalizeNullable(body.notes),
    status: normalizeText(body.status).toLowerCase() || "active",
  };
};

const checkDuplicateCustomer = async ({
  connection,
  companyId,
  email,
  gstin,
  excludeCustomerId = null,
}) => {
  const params = [companyId];

  let query = `
    SELECT id, email, gstin
    FROM tbl_customers
    WHERE company_id = ?
    AND (
      email = ?
  `;

  params.push(email);

  if (gstin) {
    query += " OR gstin = ?";
    params.push(gstin);
  }

  query += ")";

  if (excludeCustomerId) {
    query += " AND id != ?";
    params.push(excludeCustomerId);
  }

  query += " LIMIT 1";

  const [rows] = await connection.query(query, params);

  if (rows.length === 0) return null;

  const duplicate = rows[0];

  if (duplicate.email === email) {
    return "Customer email already exists in this company";
  }

  if (gstin && duplicate.gstin === gstin) {
    return "GST number already exists in this company";
  }

  return "Customer already exists in this company";
};

const checkDuplicateUserEmail = async ({
  connection,
  email,
  customerId = null,
  companyId = null,
}) => {
  let query = `
    SELECT id
    FROM tbl_users
    WHERE email = ?
  `;

  const params = [email];

  if (customerId && companyId) {
    query += `
      AND NOT (
        role = 'customer'
        AND customer_id = ?
        AND company_id = ?
      )
    `;
    params.push(customerId, companyId);
  }

  query += " LIMIT 1";

  const [rows] = await connection.query(query, params);

  return rows.length > 0;
};

export const createCustomer = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    const payload = normalizeCustomerPayload(req.body);

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

    const validationError = validateCustomerPayload({
      ...payload,
      branch_id: finalBranchId,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.beginTransaction();

    const duplicateCustomerError = await checkDuplicateCustomer({
      connection,
      companyId: company_id,
      email: payload.email,
      gstin: payload.gstin,
    });

    if (duplicateCustomerError) {
      await connection.rollback();
      return res.status(409).json({ message: duplicateCustomerError });
    }

    const [customerResult] = await connection.query(
      `
      INSERT INTO tbl_customers
      (
        company_id,
        branch_id,
        customer_name,
        company_name,
        email,
        phone,
        gstin,
        customer_type,
        billing_address,
        shipping_address,
        payment_terms,
        currency,
        opening_balance,
        customer_group,
        credit_limit,
        notes,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        finalBranchId,
        payload.customer_name,
        payload.company_name,
        payload.email,
        payload.phone,
        payload.gstin,
        payload.customer_type,
        payload.billing_address,
        payload.shipping_address,
        payload.payment_terms,
        payload.currency,
        payload.opening_balance,
        payload.customer_group,
        payload.credit_limit,
        payload.notes,
        payload.status,
      ],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Customer",
      record_id: customerResult.insertId,
      description: `Customer ${payload.customer_name} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await connection.commit();

    const customer = await getCustomerById(customerResult.insertId, company_id);

    return res.status(201).json({
      message: "Customer Created Successfully",
      customer,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Create customer error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const getCustomers = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 1000, 1000);
    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (status !== "all" && !ALLOWED_CUSTOMER_STATUS.includes(status)) {
      return res.status(400).json({
        message: "Status must be all, active or inactive",
      });
    }

    const branchCondition = getBranchCondition(req, "c");

    let whereClause = `
      WHERE c.company_id = ?
      ${branchCondition.clause}
    `;

    const params = [company_id, ...branchCondition.params];

    if (search) {
      whereClause += `
        AND (
          c.customer_name LIKE ?
          OR c.company_name LIKE ?
          OR c.email LIKE ?
          OR c.phone LIKE ?
          OR c.gstin LIKE ?
          OR c.customer_type LIKE ?
          OR c.customer_group LIKE ?
          OR b.branch_name LIKE ?
          OR b.branch_code LIKE ?
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
        keyword,
      );
    }

    if (status !== "all") {
      whereClause += " AND c.status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_customers c
      LEFT JOIN tbl_company_branches b
        ON c.branch_id = b.id
        AND b.company_id = c.company_id
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [customers] = await db.query(
      `
      SELECT
        c.*,
        b.branch_name,
        b.branch_code
      FROM tbl_customers c
      LEFT JOIN tbl_company_branches b
        ON c.branch_id = b.id
        AND b.company_id = c.company_id
      ${whereClause}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      customers,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get customers error",
      error: error.message,
    });
  }
};

export const getSingleCustomer = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid customer id is required",
      });
    }

    const branchCondition = getBranchCondition(req, "c");

    const [customers] = await db.query(
      `
      SELECT
        c.*,
        b.branch_name,
        b.branch_code
      FROM tbl_customers c
      LEFT JOIN tbl_company_branches b
        ON c.branch_id = b.id
        AND b.company_id = c.company_id
      WHERE c.id = ?
      AND c.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.json(customers[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Get customer error",
      error: error.message,
    });
  }
};

export const updateCustomer = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid customer id is required",
      });
    }

    const payload = normalizeCustomerPayload(req.body);

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

    const validationError = validateCustomerPayload({
      ...payload,
      branch_id: finalBranchId,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const branchCondition = getBranchCondition(req, "c");

    const [existingCustomerRows] = await connection.query(
      `
      SELECT c.id
      FROM tbl_customers c
      WHERE c.id = ?
      AND c.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (existingCustomerRows.length === 0) {
      return res.status(404).json({
        message: "Customer not found or not allowed",
      });
    }

    await connection.beginTransaction();

    const duplicateCustomerError = await checkDuplicateCustomer({
      connection,
      companyId: company_id,
      email: payload.email,
      gstin: payload.gstin,
      excludeCustomerId: id,
    });

    if (duplicateCustomerError) {
      await connection.rollback();
      return res.status(409).json({ message: duplicateCustomerError });
    }

    const [result] = await connection.query(
      `
      UPDATE tbl_customers
      SET
        branch_id = ?,
        customer_name = ?,
        company_name = ?,
        email = ?,
        phone = ?,
        gstin = ?,
        customer_type = ?,
        billing_address = ?,
        shipping_address = ?,
        payment_terms = ?,
        currency = ?,
        opening_balance = ?,
        customer_group = ?,
        credit_limit = ?,
        notes = ?,
        status = ?
      WHERE id = ? AND company_id = ?
      `,
      [
        finalBranchId,
        payload.customer_name,
        payload.company_name,
        payload.email,
        payload.phone,
        payload.gstin,
        payload.customer_type,
        payload.billing_address,
        payload.shipping_address,
        payload.payment_terms,
        payload.currency,
        payload.opening_balance,
        payload.customer_group,
        payload.credit_limit,
        payload.notes,
        payload.status,
        id,
        company_id,
      ],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Customer not found or not allowed",
      });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Customer",
      record_id: id,
      description: `Customer ${payload.customer_name} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await connection.commit();

    const customer = await getCustomerById(id, company_id);

    return res.json({
      message: "Customer Updated Successfully",
      customer,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Update customer error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing in logged-in user",
      });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "Valid customer id is required",
      });
    }

    const branchCondition = getBranchCondition(req, "c");

    const [customerRows] = await db.query(
      `
      SELECT c.customer_name, c.status
      FROM tbl_customers c
      WHERE c.id = ?
      AND c.company_id = ?
      ${branchCondition.clause}
      LIMIT 1
      `,
      [id, company_id, ...branchCondition.params],
    );

    if (customerRows.length === 0) {
      return res.status(404).json({
        message: "Customer not found or not allowed",
      });
    }

    if (customerRows[0].status === "inactive") {
      return res.status(400).json({
        message: "Customer already inactive",
      });
    }

    await db.query(
      `
      UPDATE tbl_customers
      SET status = 'inactive'
      WHERE id = ? AND company_id = ?
      `,
      [id, company_id],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "DELETE",
      module_name: "Customer",
      record_id: id,
      description: `Customer ${customerRows[0].customer_name} deactivated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Customer deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete customer error",
      error: error.message,
    });
  }
};