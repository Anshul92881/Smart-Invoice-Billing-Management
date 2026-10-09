import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  FileText,
  Plus,
  Trash2,
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
  Mail,
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

function CreateInvoice({ modalMode = false, onClose, onCreated }) {
  const user = JSON.parse(localStorage.getItem("user"));

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);

  const [rolePermissions, setRolePermissions] = useState({});
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [branchOpenSource, setBranchOpenSource] = useState("invoice");
  const [productItemIndex, setProductItemIndex] = useState(null);
  const [productImageFile, setProductImageFile] = useState(null);
  const productImageInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);

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

  const initialForm = {
    customer_id: "",
    branch_id: "",
    invoice_date: getToday(),
    due_date: "",
    notes: "",
    items: [
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
  };

  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [formData, setFormData] = useState(initialForm);

  const canCreate = ["company_admin", "accountant", "sales_user"].includes(
    user?.role,
  );

  const canAddBranch =
    user?.role === "company_admin" ||
    Boolean(rolePermissions?.[user?.role]?.branches);

  const canAddProduct =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    Boolean(rolePermissions?.[user?.role]?.products);

  const canAddCustomer =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    Boolean(rolePermissions?.[user?.role]?.customers);

  const getList = (data, key) => {
    if (Array.isArray(data)) return data;
    return data?.[key] || [];
  };

  const fetchDropdownData = async () => {
    try {
      const [customerRes, productRes, branchRes] = await Promise.all([
        api.get("/customers/dropdown"),
        api.get("/products/dropdown").catch(() => api.get("/products")),
        api.get("/branches/dropdown").catch(() => api.get("/branches")),
      ]);

      setCustomers(getList(customerRes.data, "customers"));
      setProducts(getList(productRes.data, "products"));
      setBranches(getList(branchRes.data, "branches"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load data");
    }
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
    fetchDropdownData();
  }, []);

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
      (branch) =>
        branch.is_main === 1 ||
        branch.is_main === true ||
        String(branch.is_main) === "1" ||
        branch.branch_name?.toLowerCase() === "head office",
    );

    if (!hqBranch || formData.branch_id) return;

    setFormData((prev) => ({
      ...prev,
      branch_id: String(hqBranch.id),
    }));

    setCustomerForm((prev) => ({
      ...prev,
      branch_id: String(hqBranch.id),
    }));

    setProductForm((prev) => ({
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

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "branch_id") {
      setFormData((prev) => ({
        ...prev,
        branch_id: value,
        customer_id: "",
        items: [
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

  const resetBranchForm = () => setBranchForm(initialBranchForm);

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

  const resetForm = () => {
    setFormData(initialForm);
    resetBranchForm();
    resetCustomerForm();
    resetProductForm();
    setShowBranchModal(false);
    setShowCustomerModal(false);
    setShowProductModal(false);
  };

  const handleClose = () => {
    if (submittingRef.current) return;
    resetForm();
    submittedRef.current = false;
    onClose?.();
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
    const status = cleanString(branchForm.status).toLowerCase();

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

    if (!branchCode) {
      toast.error("Branch code is required");
      return false;
    }

    if (!BRANCH_CODE_REGEX.test(branchCode)) {
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

    if (!["active", "inactive"].includes(status)) {
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
        newBranch?.branch_id ||
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
            items: [
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
        newCustomer?.customer_id ||
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
        (product) => Number(product.id) === Number(value),
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

    // Ref blocks rapid repeated clicks before React re-renders.
    if (submittingRef.current || submittedRef.current) return;
    if (!validateInvoiceForm()) return;

    submittingRef.current = true;
    setSaving(true);

    try {
      await api.post("/invoices", buildInvoicePayload());
      submittedRef.current = true;
      toast.success("Invoice created successfully");
      resetForm();
      onCreated?.();
    } catch (error) {
      if (!submittedRef.current) {
        toast.error(error.response?.data?.message || "Invoice create failed");
      } else {
        console.error("Invoice created, but post-save action failed:", error);
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const content = (
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
              Invoice Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Invoice
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create GST invoice with inline branch, customer and product
              creation.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title={modalMode ? "Close" : "Cancel"}
          >
            <X size={16} />
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
                branches={activeBranches}
                value={formData.branch_id}
                canAddBranch={canAddBranch}
                onChange={(value) => {
                  if (value === "__add_branch__") {
                    setBranchOpenSource("invoice");
                    setShowBranchModal(true);
                    return;
                  }

                  handleChange({
                    target: {
                      name: "branch_id",
                      value,
                    },
                  });
                }}
              />
            </Field>

            <Field icon={<User size={16} />} label="Customer">
              <CustomerSelect
                customers={filteredCustomers}
                value={formData.customer_id}
                canAddCustomer={canAddCustomer}
                onChange={(value) => {
                  if (value === "__add_customer__") {
                    setCustomerForm({
                      ...initialCustomerForm,
                      branch_id: formData.branch_id || "",
                    });
                    setShowCustomerModal(true);
                    return;
                  }

                  handleChange({
                    target: {
                      name: "customer_id",
                      value,
                    },
                  });
                }}
              />
            </Field>

            <Input
              icon={<CalendarDays size={16} />}
              label="Invoice Date"
              name="invoice_date"
              type="date"
              value={formData.invoice_date}
              onChange={handleChange}
            />

            <Input
              icon={<CalendarDays size={16} />}
              label="Due Date"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={handleChange}
              min={formData.invoice_date || getToday()}
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
                Select product or create new product from this invoice page.
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
            {formData.items.map((item, index) => {
              const itemTotals = calculateItem(item);

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
                        canAddProduct={canAddProduct}
                        onChange={(value) =>
                          handleItemChange(index, "product_id", value)
                        }
                      />
                    </Field>

                    <Input
                      label="Description"
                      name="description"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                    />

                    <Input
                      label="HSN/SAC"
                      name="hsn_sac_code"
                      value={item.hsn_sac_code}
                      onChange={(e) =>
                        handleItemChange(index, "hsn_sac_code", e.target.value)
                      }
                    />

                    <Input
                      label="Qty"
                      type="number"
                      name="quantity"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                    />

                    <Input
                      label="Price"
                      type="number"
                      name="price"
                      value={item.price}
                      onChange={(e) =>
                        handleItemChange(index, "price", e.target.value)
                      }
                    />

                    <Input
                      label="Tax %"
                      type="number"
                      name="tax_rate"
                      value={item.tax_rate}
                      onChange={(e) =>
                        handleItemChange(index, "tax_rate", e.target.value)
                      }
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    <AmountBox title="Taxable" value={itemTotals.taxable} />
                    <AmountBox title="CGST" value={itemTotals.cgst} />
                    <AmountBox title="SGST" value={itemTotals.sgst} />
                    <AmountBox title="IGST" value={itemTotals.igst} />
                    <AmountBox title="Line Total" value={itemTotals.total} />
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
                Notes
              </h2>
            </div>

            <Field icon={<StickyNote size={16} />} label="Notes">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                className="input"
                placeholder="Invoice notes"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Invoice Summary
            </h2>

            <div className="mt-4 space-y-3">
              <TotalRow label="Subtotal" value={totals.subtotal} />
              <TotalRow label="CGST" value={totals.cgst} />
              <TotalRow label="SGST" value={totals.sgst} />
              <TotalRow label="IGST" value={totals.igst} />
              <TotalRow label="Total GST" value={totals.tax} />

              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    Grand Total
                  </span>
                  <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    ₹ {Number(totals.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || submittedRef.current}
              aria-busy={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {saving
                ? "Saving..."
                : submittedRef.current
                  ? "Invoice Saved"
                  : "Save Invoice"}
            </button>
          </div>
        </div>
      </form>

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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
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

              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
              required
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

  return content;
}

function Modal({ title, description, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
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
    <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
    <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
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
        value={value ?? ""}
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
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
    const closeDropdown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
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

export default CreateInvoice;
