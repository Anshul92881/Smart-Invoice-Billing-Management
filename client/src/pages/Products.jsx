import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
  const APP_URL = import.meta.env.APP_URL;

import {
  Package,
  Barcode,
  FileText,
  IndianRupee,
  Percent,
  Boxes,
  Tag,
  Pencil,
  Trash2,
  Search,
  X,
  Image,
  Building2,
  Eye,
  Phone,
  BadgePercent,
  MapPin,
  Plus,
  Save,
  Filter,
  CheckCircle2,
  XCircle,
  GitBranch,
  Hash,
  Globe,
  ChevronDown,
  Mail,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ZIP_REGEX = /^\d{5,6}$/;
const PRODUCT_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),/_-]+$/;
const SKU_REGEX = /^[a-zA-Z0-9_-]{2,50}$/;
const HSN_SAC_REGEX = /^[0-9]{4,8}$/;
const BRANCH_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
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

const normalizeEmail = (email) => cleanString(email).toLowerCase();
const normalizeUpper = (value) => cleanString(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const isOnlyNumbers = (value) => /^[0-9]+$/.test(String(value || "").trim());

function Products() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [rolePermissions, setRolePermissions] = useState({});

  const initialForm = {
    branch_id: "",
    product_name: "",
    sku: "",
    hsn_sac_code: "",
    description: "",
    unit_price: "",
    tax_id: "",
    tax_rate: "",
    quantity: "",
    unit_type: "pcs",
    category: "",
    status: "active",
  };

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

  const initialTaxForm = {
    tax_name: "",
    tax_type: "GST",
    hsn_sac_code: "",
    tax_percentage: "",
    reverse_charge: false,
    is_active: true,
    description: "",
  };

  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [branches, setBranches] = useState([]);

  const getDefaultBranchId = useCallback(() => {
    const hqBranch = branches.find(
      (branch) => branch.is_main === 1 || branch.is_main === true,
    );

    return hqBranch?.id ? String(hqBranch.id) : "";
  }, [branches]);

  const [formData, setFormData] = useState(initialForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [taxForm, setTaxForm] = useState(initialTaxForm);

  const [errors, setErrors] = useState({});
  const [branchErrors, setBranchErrors] = useState({});
  const [taxErrors, setTaxErrors] = useState({});

  useEffect(() => {
    const defaultBranchId = getDefaultBranchId();

    if (!defaultBranchId || formData.branch_id) return;

    setFormData((prev) => ({
      ...prev,
      branch_id: defaultBranchId,
    }));
  }, [getDefaultBranchId, formData.branch_id]);

  const [editId, setEditId] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxLoading, setTaxLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [imageFile, setImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const BASE_ROLE_PERMISSIONS = {
    company_admin: "all",

    accountant: {
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

    return Boolean(rolePermissions?.[user?.role]?.[key]);
  };

  const canManageProducts =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    hasPermission("products") ||
    Boolean(user?.permissions?.products);

  const canManageBranches =
    user?.role === "company_admin" || Boolean(user?.permissions?.branches);

  const canManageTaxes =
    user?.role === "company_admin" ||
    hasPermission("taxes") ||
    Boolean(user?.permissions?.taxes);

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



  const getImageUrl = (image) => {
    if (!image) return "";
    if (image.startsWith("http")) return image;
    if (image.startsWith("/upload")) return `${APP_URL}/${image}`;
    return `${APP_URL}/upload/product-images/${image}`;
  };

  const fetchData = async () => {
    try {
      const taxEndpoint =
        user?.role === "sales_user" ? "/taxes/dropdown" : "/taxes";

      const [productRes, taxRes, branchRes] = await Promise.all([
        api.get("/products", {
          params: {
            search: search.trim() || undefined,
            status: statusFilter,
            limit: 1000,
          },
        }),
        api.get(taxEndpoint),
        api.get("/branches/dropdown", {
          params: {
            status: "active",
            limit: 1000,
          },
        }),
      ]);

      const productList = Array.isArray(productRes.data)
        ? productRes.data
        : productRes.data?.products || [];

      const taxList = Array.isArray(taxRes.data)
        ? taxRes.data
        : taxRes.data?.taxes || [];

      const branchList = Array.isArray(branchRes.data)
        ? branchRes.data
        : branchRes.data?.branches || [];

      setProducts(productList);

      setTaxes(taxList.filter((tax) => Number(tax.is_active) === 1));

      setBranches(
        branchList.filter(
          (branch) => branch.status === "active" || branch.status === 1,
        ),
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch products");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))];
  }, [products]);

  const stats = useMemo(() => {
    const active = products.filter(
      (p) => (p.status || "active") === "active",
    ).length;

    const inactive = products.length - active;

    const lowStock = products.filter(
      (p) => Number(p.quantity || 0) <= 5,
    ).length;

    return {
      total: products.length,
      active,
      inactive,
      lowStock,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return products.filter((product) => {
      const status = product.status || "active";

      const matchesSearch =
        !keyword ||
        product.product_name?.toLowerCase().includes(keyword) ||
        product.sku?.toLowerCase().includes(keyword) ||
        product.hsn_sac_code?.toLowerCase().includes(keyword) ||
        product.category?.toLowerCase().includes(keyword) ||
        product.branch_name?.toLowerCase().includes(keyword) ||
        product.branch_code?.toLowerCase().includes(keyword) ||
        product.tax_name?.toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesBranch =
        branchFilter === "all" ||
        String(product.branch_id || "") === String(branchFilter);

      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesBranch && matchesCategory;
    });
  }, [products, search, statusFilter, branchFilter, categoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, branchFilter, categoryFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => b.id - a.id);
  }, [filteredProducts]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;

    return sortedProducts.slice(start, start + itemsPerPage);
  }, [sortedProducts, currentPage, itemsPerPage]);

  const getSelectedTax = (taxId) => {
    return taxes.find((tax) => Number(tax.id) === Number(taxId));
  };

  const validateProductForm = () => {
    const nextErrors = {};

    const productName = cleanString(formData.product_name);
    const sku = normalizeUpper(formData.sku);
    const hsnSac = cleanString(formData.hsn_sac_code);
    const unitPrice = toNumber(formData.unit_price);
    const taxRate = toNumber(formData.tax_rate);
    const quantity = toNumber(formData.quantity);
    const unitType = cleanString(formData.unit_type).toLowerCase();
    const category = cleanString(formData.category);
    const description = cleanString(formData.description);
    const status = cleanString(formData.status).toLowerCase();

    if (!productName) {
      nextErrors.product_name = "Product name is required";
    } else if (productName.length < 2 || productName.length > 120) {
      nextErrors.product_name =
        "Product name must be between 2 and 120 characters";
    } else if (isOnlyNumbers(productName)) {
      nextErrors.product_name = "Product name cannot contain only numbers";
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
      nextErrors.unit_price = "Unit price must be a valid number";
    } else if (unitPrice <= 0) {
      nextErrors.unit_price = "Unit price must be greater than 0";
    }

    if (Number.isNaN(taxRate)) {
      nextErrors.tax_rate = "Tax rate must be a valid number";
    } else if (taxRate < 0 || taxRate > 100) {
      nextErrors.tax_rate = "Tax rate must be between 0 and 100";
    }

    if (Number.isNaN(quantity)) {
      nextErrors.quantity = "Quantity must be a valid number";
    } else if (quantity < 0) {
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

    if (!["active", "inactive"].includes(status)) {
      nextErrors.status = "Status must be active or inactive";
    }

    if (imageFile) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(imageFile.type)) {
        nextErrors.image = "Only JPG, PNG or WEBP product images are allowed";
      } else if (imageFile.size > 2 * 1024 * 1024) {
        nextErrors.image = "Product image size must be less than 2MB";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
    } else if (!BRANCH_NAME_REGEX.test(branchName)) {
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

  const validateTaxForm = () => {
    const nextErrors = {};

    const taxName = cleanString(taxForm.tax_name);
    const taxType = cleanString(taxForm.tax_type);
    const hsnSac = normalizeUpper(taxForm.hsn_sac_code);
    const taxPercentage = toNumber(taxForm.tax_percentage, NaN);
    const description = cleanString(taxForm.description);

    if (!taxName) {
      nextErrors.tax_name = "Tax name is required";
    } else if (taxName.length < 2 || taxName.length > 100) {
      nextErrors.tax_name = "Tax name must be between 2 and 100 characters";
    } else if (!PRODUCT_NAME_REGEX.test(taxName)) {
      nextErrors.tax_name = "Tax name contains invalid characters";
    }

    if (
      !["GST", "CGST_SGST", "IGST", "TDS", "TCS", "OTHER"].includes(taxType)
    ) {
      nextErrors.tax_type = "Valid tax type is required";
    }

    if (Number.isNaN(taxPercentage)) {
      nextErrors.tax_percentage = "Tax percentage must be a valid number";
    } else if (taxPercentage < 0 || taxPercentage > 100) {
      nextErrors.tax_percentage = "Tax percentage must be between 0 and 100";
    }

    if (hsnSac && !HSN_SAC_REGEX.test(hsnSac)) {
      nextErrors.hsn_sac_code = "HSN/SAC code must be 4 to 8 digits";
    }

    if (description && description.length > 500) {
      nextErrors.description = "Description must be less than 500 characters";
    }

    setTaxErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "branch_id" && value === "__add_branch__") {
      if (!canManageBranches) {
        toast.error("Branch permission required");
        return;
      }

      setShowBranchModal(true);
      return;
    }

    if (name === "tax_id") {
      if (value === "__add_tax__") {
        if (!canManageTaxes) {
          toast.error("Tax permission required");
          return;
        }

        setShowTaxModal(true);
        return;
      }

      const selectedTax = getSelectedTax(value);

      setFormData((prev) => ({
        ...prev,
        tax_id: value,
        tax_rate: selectedTax?.tax_percentage || "",
        hsn_sac_code: selectedTax?.hsn_sac_code || prev.hsn_sac_code,
      }));

      if (errors.tax_id || errors.tax_rate || errors.hsn_sac_code) {
        setErrors((prev) => ({
          ...prev,
          tax_id: "",
          tax_rate: "",
          hsn_sac_code: "",
        }));
      }

      return;
    }

    let nextValue = value;

    if (name === "sku") {
      nextValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [name]: nextValue }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleBranchChange = (e) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "branch_code" || name === "gst_number") {
      nextValue = value.toUpperCase();
    }

    setBranchForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (branchErrors[name]) {
      setBranchErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleTaxChange = (e) => {
    const { name, value, type, checked } = e.target;

    let nextValue = type === "checkbox" ? checked : value;

    if (name === "hsn_sac_code") {
      nextValue = normalizeUpper(value);
    }

    setTaxForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (taxErrors[name]) {
      setTaxErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const resetTaxForm = () => {
    setTaxForm(initialTaxForm);
    setTaxErrors({});
  };

  const getTaxSplitPayload = () => {
    const taxType = cleanString(taxForm.tax_type) || "GST";
    const taxPercentage = Number(taxForm.tax_percentage || 0);

    if (taxType === "GST" || taxType === "CGST_SGST") {
      return {
        cgst_percentage: taxPercentage / 2,
        sgst_percentage: taxPercentage / 2,
        igst_percentage: 0,
        tds_percentage: 0,
        tcs_percentage: 0,
      };
    }

    if (taxType === "IGST") {
      return {
        cgst_percentage: 0,
        sgst_percentage: 0,
        igst_percentage: taxPercentage,
        tds_percentage: 0,
        tcs_percentage: 0,
      };
    }

    if (taxType === "TDS") {
      return {
        cgst_percentage: 0,
        sgst_percentage: 0,
        igst_percentage: 0,
        tds_percentage: taxPercentage,
        tcs_percentage: 0,
      };
    }

    if (taxType === "TCS") {
      return {
        cgst_percentage: 0,
        sgst_percentage: 0,
        igst_percentage: 0,
        tds_percentage: 0,
        tcs_percentage: taxPercentage,
      };
    }

    return {
      cgst_percentage: 0,
      sgst_percentage: 0,
      igst_percentage: 0,
      tds_percentage: 0,
      tcs_percentage: 0,
    };
  };

  const handleCreateTax = async () => {
    if (!canManageTaxes) {
      toast.error("Tax permission required");
      return;
    }

    if (!validateTaxForm()) return;

    try {
      setTaxLoading(true);

      const payload = {
        tax_name: cleanString(taxForm.tax_name),
        tax_type: cleanString(taxForm.tax_type) || "GST",
        hsn_sac_code: normalizeUpper(taxForm.hsn_sac_code),
        tax_percentage: Number(taxForm.tax_percentage || 0),
        ...getTaxSplitPayload(),
        reverse_charge: Boolean(taxForm.reverse_charge),
        is_active: Boolean(taxForm.is_active),
        description: cleanString(taxForm.description),
      };

      const res = await api.post("/taxes", payload);
      const newTax = res.data?.tax || res.data;

      const taxRes = await api.get(
        user?.role === "sales_user" ? "/taxes/dropdown" : "/taxes",
        {
          params: {
            status: "active",
            limit: 1000,
          },
        },
      );

      const taxList = Array.isArray(taxRes.data)
        ? taxRes.data
        : taxRes.data?.taxes || [];

      const updatedTaxes = taxList.filter((tax) => Number(tax.is_active) === 1);
      setTaxes(updatedTaxes);

      const selectedTaxId =
        newTax?.id ||
        newTax?.tax_id ||
        updatedTaxes.find(
          (tax) =>
            tax.tax_name?.toLowerCase() === payload.tax_name.toLowerCase(),
        )?.id;

      const selectedTax =
        updatedTaxes.find((tax) => String(tax.id) === String(selectedTaxId)) ||
        newTax;

      if (selectedTaxId) {
        setFormData((prev) => ({
          ...prev,
          tax_id: String(selectedTaxId),
          tax_rate: selectedTax?.tax_percentage || payload.tax_percentage,
          hsn_sac_code: selectedTax?.hsn_sac_code || prev.hsn_sac_code,
        }));
      }

      resetTaxForm();
      setShowTaxModal(false);
      toast.success("Tax rule added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Tax create failed");
    } finally {
      setTaxLoading(false);
    }
  };

  const resetBranchForm = () => {
    setBranchForm(initialBranchForm);
    setBranchErrors({});
  };

  const handleCreateBranch = async () => {
    if (!canManageBranches) {
      toast.error("Branch permission required");
      return;
    }

    if (!validateBranchForm()) return;

    try {
      setBranchLoading(true);

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

      const branchRes = await api.get("/branches/dropdown", {
        params: {
          status: "active",
          limit: 1000,
        },
      });

      const branchList = Array.isArray(branchRes.data)
        ? branchRes.data
        : branchRes.data?.branches || [];

      const updatedBranches = branchList.filter(
        (branch) => branch.status !== "inactive",
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
      }

      resetBranchForm();
      setShowBranchModal(false);
      toast.success("Branch added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Branch create failed");
    } finally {
      setBranchLoading(false);
    }
  };

  const uploadImage = async (productId) => {
    if (!imageFile || !productId) return;

    const data = new FormData();
    data.append("image", imageFile);

    await api.post(`/products/${productId}/image`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const resetForm = () => {
    setFormData({
      ...initialForm,
      branch_id: getDefaultBranchId(),
    });
    setErrors({});
    setEditId(null);
    setImageFile(null);
    setPreviewImage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCreateModal = () => {
    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (product) => {
    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    setEditId(product.id);
    setErrors({});

    setFormData({
      branch_id: product.branch_id ? String(product.branch_id) : "",
      product_name: product.product_name || "",
      sku: product.sku || "",
      hsn_sac_code: product.hsn_sac_code || "",
      description: product.description || "",
      unit_price:
        product.unit_price === null || product.unit_price === undefined
          ? ""
          : String(product.unit_price),
      tax_id: product.tax_id ? String(product.tax_id) : "",
      tax_rate:
        product.tax_rate === null || product.tax_rate === undefined
          ? ""
          : String(product.tax_rate),
      quantity:
        product.quantity === null || product.quantity === undefined
          ? ""
          : String(product.quantity),
      unit_type: product.unit_type || "pcs",
      category: product.category || "",
      status: product.status || "active",
    });

    setImageFile(null);
    setPreviewImage(product.image || "");
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };

  const buildProductPayload = () => ({
    branch_id: formData.branch_id || "",
    product_name: cleanString(formData.product_name),
    sku: normalizeUpper(formData.sku),
    hsn_sac_code: cleanString(formData.hsn_sac_code),
    description: cleanString(formData.description),
    unit_price: formData.unit_price === "" ? 0 : Number(formData.unit_price),
    tax_id: formData.tax_id || "",
    tax_rate: formData.tax_rate === "" ? 0 : Number(formData.tax_rate),
    quantity: formData.quantity === "" ? 0 : Number(formData.quantity),
    unit_type: cleanString(formData.unit_type).toLowerCase() || "pcs",
    category: cleanString(formData.category),
    status: cleanString(formData.status).toLowerCase() || "active",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    if (!validateProductForm()) return;

    try {
      setSaving(true);

      const payload = buildProductPayload();

      if (editId) {
        await api.put(`/products/${editId}`, payload);
        await uploadImage(editId);
        toast.success("Product updated successfully");
      } else {
        const res = await api.post("/products", payload);
        const productId =
          res.data?.product?.id || res.data?.product_id || res.data?.id;

        if (imageFile && productId) {
          await uploadImage(productId);
        }

        toast.success("Product added successfully");
      }

      closeFormModal();
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Product save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    if ((product.status || "active") === "inactive") {
      toast.error("Product already inactive");
      return;
    }

    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Deactivate this product?
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {product.product_name || "Selected product"} will become inactive.
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);

                try {
                  await api.delete(`/products/${product.id}`);
                  toast.success("Product deactivated successfully");
                  fetchData();
                } catch (error) {
                  toast.error(error.response?.data?.message || "Delete failed");
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
  };

  const taxableValue =
    Number(formData.unit_price || 0) * Number(formData.quantity || 0);

  const taxAmount = (taxableValue * Number(formData.tax_rate || 0)) / 100;
  const finalValue = taxableValue + taxAmount;

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Package size={17} />
              Product Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Products
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage products, GST rules, HSN/SAC, pricing, images and stock.
            </p>
          </div>

          {canManageProducts && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={17} />
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Products"
          value={stats.total}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          icon={<Package size={20} />}
        />

        <StatsCard
          title="Active Products"
          value={stats.active}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          icon={<CheckCircle2 size={20} />}
        />

        <StatsCard
          title="Inactive Products"
          value={stats.inactive}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          icon={<XCircle size={20} />}
        />

        <StatsCard
          title="Low Stock"
          value={stats.lowStock}
          color="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
          icon={<Boxes size={20} />}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Product List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Search, filter, view and manage products.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Search product"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>

              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                icon={<Filter size={16} />}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />

              <CustomDropdown
                value={branchFilter}
                onChange={setBranchFilter}
                icon={<Building2 size={16} />}
                options={[
                  { value: "all", label: "All Branches" },
                  ...branches.map((branch) => ({
                    value: String(branch.id),
                    label: branch.branch_code
                      ? `${branch.branch_name} (${branch.branch_code})`
                      : branch.branch_name,
                  })),
                ]}
              />

              <CustomDropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                icon={<Tag size={16} />}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories.map((category) => ({
                    value: category,
                    label: category,
                  })),
                ]}
              />
            </div>
          </div>
        </div>

        <ProductTable
          products={paginatedProducts}
          canManage={canManageProducts}
          getImageUrl={getImageUrl}
          onView={setViewProduct}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            {sortedProducts.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedProducts.length)}
            {" of "}
            {sortedProducts.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>

            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {currentPage} / {totalPages || 1}
            </span>

            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showFormModal && (
        <FormModal
          title={editId ? "Update Product" : "Add Product"}
          description="Fill product details, image, GST mapping and stock information."
          icon={<Package size={22} />}
          onClose={closeFormModal}
        >
          <ProductForm
            formData={formData}
            errors={errors}
            taxes={taxes}
            branches={branches}
            editId={editId}
            imageFile={imageFile}
            previewImage={previewImage}
            fileInputRef={fileInputRef}
            saving={saving}
            taxableValue={taxableValue}
            taxAmount={taxAmount}
            finalValue={finalValue}
            canManageBranches={canManageBranches}
            canManageTaxes={canManageTaxes}
            getImageUrl={getImageUrl}
            handleChange={handleChange}
            setImageFile={(file) => {
              setImageFile(file);
              if (errors.image) {
                setErrors((prev) => ({ ...prev, image: "" }));
              }
            }}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {viewProduct && (
        <ProductViewModal
          product={viewProduct}
          getImageUrl={getImageUrl}
          onClose={() => setViewProduct(null)}
        />
      )}

      {showBranchModal && (
        <FormModal
          title="Add New Branch"
          description="Create branch without leaving product page."
          icon={<GitBranch size={22} />}
          onClose={() => {
            setShowBranchModal(false);
            resetBranchForm();
          }}
        >
          <BranchMiniForm
            branchForm={branchForm}
            branchErrors={branchErrors}
            handleBranchChange={handleBranchChange}
            handleCreateBranch={handleCreateBranch}
            branchLoading={branchLoading}
            onCancel={() => {
              setShowBranchModal(false);
              resetBranchForm();
            }}
          />
        </FormModal>
      )}

      {showTaxModal && (
        <FormModal
          title="Add New Tax Rule"
          description="Create GST / Tax rule without leaving product page."
          icon={<BadgePercent size={22} />}
          onClose={() => {
            setShowTaxModal(false);
            resetTaxForm();
          }}
        >
          <TaxMiniForm
            taxForm={taxForm}
            taxErrors={taxErrors}
            handleTaxChange={handleTaxChange}
            handleCreateTax={handleCreateTax}
            taxLoading={taxLoading}
            onCancel={() => {
              setShowTaxModal(false);
              resetTaxForm();
            }}
          />
        </FormModal>
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

        .dark .input-error {
          border-color: #f87171 !important;
        }

        .dark .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25) !important;
        }
      `}</style>
    </div>
  );
}

function TaxMiniForm({
  taxForm,
  taxErrors,
  handleTaxChange,
  handleCreateTax,
  taxLoading,
  onCancel,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModalInput
          icon={<BadgePercent size={16} />}
          label="Tax Name"
          name="tax_name"
          value={taxForm.tax_name}
          onChange={handleTaxChange}
          error={taxErrors.tax_name}
          required
        />

        <Field
          icon={<Percent size={16} />}
          label="Tax Type"
          error={taxErrors.tax_type}
        >
          <CustomDropdown
            value={taxForm.tax_type}
            onChange={(value) =>
              handleTaxChange({
                target: {
                  name: "tax_type",
                  value,
                },
              })
            }
            options={[
              { value: "GST", label: "GST" },
              { value: "CGST_SGST", label: "CGST + SGST" },
              { value: "IGST", label: "IGST" },
              { value: "TDS", label: "TDS" },
              { value: "TCS", label: "TCS" },
              { value: "OTHER", label: "Other" },
            ]}
          />
        </Field>

        <ModalInput
          icon={<Hash size={16} />}
          label="HSN / SAC Code"
          name="hsn_sac_code"
          value={taxForm.hsn_sac_code}
          onChange={handleTaxChange}
          error={taxErrors.hsn_sac_code}
        />

        <ModalInput
          icon={<Percent size={16} />}
          label="Tax Percentage"
          name="tax_percentage"
          type="number"
          value={taxForm.tax_percentage}
          onChange={handleTaxChange}
          error={taxErrors.tax_percentage}
          required
        />

        <Field icon={<CheckCircle2 size={16} />} label="Status">
          <CustomDropdown
            value={taxForm.is_active ? "active" : "inactive"}
            onChange={(value) =>
              handleTaxChange({
                target: {
                  name: "is_active",
                  type: "checkbox",
                  checked: value === "active",
                },
              })
            }
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>

        <label className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            name="reverse_charge"
            checked={Boolean(taxForm.reverse_charge)}
            onChange={handleTaxChange}
          />
          Reverse Charge
        </label>

        <div className="md:col-span-2 xl:col-span-3">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <FileText size={16} />
            Description
          </label>

          <textarea
            name="description"
            value={taxForm.description}
            onChange={handleTaxChange}
            rows="3"
            className={`input ${taxErrors.description ? "input-error" : ""}`}
          />

          {taxErrors.description && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
              {taxErrors.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateTax}
          disabled={taxLoading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          <Save size={16} />
          {taxLoading ? "Saving..." : "Save Tax Rule"}
        </button>
      </div>
    </>
  );
}

function BranchMiniForm({
  branchForm,
  branchErrors,
  handleBranchChange,
  handleCreateBranch,
  branchLoading,
  onCancel,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModalInput
          icon={<Building2 size={16} />}
          label="Branch Name"
          name="branch_name"
          value={branchForm.branch_name}
          onChange={handleBranchChange}
          error={branchErrors.branch_name}
          required
        />

        <ModalInput
          icon={<Hash size={16} />}
          label="Branch Code"
          name="branch_code"
          value={branchForm.branch_code}
          onChange={handleBranchChange}
          error={branchErrors.branch_code}
          required
        />

        <ModalInput
          icon={<Mail size={16} />}
          label="Email"
          name="email"
          type="email"
          value={branchForm.email}
          onChange={handleBranchChange}
          error={branchErrors.email}
        />

        <ModalInput
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={branchForm.phone}
          onChange={handleBranchChange}
          error={branchErrors.phone}
        />

        <ModalInput
          icon={<BadgePercent size={16} />}
          label="GST Number"
          name="gst_number"
          value={branchForm.gst_number}
          onChange={handleBranchChange}
          error={branchErrors.gst_number}
        />

        <ModalInput
          icon={<MapPin size={16} />}
          label="City"
          name="city"
          value={branchForm.city}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<MapPin size={16} />}
          label="State"
          name="state"
          value={branchForm.state}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<Globe size={16} />}
          label="Country"
          name="country"
          value={branchForm.country}
          onChange={handleBranchChange}
          error={branchErrors.country}
        />

        <ModalInput
          icon={<Hash size={16} />}
          label="ZIP Code"
          name="zip_code"
          value={branchForm.zip_code}
          onChange={handleBranchChange}
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
              handleBranchChange({
                target: {
                  name: "status",
                  value,
                },
              })
            }
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
            onChange={handleBranchChange}
            rows="3"
            className="input"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateBranch}
          disabled={branchLoading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          <Save size={16} />
          {branchLoading ? "Saving..." : "Save Branch"}
        </button>
      </div>
    </>
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
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
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

function ProductTable({
  products,
  canManage,
  getImageUrl,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1150px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            {[
              "Product",
              "Branch",
              "SKU",
              "HSN/SAC",
              "Price",
              "Tax Rule",
              "GST",
              "Stock",
              "Status",
              "Actions",
            ].map((head) => (
              <th
                key={head}
                className="p-4 text-left text-xs font-bold uppercase tracking-wide"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    {product.image ? (
                      <img
                        src={getImageUrl(product.image)}
                        alt={product.product_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image size={20} className="text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">
                      {product.product_name || "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {product.category || "No Category"}
                    </p>
                  </div>
                </div>
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {product.branch_name || "-"}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {product.sku || "-"}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {product.hsn_sac_code || "-"}
              </td>

              <td className="p-4 font-semibold text-slate-900 dark:text-white">
                ₹ {Number(product.unit_price || 0).toFixed(2)}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {product.tax_name || "-"}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {Number(product.tax_rate || 0)}%
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {product.quantity || 0} {product.unit_type || ""}
              </td>

              <td className="p-4">
                <StatusBadge status={product.status} />
              </td>

              <td className="p-4">
                <div className="flex gap-2">
                  <IconButton
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => onView(product)}
                  />

                  {canManage && (
                    <>
                      <IconButton
                        icon={<Pencil size={16} />}
                        className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                        onClick={() => onEdit(product)}
                      />

                      {product.status !== "inactive" && (
                        <IconButton
                          icon={<Trash2 size={16} />}
                          className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                          onClick={() => onDelete(product)}
                        />
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {products.length === 0 && (
            <tr>
              <td colSpan="10" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                  <Package className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No products found
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
    </div>
  );
}

function ProductForm({
  formData,
  errors,
  taxes,
  branches,
  editId,
  imageFile,
  previewImage,
  fileInputRef,
  saving,
  taxableValue,
  taxAmount,
  finalValue,
  canManageBranches,
  canManageTaxes,
  getImageUrl,
  handleChange,
  setImageFile,
  handleSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Section title="Basic Product Details">
        <Input
          icon={<Package size={16} />}
          label="Product Name"
          name="product_name"
          value={formData.product_name}
          onChange={handleChange}
          error={errors.product_name}
          required
        />

        <Input
          icon={<Barcode size={16} />}
          label="SKU"
          name="sku"
          value={formData.sku}
          onChange={handleChange}
          error={errors.sku}
        />

        <Field icon={<Building2 size={16} />} label="Branch">
          <BranchSelect
            branches={branches}
            value={formData.branch_id}
            canAddBranch={canManageBranches}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "branch_id",
                  value,
                },
              })
            }
          />
        </Field>

        <Input
          icon={<Tag size={16} />}
          label="Category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          error={errors.category}
        />

        <Field label="Status" error={errors.status}>
          <CustomDropdown
            value={formData.status}
            onChange={(value) =>
              handleChange({
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

      <Section title="Pricing & Tax Details">
        <Field icon={<Percent size={16} />} label="GST / Tax Rule">
          <CustomDropdown
            value={String(formData.tax_id || "")}
            onChange={(value) =>
              handleChange({
                target: { name: "tax_id", value },
              })
            }
            icon={<Percent size={16} />}
            options={[
              { value: "", label: "Select Tax Rule" },
              ...taxes.map((tax) => ({
                value: String(tax.id),
                label: `${tax.tax_name} - ${tax.tax_percentage}%${
                  tax.hsn_sac_code ? ` - ${tax.hsn_sac_code}` : ""
                }`,
              })),
              ...(canManageTaxes
                ? [{ value: "__add_tax__", label: "+ Add New Tax Rule" }]
                : []),
            ]}
          />
        </Field>

        <Input
          icon={<FileText size={16} />}
          label="HSN / SAC Code"
          name="hsn_sac_code"
          value={formData.hsn_sac_code}
          onChange={handleChange}
          error={errors.hsn_sac_code}
        />

        <Input
          icon={<IndianRupee size={16} />}
          label="Unit Price"
          name="unit_price"
          type="number"
          value={formData.unit_price}
          onChange={handleChange}
          error={errors.unit_price}
          required
        />

        <Input
          icon={<Percent size={16} />}
          label="Tax Rate %"
          name="tax_rate"
          type="number"
          value={formData.tax_rate}
          onChange={handleChange}
          error={errors.tax_rate}
        />

        <Input
          icon={<Boxes size={16} />}
          label="Quantity"
          name="quantity"
          type="number"
          value={formData.quantity}
          onChange={handleChange}
          error={errors.quantity}
        />

        <Field label="Unit Type" error={errors.unit_type}>
          <CustomDropdown
            value={formData.unit_type}
            onChange={(value) =>
              handleChange({
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
      </Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AmountBox title="Taxable Value" value={taxableValue} />
        <AmountBox title="Tax Amount" value={taxAmount} />
        <AmountBox title="Final Value" value={finalValue} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Image size={16} />
          Product Image
        </label>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {imageFile ? (
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : previewImage ? (
              <img
                src={getImageUrl(previewImage)}
                alt="Product"
                className="h-full w-full object-cover"
              />
            ) : (
              <Image size={26} className="text-slate-400" />
            )}
          </div>

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 dark:text-slate-300"
            />

            {errors.image ? (
              <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                {errors.image}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Upload PNG, JPG or WebP image. Max size 2MB.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Description
        </label>

        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows="3"
          className={`input ${errors.description ? "input-error" : ""}`}
        />

        {errors.description && (
          <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Saving..." : editId ? "Update Product" : "Add Product"}
        </button>
      </div>
    </form>
  );
}

function ProductViewModal({ product, getImageUrl, onClose }) {
  const taxableValue =
    Number(product.unit_price || 0) * Number(product.quantity || 0);
  const taxAmount = (taxableValue * Number(product.tax_rate || 0)) / 100;
  const finalValue = taxableValue + taxAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {product.image ? (
                <img
                  src={getImageUrl(product.image)}
                  alt={product.product_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package size={22} className="text-slate-400" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {product.product_name || "Product Details"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Complete product information
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <ViewField label="Product Name" value={product.product_name} />
          <ViewField label="Branch" value={product.branch_name || "-"} />
          <ViewField label="SKU" value={product.sku} />
          <ViewField label="Category" value={product.category} />
          <ViewField label="HSN / SAC" value={product.hsn_sac_code} />
          <ViewField label="Tax Rule" value={product.tax_name} />
          <ViewField
            label="Unit Price"
            value={`₹ ${Number(product.unit_price || 0).toFixed(2)}`}
          />
          <ViewField
            label="GST Rate"
            value={`${Number(product.tax_rate || 0)}%`}
          />
          <ViewField
            label="Stock"
            value={`${product.quantity || 0} ${product.unit_type || ""}`}
          />
          <ViewField
            label="Status"
            value={<StatusBadge status={product.status} />}
          />
          <ViewField
            label="Taxable Value"
            value={`₹ ${taxableValue.toFixed(2)}`}
          />
          <ViewField label="Tax Amount" value={`₹ ${taxAmount.toFixed(2)}`} />
          <ViewField label="Final Value" value={`₹ ${finalValue.toFixed(2)}`} />
          <ViewField label="Description" value={product.description} full />
        </div>
      </div>
    </div>
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                {icon}
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
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
    const closeDropdown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeDropdown);
    return () => document.removeEventListener("mousedown", closeDropdown);
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
            <span className="text-slate-400 dark:text-slate-500">{icon}</span>
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
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => {
            const isAddAction = String(option.value).startsWith("__add_");
            const isActive = String(value) === String(option.value);

            if (isAddAction) {
              return (
                <div
                  key={option.value}
                  className="border-t border-slate-100 p-2 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                  >
                    <Plus size={16} />
                    {option.label.replace("+ ", "")}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="truncate">{option.label}</span>

                {isActive && <CheckCircle2 size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BranchSelect({ branches, value, canAddBranch, onChange }) {
  const [open, setOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedBranch = branches.find(
    (branch) => String(branch.id) === String(value),
  );

  const filteredBranches = branches.filter((branch) =>
    `${branch.branch_name || ""} ${branch.branch_code || ""} ${branch.email || ""}`
      .toLowerCase()
      .includes(branchSearch.toLowerCase()),
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
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    const handleClickOutside = (e) => {
      if (
        buttonRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return;
      }

      setOpen(false);
      setBranchSearch("");
    };

    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setOpen(false);
    setBranchSearch("");
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
          {selectedBranch
            ? selectedBranch.branch_code
              ? `${selectedBranch.branch_name} (${selectedBranch.branch_code})`
              : selectedBranch.branch_name
            : "Select Branch"}
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
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                placeholder="Search branch..."
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredBranches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleSelect(String(branch.id))}
                className={`w-full rounded-xl px-3 py-2 text-left transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                  String(value) === String(branch.id)
                    ? "bg-blue-50 dark:bg-blue-950/40"
                    : ""
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {branch.branch_name || "Unnamed Branch"}
                  {(branch.is_main === true || branch.is_main === 1) && " • HQ"}
                </p>

                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {branch.branch_code
                    ? `Code: ${branch.branch_code}`
                    : "No branch code"}
                </p>
              </button>
            ))}

            {filteredBranches.length === 0 && (
              <div className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                No branch found
              </div>
            )}
          </div>

          {canAddBranch && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelect("__add_branch__")}
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                <Plus size={16} />
                Add New Branch
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AmountBox({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <h3 className="mt-1 break-words text-lg font-bold text-slate-900 dark:text-white">
        ₹ {Number(value || 0).toFixed(2)}
      </h3>
    </div>
  );
}

function Input({
  label,
  icon,
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
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
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

function ViewField({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function IconButton({ icon, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-2 transition ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active:
      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    inactive: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || styles.active
      }`}
    >
      {status || "active"}
    </span>
  );
}

export default Products;
