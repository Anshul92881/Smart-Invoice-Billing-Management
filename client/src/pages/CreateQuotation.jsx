import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Save,
  User,
  CalendarDays,
  IndianRupee,
  Percent,
  StickyNote,
  Building2,
  X,
  Package,
  Image,
  Hash,
  Mail,
  Phone,
  BadgePercent,
  MapPin,
  Globe,
  Tag,
  Landmark,
  Wallet,
  CreditCard,
  Boxes,
  Barcode,
  CheckCircle2,
  Search,
  ChevronDown,
  GitBranch,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HSN_SAC_REGEX = /^[0-9]{4,8}$/;
const ZIP_REGEX = /^\d{5,6}$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const PRODUCT_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),/_-]+$/;
const SKU_REGEX = /^[a-zA-Z0-9_-]{2,50}$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;

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

const cleanString = (value) =>
  String(value || "")
    .replace(/<[^>]*>?/gm, "")
    .trim();

const normalizeEmail = (value) => cleanString(value).toLowerCase();
const normalizeUpper = (value) => cleanString(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const getToday = () => new Date().toISOString().slice(0, 10);

const isValidDate = (value) => {
  if (!value) return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const isBeforeDate = (dateA, dateB) => {
  return (
    new Date(`${dateA}T00:00:00.000Z`) < new Date(`${dateB}T00:00:00.000Z`)
  );
};

const normalizeListResponse = (data, key) => {
  if (Array.isArray(data)) return data;
  return data?.[key] || [];
};

function CreateQuotation({ modalMode = false, onClose, onCreated }) {
  const navigate = useNavigate();

  const { id } = useParams();

  const isEditMode = Boolean(id) && !modalMode;

  const [loadingQuotation, setLoadingQuotation] = useState(Boolean(id));

  const [editingQuotationNumber, setEditingQuotationNumber] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));

  const [rolePermissions, setRolePermissions] = useState({});

  const BASE_ROLE_PERMISSIONS = {
    company_admin: "all",

    accountant: {
      products: true,
      quotations: true,
      invoices: true,
      payments: true,
      expenses: true,
      taxes: true,
      reports: true,
    },

    sales_user: {
      customers: true,
      quotations: true,
      invoices: true,
      products: true,
    },
  };

  const hasPermission = (key) => {
    if (user?.role === "company_admin") return true;

    const base = BASE_ROLE_PERMISSIONS[user?.role];

    if (base === "all" || base?.[key]) return true;

    return (
      Boolean(user?.permissions?.[key]) ||
      Boolean(rolePermissions?.[user?.role]?.[key])
    );
  };

  const canCreateQuotation = hasPermission("quotations");
  const canManageBranches = hasPermission("branches");
  const canManageCustomers = hasPermission("customers");

  const canManageProducts =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    hasPermission("products");

  const initialBranchForm = {
    branch_name: "",
    branch_code: "",
    email: "",
    phone: "",
    gst_number: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    zip_code: "",
    status: "active",
  };

  const initialCustomerForm = {
    branch_id: "",
    customer_name: "",
    company_name: "",
    email: "",
    phone: "",
    gstin: "",
    customer_type: "business",
    billing_address: "",
    shipping_address: "",
    payment_terms: "Due on Receipt",
    currency: "INR",
    opening_balance: "",
    customer_group: "",
    credit_limit: "",
    notes: "",
    status: "active",
  };

  const initialProductForm = {
    branch_id: "",
    product_name: "",
    sku: "",
    hsn_sac_code: "",
    description: "",
    unit_price: "",
    tax_rate: "",
    quantity: "",
    unit_type: "pcs",
    category: "",
    status: "active",
  };

  const blankItem = {
    product_id: "",
    product_name: "",
    description: "",
    hsn_sac_code: "",
    quantity: 1,
    price: 0,
    tax_rate: 0,
  };

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);

  const [saving, setSaving] = useState(false);
  const [productImageFile, setProductImageFile] = useState(null);
  const productImageInputRef = useRef(null);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productItemIndex, setProductItemIndex] = useState(null);

  const [branchErrors, setBranchErrors] = useState({});
  const [customerErrors, setCustomerErrors] = useState({});
  const [productErrors, setProductErrors] = useState({});

  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [productForm, setProductForm] = useState(initialProductForm);

  const [formData, setFormData] = useState({
    branch_id: "",
    customer_id: "",
    quotation_date: getToday(),
    expiry_date: "",
    discount_amount: 0,
    notes: "",
    terms_conditions: "",
  });

  const [items, setItems] = useState([{ ...blankItem }]);

  const getDefaultBranchId = useCallback(() => {
    const hqBranch = branches.find(
      (branch) => branch.is_main === 1 || branch.is_main === true,
    );

    return hqBranch?.id ? String(hqBranch.id) : "";
  }, [branches]);

  useEffect(() => {
    const defaultBranchId = getDefaultBranchId();

    if (!defaultBranchId || formData.branch_id) return;

    setFormData((prev) => ({
      ...prev,
      branch_id: defaultBranchId,
    }));

    setCustomerForm((prev) => ({
      ...prev,
      branch_id: defaultBranchId,
    }));

    setProductForm((prev) => ({
      ...prev,
      branch_id: defaultBranchId,
    }));
  }, [getDefaultBranchId, formData.branch_id]);

  const fetchDropdownData = async (dropdownUrl, fallbackUrl, key) => {
    try {
      const res = await api.get(dropdownUrl, {
        params: {
          status: "active",
          limit: 1000,
        },
      });

      return normalizeListResponse(res.data, key);
    } catch {
      const res = await api.get(fallbackUrl, {
        params: {
          status: "active",
          limit: 1000,
        },
      });

      return normalizeListResponse(res.data, key);
    }
  };

  const fetchData = async () => {
    try {
      const [customerRes, productRes, branchRes] = await Promise.all([
        fetchDropdownData("/customers/dropdown", "/customers", "customers"),
        fetchDropdownData("/products/dropdown", "/products", "products"),
        fetchDropdownData("/branches/dropdown", "/branches", "branches"),
      ]);

      setCustomers(
        customerRes.filter(
          (customer) => customer.status === "active" || customer.status === 1,
        ),
      );

      setProducts(
        productRes.filter(
          (product) => product.status === "active" || product.status === 1,
        ),
      );

      setBranches(
        branchRes.filter(
          (branch) => branch.status === "active" || branch.status === 1,
        ),
      );
    } catch {
      toast.error("Failed to fetch data");
    }
  };

  const uploadProductImage = async (productId) => {
    if (!productImageFile || !productId) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(productImageFile.type)) {
      toast.error("Only JPG, PNG or WEBP product images are allowed");
      return;
    }

    if (productImageFile.size > 2 * 1024 * 1024) {
      toast.error("Product image size must be less than 2MB");
      return;
    }

    const data = new FormData();
    data.append("image", productImageFile);

    await api.post(`/products/${productId}/image`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  };

  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        if (!user?.company_id || user?.role === "company_admin") return;

        const res = await api.get("/companies/role-permissions");
        setRolePermissions(res.data?.permissions || {});
      } catch {
        setRolePermissions({});
      }
    };

    fetchRolePermissions();
  }, [user?.company_id, user?.role]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setLoadingQuotation(false);
      return;
    }

    const fetchQuotationForEdit = async () => {
      try {
        setLoadingQuotation(true);

        const res = await api.get(`/quotations/${id}`);

        const quotation = res.data?.quotation;

        const quotationItems = Array.isArray(res.data?.items)
          ? res.data.items
          : [];

        if (!quotation) {
          toast.error("Quotation not found");

          navigate("/dashboard/quotations", { replace: true });

          return;
        }

        // Frontend edit rule
        if (!["draft", "sent"].includes(quotation.status)) {
          toast.error("Only draft or sent quotation can be edited");

          navigate(`/dashboard/quotations/${id}`, { replace: true });

          return;
        }

        setEditingQuotationNumber(quotation.quotation_number || "");

        setFormData({
          branch_id: quotation.branch_id ? String(quotation.branch_id) : "",

          customer_id: quotation.customer_id
            ? String(quotation.customer_id)
            : "",

          quotation_date: quotation.quotation_date
            ? String(quotation.quotation_date).slice(0, 10)
            : getToday(),

          expiry_date: quotation.expiry_date
            ? String(quotation.expiry_date).slice(0, 10)
            : "",

          discount_amount: Number(quotation.discount_amount || 0),

          notes: quotation.notes || "",

          terms_conditions: quotation.terms_conditions || "",
        });

        setItems(
          quotationItems.length > 0
            ? quotationItems.map((item) => ({
                product_id: item.product_id ? String(item.product_id) : "",

                product_name: item.item_name || item.product_name || "",

                description: item.description || item.product_description || "",

                hsn_sac_code:
                  item.hsn_sac_code || item.product_hsn_sac_code || "",

                quantity: Number(item.quantity || 1),

                price: Number(item.price || 0),

                tax_rate: Number(item.tax_rate || 0),
              }))
            : [{ ...blankItem }],
        );
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to load quotation",
        );

        navigate("/dashboard/quotations", { replace: true });
      } finally {
        setLoadingQuotation(false);
      }
    };

    fetchQuotationForEdit();
  }, [id, isEditMode, navigate]);

  const filteredCustomers = useMemo(() => customers, [customers]);

  const filteredProducts = useMemo(() => products, [products]);

  const clearBranchError = (name) => {
    if (!branchErrors[name]) return;

    setBranchErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const clearCustomerError = (name) => {
    if (!customerErrors[name]) return;

    setCustomerErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const clearProductError = (name) => {
    if (!productErrors[name]) return;

    setProductErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "branch_id" && value === "__add_branch__") {
      if (!canManageBranches) {
        toast.error("Branch permission required");
        return;
      }

      setBranchErrors({});
      setShowBranchModal(true);
      return;
    }

    if (name === "customer_id" && value === "__add_customer__") {
      if (!canManageCustomers) {
        toast.error("Customer permission required");
        return;
      }

      setCustomerForm({
        ...initialCustomerForm,
        branch_id: formData.branch_id || "",
      });
      setCustomerErrors({});
      setShowCustomerModal(true);
      return;
    }

    if (name === "branch_id") {
      setFormData((prev) => ({
        ...prev,
        branch_id: value,
      }));

      setCustomerForm((prev) => ({
        ...prev,
        branch_id: value,
      }));

      setProductForm((prev) => ({
        ...prev,
        branch_id: value,
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBranchFormChange = (e) => {
    const { name, value } = e.target;

    const nextValue =
      name === "branch_code" || name === "gst_number"
        ? normalizeUpper(value)
        : value;

    setBranchForm((prev) => ({ ...prev, [name]: nextValue }));
    clearBranchError(name);
  };

  const handleCustomerFormChange = (e) => {
    const { name, value } = e.target;

    const nextValue =
      name === "gstin" || name === "currency"
        ? normalizeUpper(value)
        : name === "email"
          ? normalizeEmail(value)
          : value;

    setCustomerForm((prev) => ({ ...prev, [name]: nextValue }));
    clearCustomerError(name);
  };

  const handleProductFormChange = (e) => {
    const { name, value } = e.target;

    const nextValue =
      name === "sku" || name === "hsn_sac_code" ? normalizeUpper(value) : value;

    setProductForm((prev) => ({ ...prev, [name]: nextValue }));
    clearProductError(name);
  };

  const validateBranchForm = () => {
    const nextErrors = {};

    const branchName = cleanString(branchForm.branch_name);
    const branchCode = normalizeUpper(branchForm.branch_code);
    const email = normalizeEmail(branchForm.email);
    const phone = cleanString(branchForm.phone);
    const gstNumber = normalizeUpper(branchForm.gst_number);
    const zipCode = cleanString(branchForm.zip_code);
    const country = cleanString(branchForm.country);
    const status = cleanString(branchForm.status).toLowerCase();

    if (!branchName) {
      nextErrors.branch_name = "Branch name is required";
    } else if (branchName.length < 2 || branchName.length > 100) {
      nextErrors.branch_name =
        "Branch name must be between 2 and 100 characters";
    } else if (!NAME_REGEX.test(branchName)) {
      nextErrors.branch_name = "Branch name contains invalid characters";
    }

    if (!branchCode) {
      nextErrors.branch_code = "Branch code is required";
    } else if (!BRANCH_CODE_REGEX.test(branchCode)) {
      nextErrors.branch_code =
        "Branch code must be 2-20 characters and can contain letters, numbers, underscore or hyphen";
    }

    if (email && !EMAIL_REGEX.test(email)) {
      nextErrors.email = "Invalid branch email format";
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone must be a valid 10 digit Indian mobile number";
    }

    if (gstNumber && !GST_REGEX.test(gstNumber)) {
      nextErrors.gst_number = "Invalid GST number format";
    }

    if (zipCode && !ZIP_REGEX.test(zipCode)) {
      nextErrors.zip_code = "ZIP code must be 5 to 6 digits";
    }

    if (country && country.length > 60) {
      nextErrors.country = "Country must be less than 60 characters";
    }

    if (!["active", "inactive"].includes(status)) {
      nextErrors.status = "Status must be active or inactive";
    }

    setBranchErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateBranch = async () => {
    if (!canManageBranches) {
      toast.error("Branch permission required");
      return;
    }

    if (!validateBranchForm()) return;

    try {
      const payload = {
        branch_name: cleanString(branchForm.branch_name),
        branch_code: normalizeUpper(branchForm.branch_code),
        email: normalizeEmail(branchForm.email),
        phone: cleanString(branchForm.phone),
        gst_number: normalizeUpper(branchForm.gst_number),
        address: cleanString(branchForm.address),
        city: cleanString(branchForm.city),
        state: cleanString(branchForm.state),
        country: cleanString(branchForm.country) || "India",
        zip_code: cleanString(branchForm.zip_code),
        status: cleanString(branchForm.status).toLowerCase() || "active",
      };

      const res = await api.post("/branches", payload);
      const newBranch = res.data?.branch || res.data;

      const branchData = await fetchDropdownData(
        "/branches/dropdown",
        "/branches",
        "branches",
      );

      const updatedBranches = branchData.filter(
        (branch) => branch.status === "active" || branch.status === 1,
      );

      setBranches(updatedBranches);

      const selectedBranch =
        newBranch?.id ||
        newBranch?.branch_id ||
        updatedBranches.find(
          (branch) =>
            branch.branch_name?.toLowerCase() ===
            payload.branch_name.toLowerCase(),
        )?.id;

      if (selectedBranch) {
        setFormData((prev) => ({
          ...prev,
          branch_id: String(selectedBranch),
        }));

        setCustomerForm((prev) => ({
          ...prev,
          branch_id: String(selectedBranch),
        }));

        setProductForm((prev) => ({
          ...prev,
          branch_id: String(selectedBranch),
        }));
      }

      setBranchForm(initialBranchForm);
      setBranchErrors({});
      setShowBranchModal(false);
      toast.success("Branch added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Branch create failed");
    }
  };

  const validateCustomerForm = () => {
    const nextErrors = {};

    const customerName = cleanString(customerForm.customer_name);
    const companyName = cleanString(customerForm.company_name);
    const email = normalizeEmail(customerForm.email);
    const phone = cleanString(customerForm.phone);
    const gstin = normalizeUpper(customerForm.gstin);
    const currency = normalizeUpper(customerForm.currency);
    const openingBalance = toNumber(customerForm.opening_balance);
    const creditLimit = toNumber(customerForm.credit_limit);

    if (!customerForm.branch_id && !formData.branch_id) {
      nextErrors.branch_id = "Please select branch";
    }

    if (!customerName) {
      nextErrors.customer_name = "Customer name is required";
    } else if (customerName.length < 2 || customerName.length > 100) {
      nextErrors.customer_name =
        "Customer name must be between 2 and 100 characters";
    } else if (!NAME_REGEX.test(customerName)) {
      nextErrors.customer_name = "Customer name contains invalid characters";
    }

    if (companyName && companyName.length > 100) {
      nextErrors.company_name = "Company name must be less than 100 characters";
    } else if (companyName && !NAME_REGEX.test(companyName)) {
      nextErrors.company_name = "Company name contains invalid characters";
    }

    if (!email) {
      nextErrors.email = "Customer email is required";
    } else if (!EMAIL_REGEX.test(email)) {
      nextErrors.email = "Please enter a valid customer email";
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone must be a valid 10 digit Indian mobile number";
    }

    if (gstin && !GST_REGEX.test(gstin)) {
      nextErrors.gstin = "Invalid GSTIN format";
    }

    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      nextErrors.currency = "Currency must be 3 letters, e.g. INR";
    }

    if (Number.isNaN(openingBalance) || openingBalance < 0) {
      nextErrors.opening_balance = "Opening balance cannot be negative";
    }

    if (Number.isNaN(creditLimit) || creditLimit < 0) {
      nextErrors.credit_limit = "Credit limit cannot be negative";
    }

    if (cleanString(customerForm.notes).length > 500) {
      nextErrors.notes = "Notes must be less than 500 characters";
    }

    setCustomerErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateCustomer = async () => {
    if (!canManageCustomers) {
      toast.error("Customer permission required");
      return;
    }

    if (!validateCustomerForm()) return;

    try {
      const payload = {
        branch_id: customerForm.branch_id || formData.branch_id || "",
        customer_name: cleanString(customerForm.customer_name),
        company_name: cleanString(customerForm.company_name),
        email: normalizeEmail(customerForm.email),
        phone: cleanString(customerForm.phone),
        gstin: normalizeUpper(customerForm.gstin),
        customer_type:
          cleanString(customerForm.customer_type).toLowerCase() || "business",
        billing_address: cleanString(customerForm.billing_address),
        shipping_address: cleanString(customerForm.shipping_address),
        payment_terms:
          cleanString(customerForm.payment_terms) || "Due on Receipt",
        currency: normalizeUpper(customerForm.currency) || "INR",
        opening_balance:
          customerForm.opening_balance === ""
            ? 0
            : Number(customerForm.opening_balance),
        customer_group: cleanString(customerForm.customer_group),
        credit_limit:
          customerForm.credit_limit === ""
            ? 0
            : Number(customerForm.credit_limit),
        notes: cleanString(customerForm.notes),
        status: cleanString(customerForm.status).toLowerCase() || "active",
      };

      const res = await api.post("/customers", payload);
      const newCustomer = res.data?.customer || res.data;

      const customerData = await fetchDropdownData(
        "/customers/dropdown",
        "/customers",
        "customers",
      );

      const updatedCustomers = customerData.filter(
        (customer) => customer.status === "active" || customer.status === 1,
      );

      setCustomers(updatedCustomers);

      const selectedCustomer =
        newCustomer?.id ||
        newCustomer?.customer_id ||
        updatedCustomers.find(
          (customer) =>
            customer.customer_name?.toLowerCase() ===
            payload.customer_name.toLowerCase(),
        )?.id;

      if (selectedCustomer) {
        setFormData((prev) => ({
          ...prev,
          branch_id: payload.branch_id || prev.branch_id,
          customer_id: String(selectedCustomer),
        }));
      }

      setCustomerForm(initialCustomerForm);
      setCustomerErrors({});
      setShowCustomerModal(false);
      toast.success("Customer added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Customer create failed");
    }
  };

  const validateProductForm = () => {
    const nextErrors = {};

    const productName = cleanString(productForm.product_name);
    const sku = normalizeUpper(productForm.sku);
    const hsnSac = normalizeUpper(productForm.hsn_sac_code);
    const unitPrice = toNumber(productForm.unit_price, NaN);
    const taxRate = toNumber(productForm.tax_rate, 0);
    const quantity = toNumber(productForm.quantity, 0);
    const unitType = cleanString(productForm.unit_type).toLowerCase();
    const category = cleanString(productForm.category);
    const description = cleanString(productForm.description);

    if (!productForm.branch_id && !formData.branch_id) {
      nextErrors.branch_id = "Please select branch";
    }

    if (!productName) {
      nextErrors.product_name = "Product name is required";
    } else if (productName.length < 2 || productName.length > 120) {
      nextErrors.product_name =
        "Product name must be between 2 and 120 characters";
    } else if (!PRODUCT_NAME_REGEX.test(productName)) {
      nextErrors.product_name = "Product name contains invalid characters";
    }

    if (sku && !SKU_REGEX.test(sku)) {
      nextErrors.sku =
        "SKU must be 2-50 characters and can contain letters, numbers, underscore or hyphen";
    }

    if (hsnSac && !HSN_SAC_REGEX.test(hsnSac)) {
      nextErrors.hsn_sac_code = "HSN/SAC code must be 4 to 8 digits";
    }

    if (Number.isNaN(unitPrice)) {
      nextErrors.unit_price = "Valid unit price is required";
    } else if (unitPrice <= 0) {
      nextErrors.unit_price = "Unit price must be greater than 0";
    }

    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      nextErrors.tax_rate = "GST must be between 0 and 100";
    }

    if (Number.isNaN(quantity) || quantity < 0) {
      nextErrors.quantity = "Quantity cannot be negative";
    } else if (!Number.isInteger(quantity)) {
      nextErrors.quantity = "Quantity must be a whole number";
    }

    if (!ALLOWED_UNIT_TYPES.includes(unitType)) {
      nextErrors.unit_type = `Unit type must be one of: ${ALLOWED_UNIT_TYPES.join(
        ", ",
      )}`;
    }

    if (category && category.length > 80) {
      nextErrors.category = "Category must be less than 80 characters";
    }

    if (description && description.length > 500) {
      nextErrors.description = "Description must be less than 500 characters";
    }

    if (productImageFile) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(productImageFile.type)) {
        nextErrors.image = "Only JPG, PNG or WEBP product images are allowed";
      } else if (productImageFile.size > 2 * 1024 * 1024) {
        nextErrors.image = "Product image size must be less than 2MB";
      }
    }

    setProductErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateProduct = async () => {
    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    if (!validateProductForm()) return;

    try {
      const payload = {
        branch_id: productForm.branch_id || formData.branch_id || "",
        product_name: cleanString(productForm.product_name),
        sku: normalizeUpper(productForm.sku),
        hsn_sac_code: normalizeUpper(productForm.hsn_sac_code),
        description: cleanString(productForm.description),
        unit_price: Number(productForm.unit_price || 0),
        tax_rate: Number(productForm.tax_rate || 0),
        quantity:
          productForm.quantity === "" ? 0 : Number(productForm.quantity),
        unit_type: cleanString(productForm.unit_type).toLowerCase() || "pcs",
        category: cleanString(productForm.category),
        status: cleanString(productForm.status).toLowerCase() || "active",
      };

      const res = await api.post("/products", payload);

      const createdProductId =
        res.data?.product_id || res.data?.id || res.data?.product?.id;

      await uploadProductImage(createdProductId);

      const newProduct = res.data?.product || res.data;

      const productData = await fetchDropdownData(
        "/products/dropdown",
        "/products",
        "products",
      );

      const updatedProducts = productData.filter(
        (product) => product.status === "active" || product.status === 1,
      );

      setProducts(updatedProducts);

      const selectedProduct =
        newProduct?.id ||
        newProduct?.product_id ||
        updatedProducts.find(
          (product) =>
            product.product_name?.toLowerCase() ===
            payload.product_name.toLowerCase(),
        )?.id;

      const selectedProductData = updatedProducts.find(
        (product) => Number(product.id) === Number(selectedProduct),
      );

      if (selectedProductData && productItemIndex !== null) {
        setItems((prevItems) => {
          const updatedItems = [...prevItems];

          updatedItems[productItemIndex] = {
            ...updatedItems[productItemIndex],
            product_id: String(selectedProductData.id),
            product_name:
              selectedProductData.product_name ||
              selectedProductData.name ||
              "",
            description: selectedProductData.description || "",
            hsn_sac_code: selectedProductData.hsn_sac_code || "",
            price:
              selectedProductData.unit_price ||
              selectedProductData.price ||
              selectedProductData.selling_price ||
              0,
            tax_rate: selectedProductData.tax_rate || 0,
          };

          return updatedItems;
        });
      }

      setProductForm(initialProductForm);
      setProductErrors({});
      setProductItemIndex(null);
      setShowProductModal(false);
      setProductImageFile(null);

      if (productImageInputRef.current) {
        productImageInputRef.current.value = "";
      }

      toast.success("Product added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Product create failed");
    }
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;

    setItems((prevItems) => {
      const updatedItems = [...prevItems];

      updatedItems[index] = {
        ...updatedItems[index],
        [name]: name === "hsn_sac_code" ? normalizeUpper(value) : value,
      };

      return updatedItems;
    });
  };

  const handleProductSelect = (index, e) => {
    const productId = e.target.value;

    if (productId === "__add_product__") {
      if (!canManageProducts) {
        toast.error("Product permission required");
        return;
      }

      setProductItemIndex(index);
      setProductForm({
        ...initialProductForm,
        branch_id: formData.branch_id || "",
      });
      setProductErrors({});
      setShowProductModal(true);
      return;
    }

    const product = products.find((p) => Number(p.id) === Number(productId));

    setItems((prevItems) => {
      const updatedItems = [...prevItems];

      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        product_name: product?.product_name || product?.name || "",
        description: product?.description || "",
        hsn_sac_code: product?.hsn_sac_code || "",
        price:
          product?.unit_price || product?.price || product?.selling_price || 0,
        tax_rate: product?.tax_rate || 0,
      };

      return updatedItems;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...blankItem }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) {
      toast.error("At least one item is required");
      return;
    }

    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateItem = (item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const taxRate = Number(item.tax_rate || 0);

    const base = quantity * price;
    const tax = (base * taxRate) / 100;
    const total = base + tax;

    return { base, tax, total };
  };

  const subtotal = items.reduce((sum, item) => {
    return sum + calculateItem(item).base;
  }, 0);

  const taxAmount = items.reduce((sum, item) => {
    return sum + calculateItem(item).tax;
  }, 0);

  const discount = Number(formData.discount_amount || 0);
  const total = subtotal + taxAmount - discount;

  const validateForm = () => {
    if (!canCreateQuotation) {
      toast.error("Quotation permission required");
      return false;
    }

    if (!formData.branch_id) {
      toast.error("Please select branch");
      return false;
    }

    if (!formData.customer_id) {
      toast.error("Please select customer");
      return false;
    }

    if (!formData.quotation_date) {
      toast.error("Quotation date is required");
      return false;
    }

    if (!isValidDate(formData.quotation_date)) {
      toast.error("Quotation date must be valid");
      return false;
    }

    if (formData.expiry_date) {
      if (!isValidDate(formData.expiry_date)) {
        toast.error("Expiry date must be valid");
        return false;
      }

      if (isBeforeDate(formData.expiry_date, formData.quotation_date)) {
        toast.error("Expiry date cannot be before quotation date");
        return false;
      }
    }

    if (discount < 0) {
      toast.error("Discount cannot be negative");
      return false;
    }

    if (discount > subtotal + taxAmount) {
      toast.error("Discount cannot be greater than total amount");
      return false;
    }

    if (cleanString(formData.notes).length > 1000) {
      toast.error("Notes must be less than 1000 characters");
      return false;
    }

    if (cleanString(formData.terms_conditions).length > 1500) {
      toast.error("Terms and conditions must be less than 1500 characters");
      return false;
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      if (!item.product_id) {
        toast.error(`Please select product at row ${index + 1}`);
        return false;
      }

      if (cleanString(item.description).length > 500) {
        toast.error(
          `Description must be less than 500 characters at row ${index + 1}`,
        );
        return false;
      }

      if (
        item.hsn_sac_code &&
        !HSN_SAC_REGEX.test(normalizeUpper(item.hsn_sac_code))
      ) {
        toast.error(`HSN/SAC code must be 4 to 8 digits at row ${index + 1}`);
        return false;
      }

      if (Number(item.quantity || 0) <= 0) {
        toast.error(`Quantity must be greater than 0 at row ${index + 1}`);
        return false;
      }

      if (Number(item.price || 0) < 0) {
        toast.error(`Price cannot be negative at row ${index + 1}`);
        return false;
      }

      if (Number(item.tax_rate || 0) < 0 || Number(item.tax_rate || 0) > 100) {
        toast.error(`Tax rate must be between 0 and 100 at row ${index + 1}`);
        return false;
      }
    }

    return true;
  };

  const buildQuotationPayload = () => ({
    branch_id: formData.branch_id,
    customer_id: formData.customer_id,
    quotation_date: formData.quotation_date,
    expiry_date: formData.expiry_date || "",
    discount_amount: discount,
    notes: cleanString(formData.notes),
    terms_conditions: cleanString(formData.terms_conditions),
    items: items.map((item) => ({
      product_id: item.product_id || null,
      item_name: cleanString(item.product_name),
      description: cleanString(item.description),
      hsn_sac_code: normalizeUpper(item.hsn_sac_code),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      tax_rate: Number(item.tax_rate || 0),
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = buildQuotationPayload();

      const res = isEditMode
        ? await api.put(`/quotations/${id}`, payload)
        : await api.post("/quotations", payload);

      toast.success(
        res.data?.message ||
          (isEditMode
            ? "Quotation updated successfully"
            : "Quotation created successfully"),
      );

      if (modalMode) {
        onCreated?.();
        return;
      }

      if (isEditMode) {
        navigate(`/dashboard/quotations/${id}`, { replace: true });
      } else {
        navigate("/dashboard/quotations", { replace: true });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          (isEditMode
            ? "Failed to update quotation"
            : "Failed to create quotation"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`w-full max-w-full min-w-0 space-y-5 ${
        modalMode
          ? "max-h-[92vh] overflow-y-auto bg-slate-100 p-4 dark:bg-slate-950"
          : ""
      }`}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <FileText size={17} />
              Quotation Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEditMode
                ? `Edit Quotation${
                    editingQuotationNumber ? ` - ${editingQuotationNumber}` : ""
                  }`
                : "Create Quotation"}
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isEditMode
                ? "Update quotation details without creating a new quotation."
                : "Create branch-wise quotation with inline branch, customer and product creation."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (modalMode) {
                onClose?.();
              } else {
                navigate("/dashboard/quotations");
              }
            }}
            className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <X size={16} className={modalMode ? "Close" : "Back"} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Branch, Customer & Dates
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select branch/customer or create them from this page.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field icon={<Building2 size={16} />} label="Branch">
              <BranchSelect
                branches={branches}
                value={formData.branch_id}
                canAddBranch={canManageBranches}
                onChange={(value) =>
                  handleFormChange({
                    target: { name: "branch_id", value },
                  })
                }
              />
            </Field>

            <Field icon={<User size={16} />} label="Customer">
              <CustomerSelect
                customers={filteredCustomers}
                value={formData.customer_id}
                canAddCustomer={canManageCustomers}
                onChange={(value) =>
                  handleFormChange({
                    target: { name: "customer_id", value },
                  })
                }
              />
            </Field>

            <Input
              icon={<CalendarDays size={16} />}
              label="Quotation Date"
              type="date"
              name="quotation_date"
              value={formData.quotation_date}
              onChange={handleFormChange}
            />

            <Input
              icon={<CalendarDays size={16} />}
              label="Valid Till"
              type="date"
              name="expiry_date"
              value={formData.expiry_date}
              onChange={handleFormChange}
              min={formData.quotation_date || getToday()}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Items
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Select product or create new product from this quotation page.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const itemTotal = calculateItem(item);

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Item #{index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <Field label="Product">
                      <ProductSelect
                        products={filteredProducts}
                        value={item.product_id}
                        canAddProduct={canManageProducts}
                        onChange={(value) =>
                          handleProductSelect(index, {
                            target: { value },
                          })
                        }
                      />
                    </Field>

                    <Input
                      label="Description"
                      name="description"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, e)}
                    />

                    <Input
                      label="HSN/SAC"
                      name="hsn_sac_code"
                      value={item.hsn_sac_code}
                      onChange={(e) => handleItemChange(index, e)}
                    />

                    <Input
                      label="Qty"
                      type="number"
                      name="quantity"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, e)}
                    />

                    <Input
                      label="Price"
                      type="number"
                      name="price"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, e)}
                    />

                    <Input
                      label="Tax %"
                      type="number"
                      name="tax_rate"
                      value={item.tax_rate}
                      onChange={(e) => handleItemChange(index, e)}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <AmountBox title="Taxable" value={itemTotal.base} />
                    <AmountBox title="Tax" value={itemTotal.tax} />
                    <AmountBox title="Line Total" value={itemTotal.total} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Notes & Terms
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field icon={<StickyNote size={16} />} label="Notes">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  rows="4"
                  className="input"
                />
              </Field>

              <Field icon={<FileText size={16} />} label="Terms & Conditions">
                <textarea
                  name="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={handleFormChange}
                  rows="4"
                  className="input"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Quotation Summary
            </h2>

            <div className="mt-4 space-y-3">
              <TotalRow label="Subtotal" value={subtotal} />
              <TotalRow label="Tax" value={taxAmount} />

              <Field icon={<IndianRupee size={16} />} label="Discount">
                <input
                  type="number"
                  name="discount_amount"
                  value={formData.discount_amount}
                  onChange={handleFormChange}
                  className="input"
                />
              </Field>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    Total
                  </span>
                  <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    ₹ {Number(total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Saving..."
                : isEditMode
                  ? "Update Quotation"
                  : "Save Quotation"}
            </button>
          </div>
        </div>
      </form>

      {showCustomerModal && (
        <Modal
          title="Add New Customer"
          description="Create customer without leaving quotation page."
          icon={<User size={21} />}
          onClose={() => setShowCustomerModal(false)}
        >
          <Section title="Basic Details">
            <ModalInput
              icon={<User size={16} />}
              label="Customer Name"
              name="customer_name"
              value={customerForm.customer_name}
              onChange={handleCustomerFormChange}
              error={customerErrors.customer_name}
              required
            />

            <ModalInput
              icon={<Building2 size={16} />}
              label="Company Name"
              name="company_name"
              value={customerForm.company_name}
              onChange={handleCustomerFormChange}
              error={customerErrors.company_name}
            />

            <Field
              icon={<Building2 size={16} />}
              label="Branch"
              error={customerErrors.branch_id}
            >
              <BranchSelect
                branches={branches}
                value={customerForm.branch_id}
                canAddBranch={canManageBranches}
                onChange={(value) => {
                  if (value === "__add_branch__") {
                    if (!canManageBranches) {
                      toast.error("Branch permission required");
                      return;
                    }

                    setBranchErrors({});
                    setShowBranchModal(true);
                    return;
                  }

                  handleCustomerFormChange({
                    target: { name: "branch_id", value },
                  });
                }}
              />
            </Field>

            <Field icon={<User size={16} />} label="Customer Type">
              <CustomDropdown
                value={customerForm.customer_type}
                onChange={(value) =>
                  handleCustomerFormChange({
                    target: { name: "customer_type", value },
                  })
                }
                options={[
                  { value: "business", label: "Business" },
                  { value: "individual", label: "Individual" },
                ]}
              />
            </Field>

            <ModalInput
              icon={<Tag size={16} />}
              label="Customer Group"
              name="customer_group"
              value={customerForm.customer_group}
              onChange={handleCustomerFormChange}
            />

            <Field icon={<CheckCircle2 size={16} />} label="Status">
              <CustomDropdown
                value={customerForm.status}
                onChange={(value) =>
                  handleCustomerFormChange({
                    target: { name: "status", value },
                  })
                }
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </Field>
          </Section>

          <Section title="Contact Information">
            <ModalInput
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              value={customerForm.email}
              onChange={handleCustomerFormChange}
              error={customerErrors.email}
              required
            />

            <ModalInput
              icon={<Phone size={16} />}
              label="Phone"
              name="phone"
              value={customerForm.phone}
              onChange={handleCustomerFormChange}
              error={customerErrors.phone}
            />
          </Section>

          <Section title="Tax & Billing">
            <ModalInput
              icon={<BadgePercent size={16} />}
              label="GSTIN"
              name="gstin"
              value={customerForm.gstin}
              onChange={handleCustomerFormChange}
              error={customerErrors.gstin}
            />

            <Field icon={<CalendarDays size={16} />} label="Payment Terms">
              <CustomDropdown
                value={customerForm.payment_terms}
                onChange={(value) =>
                  handleCustomerFormChange({
                    target: { name: "payment_terms", value },
                  })
                }
                icon={<CalendarDays size={16} />}
                options={[
                  { value: "Due on Receipt", label: "Due on Receipt" },
                  { value: "Net 7", label: "Net 7" },
                  { value: "Net 15", label: "Net 15" },
                  { value: "Net 30", label: "Net 30" },
                  { value: "Net 45", label: "Net 45" },
                  { value: "Net 60", label: "Net 60" },
                ]}
              />
            </Field>

            <ModalInput
              icon={<Landmark size={16} />}
              label="Currency"
              name="currency"
              value={customerForm.currency}
              onChange={handleCustomerFormChange}
              error={customerErrors.currency}
            />

            <ModalInput
              icon={<Wallet size={16} />}
              label="Opening Balance"
              name="opening_balance"
              type="number"
              value={customerForm.opening_balance}
              onChange={handleCustomerFormChange}
              error={customerErrors.opening_balance}
            />

            <ModalInput
              icon={<CreditCard size={16} />}
              label="Credit Limit"
              name="credit_limit"
              type="number"
              value={customerForm.credit_limit}
              onChange={handleCustomerFormChange}
              error={customerErrors.credit_limit}
            />
          </Section>

          <Section title="Address">
            <ModalInput
              icon={<MapPin size={16} />}
              label="Billing Address"
              name="billing_address"
              value={customerForm.billing_address}
              onChange={handleCustomerFormChange}
            />

            <ModalInput
              icon={<MapPin size={16} />}
              label="Shipping Address"
              name="shipping_address"
              value={customerForm.shipping_address}
              onChange={handleCustomerFormChange}
            />
          </Section>

          <ModalActions
            onCancel={() => setShowCustomerModal(false)}
            onSave={handleCreateCustomer}
            saveText="Save Customer"
          />
        </Modal>
      )}

      {showProductModal && (
        <Modal
          title="Add New Product"
          description="Create product without leaving quotation page."
          icon={<Package size={21} />}
          onClose={() => setShowProductModal(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ModalInput
              icon={<Package size={16} />}
              label="Product Name"
              name="product_name"
              value={productForm.product_name}
              onChange={handleProductFormChange}
              error={productErrors.product_name}
              required
            />

            <ModalInput
              icon={<Barcode size={16} />}
              label="SKU"
              name="sku"
              value={productForm.sku}
              onChange={handleProductFormChange}
              error={productErrors.sku}
            />

            <ModalInput
              icon={<FileText size={16} />}
              label="HSN/SAC Code"
              name="hsn_sac_code"
              value={productForm.hsn_sac_code}
              onChange={handleProductFormChange}
              error={productErrors.hsn_sac_code}
            />

            <ModalInput
              icon={<IndianRupee size={16} />}
              label="Unit Price"
              name="unit_price"
              type="number"
              value={productForm.unit_price}
              onChange={handleProductFormChange}
              error={productErrors.unit_price}
              required
            />

            <ModalInput
              icon={<Percent size={16} />}
              label="GST %"
              name="tax_rate"
              type="number"
              value={productForm.tax_rate}
              onChange={handleProductFormChange}
              error={productErrors.tax_rate}
            />

            <ModalInput
              icon={<Boxes size={16} />}
              label="Quantity"
              name="quantity"
              type="number"
              value={productForm.quantity}
              onChange={handleProductFormChange}
              error={productErrors.quantity}
            />

            <Field
              icon={<Tag size={16} />}
              label="Unit Type"
              error={productErrors.unit_type}
            >
              <CustomDropdown
                value={productForm.unit_type}
                onChange={(value) =>
                  handleProductFormChange({
                    target: { name: "unit_type", value },
                  })
                }
                options={[
                  { value: "pcs", label: "Pcs" },
                  { value: "kg", label: "Kg" },
                  { value: "g", label: "G" },
                  { value: "ltr", label: "Ltr" },
                  { value: "ml", label: "Ml" },
                  { value: "box", label: "Box" },
                  { value: "pack", label: "Pack" },
                  { value: "meter", label: "Meter" },
                  { value: "hour", label: "Hour" },
                  { value: "day", label: "Day" },
                  { value: "service", label: "Service" },
                ]}
              />
            </Field>

            <ModalInput
              icon={<Tag size={16} />}
              label="Category"
              name="category"
              value={productForm.category}
              onChange={handleProductFormChange}
              error={productErrors.category}
            />

            <Field
              icon={<Building2 size={16} />}
              label="Branch"
              error={productErrors.branch_id}
            >
              <BranchSelect
                branches={branches}
                value={productForm.branch_id}
                canAddBranch={canManageBranches}
                onChange={(value) => {
                  if (value === "__add_branch__") {
                    if (!canManageBranches) {
                      toast.error("Branch permission required");
                      return;
                    }

                    setBranchErrors({});
                    setShowBranchModal(true);
                    return;
                  }

                  handleProductFormChange({
                    target: { name: "branch_id", value },
                  });
                }}
              />
            </Field>

            <Field icon={<CheckCircle2 size={16} />} label="Status">
              <CustomDropdown
                value={productForm.status}
                onChange={(value) =>
                  handleProductFormChange({
                    target: { name: "status", value },
                  })
                }
                icon={<CheckCircle2 size={16} />}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </Field>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Image size={16} />
                Product Image
              </label>

              <div
                className={`flex flex-col gap-4 rounded-2xl border bg-slate-50 p-4 dark:bg-slate-950 sm:flex-row sm:items-center ${
                  productErrors.image
                    ? "border-red-300 dark:border-red-700"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  {productImageFile ? (
                    <img
                      src={URL.createObjectURL(productImageFile)}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image size={26} className="text-slate-400" />
                  )}
                </div>

                <div className="flex-1">
                  <input
                    ref={productImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      setProductImageFile(e.target.files?.[0] || null);
                      clearProductError("image");
                    }}
                    className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 dark:file:bg-slate-700 dark:hover:file:bg-slate-600"
                  />

                  {productErrors.image ? (
                    <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                      {productErrors.image}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Upload PNG, JPG or WebP image. Max size 2MB.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <Field
                icon={<Package size={16} />}
                label="Description"
                error={productErrors.description}
              >
                <textarea
                  name="description"
                  value={productForm.description}
                  onChange={handleProductFormChange}
                  rows="3"
                  className={`input ${
                    productErrors.description ? "input-error" : ""
                  }`}
                />
              </Field>
            </div>
          </div>

          <ModalActions
            onCancel={() => setShowProductModal(false)}
            onSave={handleCreateProduct}
            saveText="Save Product"
          />
        </Modal>
      )}

      {showBranchModal && (
        <Modal
          title="Add New Branch"
          description="Create branch without leaving quotation page."
          icon={<GitBranch size={21} />}
          onClose={() => setShowBranchModal(false)}
          topMost
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ModalInput
              icon={<Building2 size={16} />}
              label="Branch Name"
              name="branch_name"
              value={branchForm.branch_name}
              onChange={handleBranchFormChange}
              error={branchErrors.branch_name}
              required
            />

            <ModalInput
              icon={<Hash size={16} />}
              label="Branch Code"
              name="branch_code"
              value={branchForm.branch_code}
              onChange={handleBranchFormChange}
              error={branchErrors.branch_code}
              required
            />

            <ModalInput
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              value={branchForm.email}
              onChange={handleBranchFormChange}
              error={branchErrors.email}
            />

            <ModalInput
              icon={<Phone size={16} />}
              label="Phone"
              name="phone"
              value={branchForm.phone}
              onChange={handleBranchFormChange}
              error={branchErrors.phone}
            />

            <ModalInput
              icon={<BadgePercent size={16} />}
              label="GST Number"
              name="gst_number"
              value={branchForm.gst_number}
              onChange={handleBranchFormChange}
              error={branchErrors.gst_number}
            />

            <ModalInput
              icon={<MapPin size={16} />}
              label="City"
              name="city"
              value={branchForm.city}
              onChange={handleBranchFormChange}
            />

            <ModalInput
              icon={<MapPin size={16} />}
              label="State"
              name="state"
              value={branchForm.state}
              onChange={handleBranchFormChange}
            />

            <ModalInput
              icon={<Globe size={16} />}
              label="Country"
              name="country"
              value={branchForm.country}
              onChange={handleBranchFormChange}
              error={branchErrors.country}
            />

            <ModalInput
              icon={<Hash size={16} />}
              label="ZIP Code"
              name="zip_code"
              value={branchForm.zip_code}
              onChange={handleBranchFormChange}
              error={branchErrors.zip_code}
            />

            <Field
              icon={<CheckCircle2 size={16} />}
              label="Status"
              error={branchErrors.status}
            >
              <CustomDropdown
                value={branchForm.status}
                onChange={(value) =>
                  handleBranchFormChange({
                    target: { name: "status", value },
                  })
                }
                icon={<CheckCircle2 size={16} />}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </Field>
          </div>

          <ModalActions
            onCancel={() => setShowBranchModal(false)}
            onSave={handleCreateBranch}
            saveText="Save Branch"
          />
        </Modal>
      )}

      <style>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #334155;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }

        .input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        .input-error {
          border-color: #f87171 !important;
        }

        .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px #fee2e2 !important;
        }

        .dark .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }

        .dark .input::placeholder {
          color: #64748b;
        }

        .dark .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }

        .dark .input:disabled {
          background: #1e293b;
          color: #94a3b8;
        }

        .dark .input-error {
          border-color: #f87171 !important;
        }
      `}</style>
    </div>
  );
}

function Field({ label, icon, children, error }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        {label}
      </label>

      {children}

      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function Input({ label, icon, name, value, onChange, type = "text", min }) {
  return (
    <Field icon={icon} label={label}>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        min={min}
        className="input"
      />
    </Field>
  );
}

function ModalInput({
  icon,
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  error,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        className={`input ${error ? "input-error" : ""}`}
      />

      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function BranchSelect({ branches, value, canAddBranch = false, onChange }) {
  const branchOptions = branches.map((branch) => ({
    value: String(branch.id),
    title: branch.branch_name || "Unnamed Branch",
    subtitle: branch.branch_code
      ? `Code: ${branch.branch_code}`
      : "No branch code",
  }));

  return (
    <SearchableDropdown
      value={value}
      placeholder="Select Branch"
      searchPlaceholder="Search branch..."
      options={branchOptions}
      addAction={
        canAddBranch
          ? { label: "Add New Branch", value: "__add_branch__" }
          : null
      }
      onChange={onChange}
    />
  );
}

function CustomerSelect({
  customers,
  value,
  canAddCustomer = false,
  onChange,
}) {
  const customerOptions = customers.map((customer) => ({
    value: String(customer.id),
    title:
      customer.customer_name || customer.company_name || "Unnamed Customer",
    subtitle: customer.branch_name
      ? `${customer.branch_name}${customer.email ? ` • ${customer.email}` : ""}`
      : customer.email || "No email",
  }));

  return (
    <SearchableDropdown
      value={value}
      placeholder="Select Customer"
      searchPlaceholder="Search customer..."
      emptyText="No customer found"
      options={customerOptions}
      addAction={
        canAddCustomer
          ? { label: "Add New Customer", value: "__add_customer__" }
          : null
      }
      onChange={onChange}
    />
  );
}

function ProductSelect({ products, value, canAddProduct = false, onChange }) {
  const productOptions = products.map((product) => ({
    value: String(product.id),
    title: product.product_name || product.name || "Unnamed Product",
    subtitle: product.branch_name
      ? `${product.branch_name}${product.sku ? ` • ${product.sku}` : ""}`
      : product.sku || "No SKU",
  }));

  return (
    <SearchableDropdown
      value={value}
      placeholder="Select Product"
      searchPlaceholder="Search product..."
      emptyText="No product found"
      options={productOptions}
      addAction={
        canAddProduct
          ? { label: "Add New Product", value: "__add_product__" }
          : null
      }
      onChange={onChange}
    />
  );
}

function AmountBox({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
        ₹ {Number(value || 0).toFixed(2)}
      </p>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>

      <span className="text-sm font-semibold text-slate-900 dark:text-white">
        ₹ {Number(value || 0).toFixed(2)}
      </span>
    </div>
  );
}

function Modal({
  title,
  description,
  icon,
  onClose,
  children,
  topMost = false,
}) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm ${
        topMost ? "z-[60000]" : "z-[50000]"
      }`}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {icon || <FileText size={21} />}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, saveText }) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <X size={16} />
        Cancel
      </button>

      <button
        type="button"
        onClick={onSave}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Save size={16} />
        {saveText}
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No option found",
  addAction = null,
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const filteredOptions = options.filter((option) =>
    `${option.title || ""} ${option.subtitle || ""}`
      .toLowerCase()
      .includes(keyword.trim().toLowerCase()),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setKeyword("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setKeyword("");
  };

  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="min-w-0 truncate">
          {selected?.title || placeholder}
        </span>

        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full rounded-xl px-3 py-2 text-left transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                  String(value) === String(option.value)
                    ? "bg-blue-50 dark:bg-blue-950/40"
                    : ""
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {option.title}
                </p>

                {option.subtitle && (
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {option.subtitle}
                  </p>
                )}
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                {emptyText}
              </div>
            )}
          </div>

          {addAction && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelect(addAction.value)}
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                <Plus size={16} />
                {addAction.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-slate-400 dark:text-slate-500">
              {icon}
            </span>
          )}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => {
            const active = String(value) === String(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {active && <CheckCircle2 size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CreateQuotation;
