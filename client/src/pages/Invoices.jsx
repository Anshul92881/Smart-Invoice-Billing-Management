import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import CreateInvoice from "./CreateInvoice";

import {
  FileText,
  Plus,
  Trash2,
  Mail,
  Ban,
  IndianRupee,
  Percent,
  X,
  Save,
  Building2,
  GitBranch,
  Hash,
  Phone,
  BadgePercent,
  MapPin,
  Globe,
  User,
  Users,
  Tag,
  Landmark,
  Wallet,
  CreditCard,
  CalendarDays,
  StickyNote,
  CheckCircle2,
  Package,
  Barcode,
  Boxes,
  Image,
  ChevronDown,
  Search,
  Filter,
  Eye,
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

function Invoices({ modalMode = false, onClose, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceBranchFilter, setInvoiceBranchFilter] = useState("all");
  const [invoiceFromDate, setInvoiceFromDate] = useState("");
  const [invoiceToDate, setInvoiceToDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [branchOpenSource, setBranchOpenSource] = useState("invoice");
  const [productItemIndex, setProductItemIndex] = useState(null);
  const [productImageFile, setProductImageFile] = useState(null);
  const productImageInputRef = useRef(null);
  const navigate = useNavigate();

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

  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [productForm, setProductForm] = useState(initialProductForm);

  const user = JSON.parse(localStorage.getItem("user"));

  const [rolePermissions, setRolePermissions] = useState({});

  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        if (user?.role === "company_admin") return;

        const res = await api.get("/companies/role-permissions");

        setRolePermissions(res.data?.permissions || {});
      } catch {
        setRolePermissions({});
      }
    };

    fetchRolePermissions();
  }, []);

  const canCreate = ["company_admin", "accountant", "sales_user"].includes(
    user?.role,
  );

  const canAddBranch =
    user?.role === "company_admin" ||
    Boolean(rolePermissions?.[user?.role]?.branches);

  const canAddProduct =
    user?.role === "company_admin" ||
    Boolean(rolePermissions?.[user?.role]?.products);

  const canAddCustomer =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    Boolean(rolePermissions?.[user?.role]?.customers);

  const canCancel = ["company_admin", "accountant"].includes(user?.role);

  const initialForm = {
    customer_id: "",
    branch_id: "",
    invoice_date: getToday(),
    due_date: "",
    notes: "",
    items: [],
  };

  const [formData, setFormData] = useState(initialForm);

  const getList = (data, key) => {
    if (Array.isArray(data)) return data;
    return data?.[key] || [];
  };

  const fetchData = async () => {
    try {
      const [customerRes, productRes, branchRes, invoiceRes] =
        await Promise.all([
          api.get("/customers/dropdown"),
          api.get("/products"),
          api.get("/branches"),
          api.get("/invoices"),
        ]);

      setCustomers(getList(customerRes.data, "customers"));
      setProducts(getList(productRes.data, "products"));
      setBranches(getList(branchRes.data, "branches"));
      setInvoices(getList(invoiceRes.data, "invoices"));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load invoice data",
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (modalMode) {
      setShowInvoiceModal(true);
    }
  }, [modalMode]);

  const activeBranches = useMemo(
    () =>
      (Array.isArray(branches) ? branches : []).filter(
        (branch) =>
          branch.status === "active" ||
          branch.status === 1 ||
          branch.status === true,
      ),
    [branches],
  );

  useEffect(() => {
    const hqBranch = activeBranches.find(
      (b) =>
        b.is_main === 1 ||
        b.is_main === true ||
        String(b.is_main) === "1" ||
        b.branch_name?.toLowerCase() === "head office",
    );

    if (!hqBranch || formData.branch_id) return;

    setFormData((prev) => ({
      ...prev,
      branch_id: String(hqBranch.id),
    }));
  }, [activeBranches, formData.branch_id]);

  const filteredCustomers = useMemo(() => {
    return (Array.isArray(customers) ? customers : []).filter(
      (customer) => customer.status !== "inactive",
    );
  }, [customers]);

  const filteredProducts = useMemo(() => {
    return (Array.isArray(products) ? products : []).filter(
      (product) => product.status !== "inactive",
    );
  }, [products]);

  const filteredInvoices = useMemo(() => {
    const keyword = invoiceSearch.trim().toLowerCase();
    const list = Array.isArray(invoices) ? invoices : [];

    return list.filter((invoice) => {
      const invoiceDate = invoice.invoice_date
        ? new Date(invoice.invoice_date).toISOString().slice(0, 10)
        : "";

      const matchesSearch =
        !keyword ||
        invoice.invoice_number?.toLowerCase().includes(keyword) ||
        invoice.customer_name?.toLowerCase().includes(keyword) ||
        invoice.company_name?.toLowerCase().includes(keyword) ||
        invoice.branch_name?.toLowerCase().includes(keyword) ||
        invoice.status?.toLowerCase().includes(keyword);

      const matchesStatus =
        invoiceStatusFilter === "all" || invoice.status === invoiceStatusFilter;

      const matchesBranch =
        invoiceBranchFilter === "all" ||
        String(invoice.branch_id || "") === String(invoiceBranchFilter);

      const matchesFromDate =
        !invoiceFromDate || invoiceDate >= invoiceFromDate;

      const matchesToDate = !invoiceToDate || invoiceDate <= invoiceToDate;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBranch &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [
    invoices,
    invoiceSearch,
    invoiceStatusFilter,
    invoiceBranchFilter,
    invoiceFromDate,
    invoiceToDate,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    invoiceSearch,
    invoiceStatusFilter,
    invoiceBranchFilter,
    invoiceFromDate,
    invoiceToDate,
  ]);

  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredInvoices]);

  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;

    return sortedInvoices.slice(start, start + itemsPerPage);
  }, [sortedInvoices, currentPage, itemsPerPage]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "branch_id") {
      setFormData((prev) => ({
        ...prev,
        branch_id: value,
        customer_id: "",
        items: [],
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

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBranchFormChange = (e) => {
    const { name, value } = e.target;

    const nextValue =
      name === "branch_code" || name === "gst_number"
        ? normalizeUpper(value)
        : value;

    setBranchForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleCustomerFormChange = (e) => {
    const { name, value } = e.target;

    const nextValue =
      name === "email"
        ? normalizeEmail(value)
        : name === "gstin" || name === "currency"
          ? normalizeUpper(value)
          : value;

    setCustomerForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleProductFormChange = (e) => {
    const { name, value } = e.target;

    const nextValue =
      name === "sku" || name === "hsn_sac_code" ? normalizeUpper(value) : value;

    setProductForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const resetBranchForm = () => {
    setBranchForm(initialBranchForm);
  };

  const resetCustomerForm = () => {
    setCustomerForm({
      ...initialCustomerForm,
      branch_id: formData.branch_id || "",
    });
  };

  const resetProductForm = () => {
    setProductForm({
      ...initialProductForm,
      branch_id: formData.branch_id || "",
    });
    setProductImageFile(null);
    setProductItemIndex(null);

    if (productImageInputRef.current) {
      productImageInputRef.current.value = "";
    }
  };

  const validateProductImage = () => {
    if (!productImageFile) return true;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(productImageFile.type)) {
      toast.error("Only JPG, PNG or WEBP product images are allowed");
      return false;
    }

    if (productImageFile.size > 2 * 1024 * 1024) {
      toast.error("Product image size must be less than 2MB");
      return false;
    }

    return true;
  };

  const uploadProductImage = async (productId) => {
    if (!productImageFile || !productId) return;

    if (!validateProductImage()) return;

    const data = new FormData();
    data.append("image", productImageFile);

    await api.post(`/products/${productId}/image`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  };

  const validateBranchForm = () => {
    const branchName = cleanString(branchForm.branch_name);
    const branchCode = normalizeUpper(branchForm.branch_code);
    const email = normalizeEmail(branchForm.email);
    const phone = cleanString(branchForm.phone);
    const gstNumber = normalizeUpper(branchForm.gst_number);
    const zipCode = cleanString(branchForm.zip_code);
    const country = cleanString(branchForm.country);

    if (!branchName) {
      toast.error("Branch name is required");
      return false;
    }

    if (branchName.length < 2 || branchName.length > 100) {
      toast.error("Branch name must be between 2 and 100 characters");
      return false;
    }

    if (!NAME_REGEX.test(branchName)) {
      toast.error("Branch name contains invalid characters");
      return false;
    }

    if (branchCode && !BRANCH_CODE_REGEX.test(branchCode)) {
      toast.error(
        "Branch code must be 2-20 characters and can contain letters, numbers, underscore or hyphen",
      );
      return false;
    }

    if (email && !EMAIL_REGEX.test(email)) {
      toast.error("Invalid branch email format");
      return false;
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      toast.error("Phone must be a valid 10 digit Indian mobile number");
      return false;
    }

    if (gstNumber && !GST_REGEX.test(gstNumber)) {
      toast.error("Invalid GST number format");
      return false;
    }

    if (zipCode && !ZIP_REGEX.test(zipCode)) {
      toast.error("ZIP code must be 5 to 6 digits");
      return false;
    }

    if (country && country.length > 60) {
      toast.error("Country must be less than 60 characters");
      return false;
    }

    if (!["active", "inactive"].includes(cleanString(branchForm.status))) {
      toast.error("Status must be active or inactive");
      return false;
    }

    return true;
  };

  const handleCreateBranch = async () => {
    if (!canAddBranch) {
      toast.error("Branch permission required");
      return;
    }

    if (!validateBranchForm()) return;

    try {
      const payload = {
        ...branchForm,
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

      const branchRes = await api.get("/branches");
      const updatedBranches = getList(branchRes.data, "branches");
      setBranches(updatedBranches);

      const selectedBranch =
        newBranch?.id ||
        updatedBranches.find(
          (branch) =>
            branch.branch_name?.toLowerCase() ===
            payload.branch_name.toLowerCase(),
        )?.id;

      if (selectedBranch) {
        if (branchOpenSource === "customer") {
          setCustomerForm((prev) => ({
            ...prev,
            branch_id: String(selectedBranch),
          }));
        } else if (branchOpenSource === "product") {
          setProductForm((prev) => ({
            ...prev,
            branch_id: String(selectedBranch),
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            branch_id: String(selectedBranch),
            customer_id: "",
            items: [],
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
      }

      resetBranchForm();
      setShowBranchModal(false);
      toast.success("Branch added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Branch create failed");
    }
  };

  const validateCustomerForm = () => {
    const customerName = cleanString(customerForm.customer_name);
    const companyName = cleanString(customerForm.company_name);
    const email = normalizeEmail(customerForm.email);
    const phone = cleanString(customerForm.phone);
    const gstin = normalizeUpper(customerForm.gstin);
    const currency = normalizeUpper(customerForm.currency);
    const openingBalance = toNumber(customerForm.opening_balance);
    const creditLimit = toNumber(customerForm.credit_limit);

    if (!customerForm.branch_id && !formData.branch_id) {
      toast.error("Please select branch");
      return false;
    }

    if (!customerName) {
      toast.error("Customer name is required");
      return false;
    }

    if (customerName.length < 2 || customerName.length > 100) {
      toast.error("Customer name must be between 2 and 100 characters");
      return false;
    }

    if (!NAME_REGEX.test(customerName)) {
      toast.error("Customer name contains invalid characters");
      return false;
    }

    if (companyName && companyName.length > 100) {
      toast.error("Company name must be less than 100 characters");
      return false;
    }

    if (companyName && !NAME_REGEX.test(companyName)) {
      toast.error("Company name contains invalid characters");
      return false;
    }

    if (!email) {
      toast.error("Customer email is required");
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      toast.error("Please enter a valid customer email");
      return false;
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      toast.error("Phone must be a valid 10 digit Indian mobile number");
      return false;
    }

    if (gstin && !GST_REGEX.test(gstin)) {
      toast.error("Invalid GSTIN format");
      return false;
    }

    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      toast.error("Currency must be 3 letters, e.g. INR");
      return false;
    }

    if (Number.isNaN(openingBalance) || openingBalance < 0) {
      toast.error("Opening balance cannot be negative");
      return false;
    }

    if (Number.isNaN(creditLimit) || creditLimit < 0) {
      toast.error("Credit limit cannot be negative");
      return false;
    }

    if (cleanString(customerForm.notes).length > 500) {
      toast.error("Notes must be less than 500 characters");
      return false;
    }

    return true;
  };

  const handleCreateCustomer = async () => {
    if (!canAddCustomer) {
      toast.error("Customer permission required");
      return;
    }

    if (!validateCustomerForm()) return;

    try {
      const payload = {
        ...customerForm,
        branch_id: customerForm.branch_id || formData.branch_id || null,
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

      const customerRes = await api.get("/customers/dropdown");
      const updatedCustomers = getList(customerRes.data, "customers");
      setCustomers(updatedCustomers);

      const selectedCustomer =
        newCustomer?.id ||
        updatedCustomers.find(
          (customer) =>
            customer.customer_name?.toLowerCase() ===
            payload.customer_name.toLowerCase(),
        )?.id;

      if (selectedCustomer) {
        setFormData((prev) => ({
          ...prev,
          customer_id: String(selectedCustomer),
          branch_id: payload.branch_id || prev.branch_id,
        }));
      }

      resetCustomerForm();
      setShowCustomerModal(false);
      toast.success("Customer added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Customer create failed");
    }
  };

  const validateProductForm = () => {
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
      toast.error("Please select branch");
      return false;
    }

    if (!productName) {
      toast.error("Product name is required");
      return false;
    }

    if (productName.length < 2 || productName.length > 120) {
      toast.error("Product name must be between 2 and 120 characters");
      return false;
    }

    if (!PRODUCT_NAME_REGEX.test(productName)) {
      toast.error("Product name contains invalid characters");
      return false;
    }

    if (sku && !SKU_REGEX.test(sku)) {
      toast.error(
        "SKU must be 2-50 characters and can contain letters, numbers, underscore or hyphen",
      );
      return false;
    }

    if (hsnSac && !HSN_SAC_REGEX.test(hsnSac)) {
      toast.error("HSN/SAC code must be 4 to 8 digits");
      return false;
    }

    if (Number.isNaN(unitPrice)) {
      toast.error("Valid unit price is required");
      return false;
    }

    if (unitPrice <= 0) {
      toast.error("Unit price must be greater than 0");
      return false;
    }

    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      toast.error("GST must be between 0 and 100");
      return false;
    }

    if (Number.isNaN(quantity) || quantity < 0) {
      toast.error("Quantity cannot be negative");
      return false;
    }

    if (quantity && !Number.isInteger(quantity)) {
      toast.error("Quantity must be a whole number");
      return false;
    }

    if (!ALLOWED_UNIT_TYPES.includes(unitType)) {
      toast.error(`Unit type must be one of: ${ALLOWED_UNIT_TYPES.join(", ")}`);
      return false;
    }

    if (category && category.length > 80) {
      toast.error("Category must be less than 80 characters");
      return false;
    }

    if (description && description.length > 500) {
      toast.error("Description must be less than 500 characters");
      return false;
    }

    return validateProductImage();
  };

  const handleCreateProduct = async () => {
    if (!canAddProduct) {
      toast.error("Product permission required");
      return;
    }

    if (!validateProductForm()) return;

    try {
      const payload = {
        ...productForm,
        branch_id: productForm.branch_id || formData.branch_id || null,
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

      const productRes = await api.get("/products");
      const updatedProducts = getList(productRes.data, "products");
      setProducts(updatedProducts);

      const selectedProductId =
        createdProductId ||
        updatedProducts.find(
          (product) =>
            product.product_name?.toLowerCase() ===
            payload.product_name.toLowerCase(),
        )?.id;

      const selectedProduct = updatedProducts.find(
        (product) => Number(product.id) === Number(selectedProductId),
      );

      if (selectedProduct && productItemIndex !== null) {
        const updatedItems = [...formData.items];

        updatedItems[productItemIndex] = {
          ...updatedItems[productItemIndex],
          product_id: selectedProduct.id,
          product_name: selectedProduct.product_name || "",
          description: selectedProduct.description || "",
          hsn_sac_code: selectedProduct.hsn_sac_code || "",
          price: selectedProduct.unit_price || 0,
          tax_rate: selectedProduct.tax_rate || 0,
          cgst_percentage: selectedProduct.cgst_percentage || 0,
          sgst_percentage: selectedProduct.sgst_percentage || 0,
          igst_percentage: selectedProduct.igst_percentage || 0,
        };

        setFormData((prev) => ({
          ...prev,
          items: updatedItems,
        }));
      }

      resetProductForm();
      setShowProductModal(false);
      toast.success("Product added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Product create failed");
    }
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: "",
          product_name: "",
          description: "",
          hsn_sac_code: "",
          quantity: 1,
          price: 0,
          tax_rate: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
        },
      ],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) {
      toast.error("At least one item is required");
      return;
    }

    const updatedItems = [...formData.items];
    updatedItems.splice(index, 1);
    setFormData((prev) => ({ ...prev, items: updatedItems }));
  };

  const calculateItem = (item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const rate = Number(item.tax_rate || 0);

    const taxable = qty * price;
    const tax = (taxable * rate) / 100;

    const cgst = item.cgst_percentage
      ? (taxable * Number(item.cgst_percentage || 0)) / 100
      : tax / 2;

    const sgst = item.sgst_percentage
      ? (taxable * Number(item.sgst_percentage || 0)) / 100
      : tax / 2;

    const igst = item.igst_percentage
      ? (taxable * Number(item.igst_percentage || 0)) / 100
      : tax;

    return {
      taxable,
      tax,
      total: taxable + tax,
      cgst,
      sgst,
      igst,
    };
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];

    if (field === "product_id" && value === "__add_product__") {
      if (!canAddProduct) {
        toast.error("Product permission required");
        return;
      }

      setProductItemIndex(index);
      setProductForm({
        ...initialProductForm,
        branch_id: formData.branch_id || "",
      });
      setShowProductModal(true);
      return;
    }

    updatedItems[index][field] =
      field === "hsn_sac_code" ? normalizeUpper(value) : value;

    if (field === "product_id") {
      const selectedProduct = filteredProducts.find(
        (p) => Number(p.id) === Number(value),
      );

      if (selectedProduct) {
        updatedItems[index] = {
          ...updatedItems[index],
          product_id: selectedProduct.id,
          product_name: selectedProduct.product_name || "",
          description: selectedProduct.description || "",
          hsn_sac_code: selectedProduct.hsn_sac_code || "",
          price: selectedProduct.unit_price || 0,
          tax_rate: selectedProduct.tax_rate || 0,
          cgst_percentage: selectedProduct.cgst_percentage || 0,
          sgst_percentage: selectedProduct.sgst_percentage || 0,
          igst_percentage: selectedProduct.igst_percentage || 0,
        };
      }
    }

    setFormData((prev) => ({ ...prev, items: updatedItems }));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    let total = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    formData.items.forEach((item) => {
      const result = calculateItem(item);
      subtotal += result.taxable;
      tax += result.tax;
      total += result.total;
      cgst += result.cgst;
      sgst += result.sgst;
      igst += result.igst;
    });

    return { subtotal, tax, total, cgst, sgst, igst };
  };

  const totals = calculateTotals();

  const resetForm = () => {
    setFormData(initialForm);
    resetBranchForm();
    resetCustomerForm();
    setShowBranchModal(false);
    setShowCustomerModal(false);
    setShowProductModal(false);
    resetProductForm();
  };

  const validateInvoiceForm = () => {
    if (!canCreate) {
      toast.error("Invoice permission required");
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

    if (!formData.invoice_date) {
      toast.error("Invoice date is required");
      return false;
    }

    if (!isValidDate(formData.invoice_date)) {
      toast.error("Invoice date must be valid");
      return false;
    }

    if (formData.due_date) {
      if (!isValidDate(formData.due_date)) {
        toast.error("Due date must be valid");
        return false;
      }

      if (isBeforeDate(formData.due_date, formData.invoice_date)) {
        toast.error("Due date cannot be before invoice date");
        return false;
      }
    }

    if (
      formData.invoice_date &&
      formData.due_date &&
      formData.due_date < formData.invoice_date
    ) {
      toast.error("Due date cannot be before invoice date");
      return false;
    }

    if (!formData.items.length) {
      toast.error("Please add at least one item");
      return false;
    }

    if (formData.items.length > 100) {
      toast.error("Invoice cannot have more than 100 items");
      return false;
    }

    if (cleanString(formData.notes).length > 1000) {
      toast.error("Notes must be less than 1000 characters");
      return false;
    }

    for (let index = 0; index < formData.items.length; index += 1) {
      const item = formData.items[index];
      const row = index + 1;

      if (!item.product_id) {
        toast.error(`Please select product at row ${row}`);
        return false;
      }

      if (cleanString(item.description).length > 500) {
        toast.error(
          `Description must be less than 500 characters at row ${row}`,
        );
        return false;
      }

      if (
        item.hsn_sac_code &&
        !HSN_SAC_REGEX.test(normalizeUpper(item.hsn_sac_code))
      ) {
        toast.error(`HSN/SAC code must be 4 to 8 digits at row ${row}`);
        return false;
      }

      const quantity = toNumber(item.quantity, NaN);
      const price = toNumber(item.price, NaN);
      const taxRate = toNumber(item.tax_rate, 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error(`Quantity must be greater than 0 at row ${row}`);
        return false;
      }

      if (!Number.isFinite(price) || price <= 0) {
        toast.error(`Price must be greater than 0 at row ${row}`);
        return false;
      }

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        toast.error(`GST must be between 0 and 100 at row ${row}`);
        return false;
      }
    }

    return true;
  };

  const buildInvoicePayload = () => ({
    customer_id: formData.customer_id,
    branch_id: formData.branch_id,
    invoice_date: formData.invoice_date,
    due_date: formData.due_date || "",
    notes: cleanString(formData.notes),
    items: formData.items.map((item) => ({
      product_id: item.product_id,
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

    if (!validateInvoiceForm()) return;

    try {
      await api.post("/invoices", buildInvoicePayload());
      toast.success("Invoice created successfully");
      resetForm();
      setShowInvoiceModal(false);
      fetchData();

      if (modalMode) {
        onCreated?.();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Invoice create failed");
    }
  };

  const handleCancel = async (id) => {
    if (!id) {
      toast.error("Invoice id missing");
      return;
    }

    if (!canCancel) {
      toast.error("Cancel permission required");
      return;
    }

    if (!confirm("Are you sure you want to cancel this invoice?")) return;

    try {
      await api.patch(`/invoices/${id}/cancel`);
      toast.success("Invoice cancelled");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Cancel failed");
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-hidden">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <FileText size={17} />
              Invoice Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Invoices
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create GST invoices with branch, customer, HSN/SAC and GST.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {sortedInvoices.length} Invoices
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md"
              >
                <Plus size={16} />
                Create Invoice
              </button>
            )}
          </div>
        </div>
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <CreateInvoice
              modalMode
              onClose={() => setShowInvoiceModal(false)}
              onCreated={() => {
                setShowInvoiceModal(false);
                fetchData();
              }}
            />
          </div>
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Invoice List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                View, filter, print and cancel invoices.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <input
                type="text"
                placeholder="Search invoice/customer/branch/status"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="input"
              />

              <CustomDropdown
                value={invoiceStatusFilter}
                onChange={setInvoiceStatusFilter}
                icon={<Filter size={16} />}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "draft", label: "Draft" },
                  { value: "sent", label: "Sent" },
                  { value: "partial", label: "Partial" },
                  { value: "paid", label: "Paid" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />

              <CustomDropdown
                value={invoiceBranchFilter}
                onChange={setInvoiceBranchFilter}
                icon={<Building2 size={16} />}
                options={[
                  { value: "all", label: "All Branches" },
                  ...activeBranches.map((branch) => ({
                    value: String(branch.id),
                    label: branch.branch_name,
                  })),
                ]}
              />

              <input
                type="date"
                value={invoiceFromDate}
                onChange={(e) => setInvoiceFromDate(e.target.value)}
                className="input"
              />

              <input
                type="date"
                value={invoiceToDate}
                onChange={(e) => setInvoiceToDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  Invoice No
                </th>
                <th className="px-4 py-3 text-left font-semibold">Branch</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Total</th>
                <th className="px-4 py-3 text-left font-semibold">Paid</th>
                <th className="px-4 py-3 text-left font-semibold">Balance</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {invoice.invoice_number || "-"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {invoice.branch_name || "Main Company"}
                  </td>

                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {invoice.customer_name || "-"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatDate(invoice.invoice_date)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900 dark:text-white">
                    ₹ {Number(invoice.total_amount || 0).toFixed(2)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    ₹ {Number(invoice.paid_amount || 0).toFixed(2)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    ₹ {Number(invoice.balance_due || 0).toFixed(2)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/dashboard/invoices/${invoice.id}`)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                        title="View / Print Invoice"
                      >
                        <Eye size={16} />
                      </button>

                      {canCancel && invoice.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => handleCancel(invoice.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                          title="Cancel Invoice"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {sortedInvoices.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-10 text-center">
                    <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6">
                      <FileText className="mx-auto text-slate-400" size={34} />

                      <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                        No invoices found
                      </p>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Try changing search or filters.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white dark:bg-slate-900 p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Rows per page
              </span>

              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/50"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              {sortedInvoices.length === 0
                ? 0
                : (currentPage - 1) * itemsPerPage + 1}
              {" - "}
              {Math.min(currentPage * itemsPerPage, sortedInvoices.length)}
              {" of "}
              {sortedInvoices.length}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>

              <span className="text-sm font-semibold">
                {currentPage} / {totalPages || 1}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <Modal
          title="Add New Customer"
          description="Add customer details without leaving invoice page."
          icon={<Users size={21} />}
          onClose={() => setShowCustomerModal(false)}
        >
          <Section icon={<User size={17} />} title="Basic Customer Details">
            <Input
              icon={<User size={16} />}
              label="Customer Name"
              required
              name="customer_name"
              value={customerForm.customer_name}
              onChange={handleCustomerFormChange}
            />

            <Input
              icon={<Building2 size={16} />}
              label="Company Name"
              name="company_name"
              value={customerForm.company_name}
              onChange={handleCustomerFormChange}
            />

            <Field icon={<Building2 size={16} />} label="Branch">
              <BranchSelect
                branches={activeBranches}
                value={customerForm.branch_id}
                canAddBranch={canAddBranch}
                onChange={(value) => {
                  if (value === "__add_branch__") {
                    setBranchOpenSource("customer");
                    setShowBranchModal(true);
                    return;
                  }

                  handleCustomerFormChange({
                    target: { name: "branch_id", value },
                  });
                }}
              />
            </Field>

            <Field icon={<Users size={16} />} label="Customer Type">
              <CustomDropdown
                value={customerForm.customer_type}
                onChange={(value) =>
                  handleCustomerFormChange({
                    target: {
                      name: "customer_type",
                      value,
                    },
                  })
                }
                icon={<Users size={16} />}
                options={[
                  { value: "business", label: "Business" },
                  { value: "individual", label: "Individual" },
                ]}
              />
            </Field>

            <Input
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
                    target: {
                      name: "status",
                      value,
                    },
                  })
                }
                icon={<CheckCircle2 size={16} />}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </Field>
          </Section>

          <Section icon={<Mail size={17} />} title="Contact & Portal Access">
            <Input
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              value={customerForm.email}
              onChange={handleCustomerFormChange}
            />

            <Input
              icon={<Phone size={16} />}
              label="Phone"
              name="phone"
              value={customerForm.phone}
              onChange={handleCustomerFormChange}
            />
          </Section>

          <Section
            icon={<BadgePercent size={17} />}
            title="Tax & Billing Details"
          >
            <Input
              icon={<BadgePercent size={16} />}
              label="GSTIN"
              name="gstin"
              value={customerForm.gstin}
              onChange={handleCustomerFormChange}
            />

            <Field icon={<CreditCard size={16} />} label="Payment Terms">
              <CustomDropdown
                value={customerForm.payment_terms}
                onChange={(value) =>
                  handleCustomerFormChange({
                    target: {
                      name: "payment_terms",
                      value,
                    },
                  })
                }
                icon={<CreditCard size={16} />}
                options={[
                  { value: "Due on Receipt", label: "Due on Receipt" },
                  { value: "Net 7", label: "Net 7" },
                  { value: "Net 15", label: "Net 15" },
                  { value: "Net 30", label: "Net 30" },
                  { value: "Net 45", label: "Net 45" },
                  { value: "Net 60", label: "Net 60" },
                  { value: "Advance Payment", label: "Advance Payment" },
                  { value: "Partial Advance", label: "Partial Advance" },
                ]}
              />
            </Field>

            <Input
              icon={<Landmark size={16} />}
              label="Currency"
              name="currency"
              value={customerForm.currency}
              onChange={handleCustomerFormChange}
            />

            <Input
              icon={<Wallet size={16} />}
              label="Opening Balance"
              name="opening_balance"
              type="number"
              value={customerForm.opening_balance}
              onChange={handleCustomerFormChange}
            />

            <Input
              icon={<CreditCard size={16} />}
              label="Credit Limit"
              name="credit_limit"
              type="number"
              value={customerForm.credit_limit}
              onChange={handleCustomerFormChange}
            />
          </Section>

          <Section icon={<MapPin size={17} />} title="Address Details">
            <Input
              icon={<MapPin size={16} />}
              label="Billing Address"
              name="billing_address"
              value={customerForm.billing_address}
              onChange={handleCustomerFormChange}
            />

            <Input
              icon={<MapPin size={16} />}
              label="Shipping Address"
              name="shipping_address"
              value={customerForm.shipping_address}
              onChange={handleCustomerFormChange}
            />
          </Section>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Notes
            </label>
            <textarea
              name="notes"
              value={customerForm.notes}
              onChange={handleCustomerFormChange}
              className="input"
              rows="3"
            />
          </div>

          <ModalActions
            onSave={handleCreateCustomer}
            onCancel={() => setShowCustomerModal(false)}
            saveText="Save Customer"
          />
        </Modal>
      )}

      {showProductModal && (
        <Modal
          title="Add New Product"
          description="Add product with image without leaving invoice page."
          icon={<Package size={21} />}
          onClose={() => {
            resetProductForm();
            setShowProductModal(false);
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input
              icon={<Package size={16} />}
              label="Product Name"
              name="product_name"
              value={productForm.product_name}
              onChange={handleProductFormChange}
              required
            />

            <Input
              icon={<Barcode size={16} />}
              label="SKU"
              name="sku"
              value={productForm.sku}
              onChange={handleProductFormChange}
            />

            <Input
              icon={<FileText size={16} />}
              label="HSN/SAC Code"
              name="hsn_sac_code"
              value={productForm.hsn_sac_code}
              onChange={handleProductFormChange}
            />

            <Input
              icon={<IndianRupee size={16} />}
              label="Unit Price"
              name="unit_price"
              type="number"
              value={productForm.unit_price}
              onChange={handleProductFormChange}
              required
            />

            <Input
              icon={<Percent size={16} />}
              label="GST %"
              name="tax_rate"
              type="number"
              value={productForm.tax_rate}
              onChange={handleProductFormChange}
            />

            <Input
              icon={<Boxes size={16} />}
              label="Quantity"
              name="quantity"
              type="number"
              value={productForm.quantity}
              onChange={handleProductFormChange}
            />

            <Field icon={<Tag size={16} />} label="Unit Type">
              <CustomDropdown
                value={productForm.unit_type}
                onChange={(value) =>
                  handleProductFormChange({
                    target: {
                      name: "unit_type",
                      value,
                    },
                  })
                }
                icon={<Tag size={16} />}
                options={[
                  { value: "pcs", label: "Pcs" },
                  { value: "kg", label: "Kg" },
                  { value: "ltr", label: "Ltr" },
                  { value: "box", label: "Box" },
                  { value: "service", label: "Service" },
                ]}
              />
            </Field>

            <Input
              icon={<Tag size={16} />}
              label="Category"
              name="category"
              value={productForm.category}
              onChange={handleProductFormChange}
            />

            <Field icon={<Building2 size={16} />} label="Branch">
              <BranchSelect
                branches={activeBranches}
                value={productForm.branch_id}
                canAddBranch={canAddBranch}
                onChange={(value) => {
                  if (value === "__add_branch__") {
                    setBranchOpenSource("product");
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

              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
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
                    onChange={(e) =>
                      setProductImageFile(e.target.files?.[0] || null)
                    }
                    className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Upload PNG, JPG or WebP image.
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <FileText size={16} />
                Description
              </label>
              <textarea
                name="description"
                value={productForm.description}
                onChange={handleProductFormChange}
                rows="3"
                className="input"
              />
            </div>
          </div>

          <ModalActions
            onSave={handleCreateProduct}
            onCancel={() => {
              resetProductForm();
              setShowProductModal(false);
            }}
            saveText="Save Product"
          />
        </Modal>
      )}

      {showBranchModal && (
        <Modal
          title="Add New Branch"
          description="Add branch details without leaving invoice page."
          icon={<GitBranch size={21} />}
          onClose={() => setShowBranchModal(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input
              icon={<Building2 size={16} />}
              label="Branch Name"
              name="branch_name"
              value={branchForm.branch_name}
              onChange={handleBranchFormChange}
              required
            />

            <Input
              icon={<Hash size={16} />}
              label="Branch Code"
              name="branch_code"
              value={branchForm.branch_code}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<Mail size={16} />}
              label="Email"
              name="email"
              type="email"
              value={branchForm.email}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<Phone size={16} />}
              label="Phone"
              name="phone"
              value={branchForm.phone}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<BadgePercent size={16} />}
              label="GST Number"
              name="gst_number"
              value={branchForm.gst_number}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<MapPin size={16} />}
              label="City"
              name="city"
              value={branchForm.city}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<MapPin size={16} />}
              label="State"
              name="state"
              value={branchForm.state}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<Globe size={16} />}
              label="Country"
              name="country"
              value={branchForm.country}
              onChange={handleBranchFormChange}
            />

            <Input
              icon={<Hash size={16} />}
              label="ZIP Code"
              name="zip_code"
              value={branchForm.zip_code}
              onChange={handleBranchFormChange}
            />

            <Field icon={<CheckCircle2 size={16} />} label="Status">
              <CustomDropdown
                value={branchForm.status}
                onChange={(value) =>
                  handleBranchFormChange({
                    target: {
                      name: "status",
                      value,
                    },
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
                <MapPin size={16} />
                Address
              </label>
              <textarea
                name="address"
                value={branchForm.address}
                onChange={handleBranchFormChange}
                rows="3"
                className="input"
              />
            </div>
          </div>

          <ModalActions
            onSave={handleCreateBranch}
            onCancel={() => setShowBranchModal(false)}
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
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
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

        .input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        .dark .input:disabled {
          background: #1e293b;
        }
      `}</style>
    </div>
  );
}

function Modal({ title, description, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              {icon || <FileText size={21} />}
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onSave, onCancel, saveText }) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <X size={16} />
        Cancel
      </button>

      <button
        type="button"
        onClick={onSave}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Save size={16} />
        {saveText}
      </button>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
      <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function Input({
  icon,
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  helper = "",
  required = false,
  min,
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
        placeholder={placeholder}
        value={value || ""}
        onChange={onChange}
        min={min}
        className="input"
      />

      {helper && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      )}
    </div>
  );
}

function Field({ icon, label, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function AmountBox({ title, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {title === "Taxable" ? (
          <IndianRupee size={13} />
        ) : (
          <Percent size={13} />
        )}
        {title}
      </p>
      <p className="mt-1 break-words font-bold text-slate-900 dark:text-white">
        ₹ {Number(value || 0).toFixed(2)}
      </p>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-right font-semibold text-slate-900 dark:text-white">
        ₹ {Number(value || 0).toFixed(2)}
      </span>
    </div>
  );
}

function BranchSelect({ branches, value, canAddBranch = false, onChange }) {
  const branchOptions = [
    ...branches.map((branch) => ({
      value: String(branch.id),
      title: branch.branch_name || "Unnamed Branch",
      subtitle: branch.branch_code
        ? `Code: ${branch.branch_code}`
        : "No branch code",
    })),
  ];

  return (
    <SearchableDropdown
      value={value}
      placeholder="Main Company"
      searchPlaceholder="Search branch..."
      emptyText="No branch found"
      options={branchOptions}
      addAction={
        canAddBranch
          ? {
              label: "Add New Branch",
              value: "__add_branch__",
            }
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
          ? {
              label: "Add New Customer",
              value: "__add_customer__",
            }
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
          ? {
              label: "Add New Product",
              value: "__add_product__",
            }
          : null
      }
      onChange={onChange}
    />
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
  const [dropdownStyle, setDropdownStyle] = useState({});

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const filteredOptions = options.filter((option) =>
    `${option.title || ""} ${option.subtitle || ""}`
      .toLowerCase()
      .includes(keyword.trim().toLowerCase()),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 330;
    const shouldOpenUp =
      spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      maxHeight: dropdownHeight,
      zIndex: 30000,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    const handleClickOutside = (event) => {
      if (
        buttonRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpen(false);
      setKeyword("");
    };

    const handleScroll = (event) => {
      if (dropdownRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
      setKeyword("");
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setKeyword("");
  };

  return (
    <>
      <button
        ref={buttonRef}
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
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search invoice"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              className="input !pl-10"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full rounded-xl px-3 py-2 text-left transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                  String(value || "") === String(option.value)
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
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                <Plus size={16} />
                {addAction.label}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    const closeDropdown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeDropdown);
    return () => document.removeEventListener("mousedown", closeDropdown);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 dark:text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                String(value) === String(option.value)
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="truncate">{option.label}</span>

              {String(value) === String(option.value) && (
                <CheckCircle2 size={16} className="shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const badgeStyles = {
    draft:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",

    generated:
      "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",

    sent: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",

    viewed:
      "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",

    partial:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",

    paid: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",

    overdue:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",

    cancelled:
      "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ${
        badgeStyles[status] ||
        "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
      }`}
    >
      {status || "draft"}
    </span>
  );
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default Invoices;
