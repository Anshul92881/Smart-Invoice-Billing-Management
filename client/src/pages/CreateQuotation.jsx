import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

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

const makeAttribute = () => ({
  name: "",
  values: "",
});

const makeVariant = (attributes, existing = {}) => ({
  id: existing.id || null,
  attributes,
  sku: existing.sku || "",
  unit_price: existing.unit_price == null ? "" : String(existing.unit_price),
  quantity: existing.quantity == null ? "0" : String(existing.quantity),
  status: existing.status || "active",
});

const canonicalAttributes = (attributes) =>
  JSON.stringify(
    Object.entries(attributes)
      .map(([key, value]) => [
        key.trim().toLowerCase(),
        String(value).trim().toLowerCase(),
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

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

  const canManageProductBranches =
    user?.role === "company_admin" || Boolean(user?.permissions?.branches);

  const canManageProducts =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    hasPermission("products");

  const canManageTaxes =
    user?.role === "company_admin" ||
    hasPermission("taxes") ||
    Boolean(user?.permissions?.taxes);

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
    tax_id: "",
    tax_rate: "",
    quantity: "",
    unit_type: "pcs",
    category: "",
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

  const blankItem = {
    product_id: "",
    variant_id: "",
    product_name: "",
    description: "",
    hsn_sac_code: "",
    quantity: 1,
    price: 0,
    tax_rate: 0,
  };

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [variantLoading, setVariantLoading] = useState({});
  const [variantErrors, setVariantErrors] = useState({});
  const variantRequestRef = useRef(new Set());
  const [branches, setBranches] = useState([]);
  const [taxes, setTaxes] = useState([]);

  const [saving, setSaving] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const submittingRef = useRef(false);
  const [productImageFile, setProductImageFile] = useState(null);
  const productImageInputRef = useRef(null);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productItemIndex, setProductItemIndex] = useState(null);

  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxErrors, setTaxErrors] = useState({});

  const [branchErrors, setBranchErrors] = useState({});
  const [customerErrors, setCustomerErrors] = useState({});
  const [productErrors, setProductErrors] = useState({});

  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [productForm, setProductForm] = useState(initialProductForm);

  const [taxForm, setTaxForm] = useState(initialTaxForm);
  const [taxLoading, setTaxLoading] = useState(false);

  const [variantMode, setVariantMode] = useState(false);
  const [attributes, setAttributes] = useState([makeAttribute()]);
  const [newProductVariants, setNewProductVariants] = useState([]);
  const [variantMessage, setVariantMessage] = useState("");
  const [pendingProductId, setPendingProductId] = useState(null);
  const [productSaving, setProductSaving] = useState(false);

  const [hsnSuggestions, setHsnSuggestions] = useState([]);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnError, setHsnError] = useState("");
  const [hsnSearched, setHsnSearched] = useState(false);
  const [hsnSelected, setHsnSelected] = useState(false);
  const [selectedHsnDetails, setSelectedHsnDetails] = useState(null);

  const autoFilledGstRef = useRef(false);

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
      const taxEndpoint =
        user?.role === "sales_user" ? "/taxes/dropdown" : "/taxes";
      const [customerRes, productRes, branchRes, taxRes] = await Promise.all([
        fetchDropdownData("/customers/dropdown", "/customers", "customers"),
        fetchDropdownData("/products/dropdown", "/products", "products"),
        fetchDropdownData("/branches/dropdown", "/branches", "branches"),
        api.get(taxEndpoint, {
          params: {
            status: "active",
            limit: 1000,
          },
        }),
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
      const taxList = Array.isArray(taxRes.data)
        ? taxRes.data
        : taxRes.data?.taxes || [];

      setTaxes(taxList.filter((tax) => Number(tax.is_active) === 1));
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
                variant_id: item.variant_id ? String(item.variant_id) : "",

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

  // Products with zero parent quantity are either out-of-stock simple products
  // or variant products (parent quantity is always 0 for them). Check which.
  const [stockKinds, setStockKinds] = useState({});
  const stockCheckRef = useRef(new Set());

  useEffect(() => {
    products.forEach((product) => {
      const qty = Number(product.quantity);

      if (
        product.quantity === undefined ||
        product.quantity === null ||
        product.quantity === "" ||
        !Number.isFinite(qty) ||
        qty > 0
      ) {
        return;
      }

      const key = String(product.id);

      if (stockCheckRef.current.has(key)) return;
      stockCheckRef.current.add(key);

      api
        .get(`/products/${key}`)
        .then(({ data }) => {
          const variants = data?.variants ?? data?.product?.variants;
          const kind =
            Array.isArray(variants) && variants.length > 0
              ? "variant"
              : "simple";

          setStockKinds((prev) => ({ ...prev, [key]: kind }));
        })
        .catch(() => {
          setStockKinds((prev) => ({ ...prev, [key]: "error" }));
        });
    });
  }, [products]);

  // Use product detail because dropdown endpoints may not include variants.
  // Cache results by product ID, independently of each quotation row.
  useEffect(() => {
    const productIds = [
      ...new Set(
        items.map((item) => String(item.product_id || "")).filter(Boolean),
      ),
    ];

    productIds.forEach((productId) => {
      if (Object.prototype.hasOwnProperty.call(variantsByProduct, productId))
        return;
      if (variantRequestRef.current.has(productId)) return;
      variantRequestRef.current.add(productId);
      setVariantLoading((prev) => ({ ...prev, [productId]: true }));
      setVariantErrors((prev) => ({ ...prev, [productId]: false }));

      api
        .get(`/products/${productId}`)
        .then(({ data }) => {
          const variants = data?.variants ?? data?.product?.variants;
          if (!Array.isArray(variants)) {
            throw new Error("Product details did not include a variants array");
          }
          setVariantsByProduct((prev) => ({ ...prev, [productId]: variants }));
        })
        .catch((error) => {
          console.error(
            "Failed to load variants for product:",
            productId,
            error,
          );
          setVariantErrors((prev) => ({ ...prev, [productId]: true }));
        })
        .finally(() => {
          variantRequestRef.current.delete(productId);
          setVariantLoading((prev) => ({ ...prev, [productId]: false }));
        });
    });
  }, [items, variantsByProduct]);

  const formatVariant = (variant) => {
    let attributes = variant.attributes;
    if (typeof attributes === "string") {
      try {
        attributes = JSON.parse(attributes);
      } catch {
        attributes = {};
      }
    }
    const attributesLabel =
      attributes && typeof attributes === "object"
        ? Object.entries(attributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" / ")
        : "";
    return attributesLabel || variant.sku || `Variant #${variant.id}`;
  };

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

  useEffect(() => {
    if (!showProductModal || hsnSelected) {
      setHsnSuggestions([]);
      setHsnError("");
      setHsnSearched(false);
      return;
    }

    const productName = cleanString(productForm.product_name);

    if (productName.length < 3) {
      setHsnSuggestions([]);
      setHsnError("");
      setHsnLoading(false);
      setHsnSearched(false);
      return;
    }

    let active = true;

    setHsnLoading(true);
    setHsnSuggestions([]);
    setHsnError("");
    setHsnSearched(false);

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/hsn-sac/suggest", {
          params: {
            product_name: productName,
            limit: 20,
          },
        });

        if (!active) return;

        setHsnSuggestions(
          Array.isArray(data?.suggestions)
            ? data.suggestions
            : Array.isArray(data)
              ? data
              : [],
        );

        setHsnSearched(true);
      } catch (error) {
        if (!active) return;

        setHsnSuggestions([]);
        setHsnError(
          error.response?.data?.message || "HSN/SAC suggestions unavailable",
        );
        setHsnSearched(true);
      } finally {
        if (active) {
          setHsnLoading(false);
        }
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productForm.product_name, showProductModal, hsnSelected]);

  const selectProductHsn = (item) => {
    const code = String(item?.code ?? "");

    if (!HSN_SAC_REGEX.test(code)) return;

    const hasGstRate =
      item?.gst_rate !== null &&
      item?.gst_rate !== undefined &&
      item?.gst_rate !== "" &&
      Number.isFinite(Number(item.gst_rate));

    setSelectedHsnDetails(item);
    setHsnSelected(true);
    setHsnSuggestions([]);

    setProductForm((prev) => {
      const shouldFillGst =
        hasGstRate &&
        !prev.tax_id &&
        (prev.tax_rate === "" || autoFilledGstRef.current);

      const clearOldAutoGst =
        autoFilledGstRef.current && !prev.tax_id && !shouldFillGst;

      autoFilledGstRef.current = Boolean(shouldFillGst);

      return {
        ...prev,
        hsn_sac_code: code,

        ...(shouldFillGst
          ? {
              tax_rate: String(Number(item.gst_rate)),
            }
          : clearOldAutoGst
            ? {
                tax_rate: "",
              }
            : {}),
      };
    });

    setProductErrors((prev) => ({
      ...prev,
      hsn_sac_code: "",
      tax_rate: "",
    }));
  };

  const hasMappedGst = Boolean(
    selectedHsnDetails &&
    selectedHsnDetails.gst_rate !== null &&
    selectedHsnDetails.gst_rate !== undefined &&
    selectedHsnDetails.gst_rate !== "" &&
    Number.isFinite(Number(selectedHsnDetails.gst_rate)),
  );

  const selectedTaxOption = productForm.tax_id
    ? String(productForm.tax_id)
    : hasMappedGst && autoFilledGstRef.current
      ? "__hsn_mapped__"
      : "";

  const getSelectedTax = (taxId) =>
    taxes.find((tax) => Number(tax.id) === Number(taxId));

  const handleTaxRuleSelection = (value) => {
    if (value === "__add_tax__") {
      if (!canManageTaxes) {
        toast.error("Tax permission required");
        return;
      }

      setTaxErrors({});
      setShowTaxModal(true);
      return;
    }

    if (value === "__hsn_mapped__") {
      if (!hasMappedGst) return;

      autoFilledGstRef.current = true;

      setProductForm((prev) => ({
        ...prev,
        tax_id: "",
        tax_rate: String(Number(selectedHsnDetails.gst_rate)),
      }));

      setProductErrors((prev) => ({
        ...prev,
        tax_id: "",
        tax_rate: "",
      }));

      return;
    }

    if (value === "") {
      autoFilledGstRef.current = false;

      setProductForm((prev) => ({
        ...prev,
        tax_id: "",
        tax_rate: "",
      }));

      setProductErrors((prev) => ({
        ...prev,
        tax_id: "",
        tax_rate: "",
      }));

      return;
    }

    const selectedTax = getSelectedTax(value);

    autoFilledGstRef.current = false;

    setProductForm((prev) => ({
      ...prev,
      tax_id: value,
      tax_rate: selectedTax?.tax_percentage ?? "",
    }));

    setProductErrors((prev) => ({
      ...prev,
      tax_id: "",
      tax_rate: "",
    }));
  };

  const resetProductHsnState = () => {
    setHsnSuggestions([]);
    setHsnLoading(false);
    setHsnError("");
    setHsnSearched(false);
    setHsnSelected(false);
    setSelectedHsnDetails(null);

    autoFilledGstRef.current = false;
  };

  const handleProductFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "branch_id" && value === "__add_branch__") {
      if (!canManageProductBranches) {
        toast.error("Branch permission required");
        return;
      }

      setBranchErrors({});
      setShowBranchModal(true);
      return;
    }

    if (name === "tax_id") {
      handleTaxRuleSelection(value);
      return;
    }

    if (name === "product_name" && value !== productForm.product_name) {
      const clearAutoFilledGst =
        autoFilledGstRef.current && !productForm.tax_id;

      resetProductHsnState();

      setProductForm((prev) => ({
        ...prev,
        product_name: value,
        hsn_sac_code: "",
        ...(clearAutoFilledGst
          ? {
              tax_rate: "",
            }
          : {}),
      }));

      clearProductError("product_name");
      return;
    }

    const nextValue =
      name === "sku" || name === "hsn_sac_code" ? normalizeUpper(value) : value;

    if (name === "tax_rate") {
      autoFilledGstRef.current = false;
    }

    setProductForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    clearProductError(name);
  };

  const handleTaxChange = (event) => {
    const { name, value, type, checked } = event.target;

    const nextValue =
      name === "hsn_sac_code"
        ? normalizeUpper(value)
        : type === "checkbox"
          ? checked
          : value;

    setTaxForm((previous) => ({
      ...previous,
      [name]: nextValue,
    }));

    if (taxErrors[name]) {
      setTaxErrors((previous) => ({
        ...previous,
        [name]: "",
      }));
    }
  };

  const resetTaxForm = () => {
    setTaxForm(initialTaxForm);
    setTaxErrors({});
  };

  const validateTaxForm = () => {
    const nextErrors = {};

    const taxName = cleanString(taxForm.tax_name);
    const taxType = cleanString(taxForm.tax_type);

    const hsnSacCode = normalizeUpper(taxForm.hsn_sac_code);

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

    if (hsnSacCode && !HSN_SAC_REGEX.test(hsnSacCode)) {
      nextErrors.hsn_sac_code = "HSN/SAC code must be 4 to 8 digits";
    }

    if (description && description.length > 500) {
      nextErrors.description = "Description must be less than 500 characters";
    }

    setTaxErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
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

    if (taxLoading || !validateTaxForm()) return;

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

      const response = await api.post("/taxes", payload);

      const createdTax = response.data?.tax || response.data;

      const taxEndpoint =
        user?.role === "sales_user" ? "/taxes/dropdown" : "/taxes";

      const taxResponse = await api.get(taxEndpoint, {
        params: {
          status: "active",
          limit: 1000,
        },
      });

      const taxList = Array.isArray(taxResponse.data)
        ? taxResponse.data
        : taxResponse.data?.taxes || [];

      const updatedTaxes = taxList.filter((tax) => Number(tax.is_active) === 1);

      setTaxes(updatedTaxes);

      const selectedTaxId =
        createdTax?.id ||
        createdTax?.tax_id ||
        updatedTaxes.find(
          (tax) =>
            tax.tax_name?.toLowerCase() === payload.tax_name.toLowerCase(),
        )?.id;

      const selectedTax =
        updatedTaxes.find((tax) => String(tax.id) === String(selectedTaxId)) ||
        createdTax;

      if (selectedTaxId && Number(selectedTax?.is_active) === 1) {
        autoFilledGstRef.current = false;

        setProductForm((previous) => ({
          ...previous,
          tax_id: String(selectedTaxId),
          tax_rate: selectedTax?.tax_percentage ?? payload.tax_percentage,
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

  const resetProductVariantState = () => {
    setVariantMode(false);
    setAttributes([makeAttribute()]);
    setNewProductVariants([]);
    setVariantMessage("");
    setPendingProductId(null);
    setProductSaving(false);
  };

  const generateProductVariants = () => {
    setVariantMessage("");

    if (!attributes.length || attributes.length > 10) {
      setVariantMessage("Add 1–10 attributes.");
      return;
    }

    const parsedAttributes = [];
    const attributeNames = new Set();

    for (const attribute of attributes) {
      const name = cleanString(attribute.name);

      const values = [
        ...new Set(
          String(attribute.values)
            .split(",")
            .map((value) => cleanString(value))
            .filter(Boolean),
        ),
      ];

      if (
        !name ||
        name.length > 50 ||
        !values.length ||
        values.some((value) => value.length > 100)
      ) {
        setVariantMessage(
          "Enter each attribute name and comma-separated values.",
        );
        return;
      }

      if (attributeNames.has(name.toLowerCase())) {
        setVariantMessage("Attribute names must be unique.");
        return;
      }

      attributeNames.add(name.toLowerCase());

      parsedAttributes.push({
        name,
        values,
      });
    }

    let combinations = [{}];

    for (const attribute of parsedAttributes) {
      combinations = combinations.flatMap((entry) =>
        attribute.values.map((value) => ({
          ...entry,
          [attribute.name]: value,
        })),
      );

      if (combinations.length > 60) {
        setVariantMessage("Maximum 60 combinations per product.");
        return;
      }
    }

    const existingVariants = new Map(
      newProductVariants.map((variant) => [
        canonicalAttributes(variant.attributes),
        variant,
      ]),
    );

    const generatedVariants = combinations.map(
      (combination) =>
        existingVariants.get(canonicalAttributes(combination)) ||
        makeVariant(combination),
    );

    const savedVariantsOutsideCombinations = newProductVariants.filter(
      (variant) =>
        variant.id &&
        !generatedVariants.some(
          (generatedVariant) => generatedVariant.id === variant.id,
        ),
    );

    if (savedVariantsOutsideCombinations.length) {
      setVariantMessage(
        "Already saved variants cannot be removed. Keep their combinations and retry.",
      );
      return;
    }

    setNewProductVariants(generatedVariants);
  };

  const validateProductVariants = () => {
    if (!variantMode) return true;

    if (!newProductVariants.length) {
      setVariantMessage("Generate at least one variant.");
      return false;
    }

    const usedSkus = new Set();

    for (const variant of newProductVariants) {
      const sku = normalizeUpper(variant.sku);
      const price = Number(variant.unit_price);
      const quantity = Number(variant.quantity);

      if (!SKU_REGEX.test(sku)) {
        setVariantMessage(
          "Each variant needs a unique valid SKU (2–50 characters).",
        );
        return false;
      }

      if (usedSkus.has(sku) || sku === normalizeUpper(productForm.sku)) {
        setVariantMessage("Duplicate SKU found in variants or parent product.");
        return false;
      }

      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99999999.99 ||
        !/^\d+(\.\d{1,2})?$/.test(String(variant.unit_price))
      ) {
        setVariantMessage(
          `Invalid price for ${sku}. Use a positive amount with up to 2 decimals.`,
        );
        return false;
      }

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        String(variant.quantity).trim() === ""
      ) {
        setVariantMessage(`Invalid stock for ${sku}.`);
        return false;
      }

      usedSkus.add(sku);
    }

    setVariantMessage("");
    return true;
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
    const unitPrice = toNumber(productForm.unit_price, variantMode ? 0 : NaN);
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
    } else if (unitPrice <= 0 && !variantMode) {
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

    if (variantMode && productForm.status !== "active") {
      setVariantMessage("Create variants for an active product first.");

      return false;
    }

    setProductErrors(nextErrors);
    return Object.keys(nextErrors).length === 0 && validateProductVariants();
  };

  const handleCreateProduct = async (event) => {
    event?.preventDefault();

    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    if (productSaving || !validateProductForm()) return;

    let savedProductId = pendingProductId;
    let parentProductSaved = Boolean(pendingProductId);

    let syncedVariants = newProductVariants.filter(
      (variant) => variant.id,
    ).length;

    try {
      const payload = {
        branch_id: productForm.branch_id || formData.branch_id || "",

        product_name: cleanString(productForm.product_name),

        sku: normalizeUpper(productForm.sku),

        hsn_sac_code: normalizeUpper(productForm.hsn_sac_code),

        description: cleanString(productForm.description),

        unit_price: variantMode
          ? Math.min(
              ...newProductVariants.map((variant) =>
                Number(variant.unit_price),
              ),
            )
          : Number(productForm.unit_price || 0),

        tax_id: productForm.tax_id || "",

        tax_rate: Number(productForm.tax_rate || 0),

        quantity: variantMode
          ? 0
          : productForm.quantity === ""
            ? 0
            : Number(productForm.quantity),

        unit_type: cleanString(productForm.unit_type).toLowerCase() || "pcs",

        category: cleanString(productForm.category),

        status: cleanString(productForm.status).toLowerCase() || "active",
      };

      setProductSaving(true);

      let createdProduct = null;

      /*
       * Parent product sirf pehli baar create hoga.
       * Agar variants save karte waqt error aaye to retry par
       * duplicate parent product create nahi hoga.
       */
      if (!savedProductId) {
        const response = await api.post("/products", payload);

        savedProductId =
          response.data?.product_id ||
          response.data?.id ||
          response.data?.product?.id;

        if (!savedProductId) {
          throw new Error("Product created but ID missing from API response");
        }

        createdProduct = response.data?.product || response.data;

        parentProductSaved = true;
        setPendingProductId(savedProductId);
      }

      /*
       * Variant Mode mein har unsaved variant create hoga.
       */
      if (variantMode) {
        for (let index = 0; index < newProductVariants.length; index += 1) {
          const variant = newProductVariants[index];

          // Retry ke time already-created variant dobara create nahi hoga.
          if (variant.id) continue;

          const { data } = await api.post(
            `/products/${savedProductId}/variants`,
            {
              sku: normalizeUpper(variant.sku),
              attributes: variant.attributes,
              unit_price: Number(variant.unit_price),
              quantity: Number(variant.quantity),
              status: variant.status,
            },
          );

          const createdVariantId =
            data?.variant_id || data?.id || data?.variant?.id;

          newProductVariants[index] = {
            ...variant,
            id: createdVariantId,
          };

          syncedVariants += 1;

          setNewProductVariants([...newProductVariants]);
        }
      }

      /*
       * Parent product create hone ke baad image upload hogi.
       */
      await uploadProductImage(savedProductId);

      /*
       * Product dropdown refresh.
       */
      const productData = await fetchDropdownData(
        "/products/dropdown",
        "/products",
        "products",
      );

      const updatedProducts = productData.filter(
        (product) => product.status === "active" || product.status === 1,
      );

      setProducts(updatedProducts);

      const selectedProductId =
        savedProductId ||
        createdProduct?.id ||
        createdProduct?.product_id ||
        updatedProducts.find(
          (product) =>
            product.product_name?.toLowerCase() ===
            payload.product_name.toLowerCase(),
        )?.id;

      const selectedProduct = updatedProducts.find(
        (product) => Number(product.id) === Number(selectedProductId),
      );

      /*
       * Naya Product current Quotation row mein select hoga.
       */
      if (selectedProduct && productItemIndex !== null) {
        setItems((previousItems) => {
          const updatedItems = [...previousItems];

          updatedItems[productItemIndex] = {
            ...updatedItems[productItemIndex],

            product_id: String(selectedProduct.id),

            variant_id: "",

            product_name:
              selectedProduct.product_name || selectedProduct.name || "",

            description: selectedProduct.description || "",

            hsn_sac_code: selectedProduct.hsn_sac_code || "",

            price:
              selectedProduct.unit_price ||
              selectedProduct.price ||
              selectedProduct.selling_price ||
              0,

            tax_rate: selectedProduct.tax_rate || 0,
          };

          return updatedItems;
        });

        /*
         * Variant dropdown ke liye newly-created variants fetch karo.
         */
        const { data: productDetails } = await api.get(
          `/products/${selectedProduct.id}`,
        );

        const savedVariants = Array.isArray(productDetails?.variants)
          ? productDetails.variants
          : Array.isArray(productDetails?.product?.variants)
            ? productDetails.product.variants
            : [];

        setVariantsByProduct((previous) => ({
          ...previous,
          [String(selectedProduct.id)]: savedVariants,
        }));
      }

      /*
       * Successful save ke baad modal state reset.
       */
      setProductForm(initialProductForm);
      setProductErrors({});
      setProductItemIndex(null);
      setProductImageFile(null);

      resetProductHsnState();
      resetProductVariantState();

      if (productImageInputRef.current) {
        productImageInputRef.current.value = "";
      }

      setShowProductModal(false);

      toast.success("Product added successfully");
    } catch (error) {
      if (parentProductSaved) {
        toast.error(
          `Product saved, but variant sync stopped after ${syncedVariants} item(s). ${
            error.response?.data?.message || error.message || "Please retry."
          }`,
          {
            duration: 8000,
          },
        );

        setVariantMessage(
          "Partial save: keep this modal open and retry. Saved variants will not be created again.",
        );
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Product create failed",
        );
      }
    } finally {
      setProductSaving(false);
    }
  };

  const variantBasePrice = newProductVariants.length
    ? Math.min(
        ...newProductVariants.map((variant) => Number(variant.unit_price) || 0),
      )
    : 0;

  const variantStock = newProductVariants.reduce(
    (total, variant) =>
      total + (variant.status === "active" ? Number(variant.quantity) || 0 : 0),
    0,
  );

  const productTaxableValue = variantMode
    ? newProductVariants.reduce(
        (total, variant) =>
          total +
          (variant.status === "active"
            ? (Number(variant.unit_price) || 0) *
              (Number(variant.quantity) || 0)
            : 0),
        0,
      )
    : Number(productForm.unit_price || 0) * Number(productForm.quantity || 0);

  const productTaxAmount =
    (productTaxableValue * Number(productForm.tax_rate || 0)) / 100;

  const productFinalValue = productTaxableValue + productTaxAmount;

  const closeProductModal = () => {
    setProductForm(initialProductForm);
    setProductErrors({});
    setProductItemIndex(null);
    setProductImageFile(null);

    resetProductHsnState();
    resetProductVariantState();

    if (productImageInputRef.current) {
      productImageInputRef.current.value = "";
    }

    setShowProductModal(false);
  };

  const handleVariantSelect = (index, variantId) => {
    const productId = String(items[index]?.product_id || "");
    const variant = (variantsByProduct[productId] || []).find(
      (entry) => String(entry.id) === String(variantId),
    );
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex !== index
          ? item
          : {
              ...item,
              variant_id: variant ? String(variant.id) : "",
              price: variant ? Number(variant.unit_price) : item.price,
            },
      ),
    );
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    if (name === "price" || name === "tax_rate") return;

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
      setProductImageFile(null);

      resetProductHsnState();
      resetProductVariantState();

      if (productImageInputRef.current) {
        productImageInputRef.current.value = "";
      }

      setShowProductModal(true);
      return;
    }

    const product = products.find((p) => Number(p.id) === Number(productId));

    setItems((prevItems) => {
      const updatedItems = [...prevItems];

      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        variant_id: "",
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

      const productId = String(item.product_id);
      if (!Object.prototype.hasOwnProperty.call(variantsByProduct, productId)) {
        toast.error(
          `Variant information is still loading or unavailable at row ${index + 1}`,
        );
        return false;
      }
      const productVariants = variantsByProduct[productId];
      if (productVariants.length) {
        const selectedVariant = productVariants.find(
          (variant) => String(variant.id) === String(item.variant_id),
        );
        if (!selectedVariant || selectedVariant.status !== "active") {
          toast.error(`Please select an active variant at row ${index + 1}`);
          return false;
        }
        if (!Number.isInteger(Number(item.quantity))) {
          toast.error(
            `Variant quantity must be a whole number at row ${index + 1}`,
          );
          return false;
        }
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
      variant_id: item.variant_id || null,
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

    // Block repeated clicks immediately, without waiting for React state updates.
    if (submittingRef.current || submissionComplete) return;
    if (!validateForm()) return;

    submittingRef.current = true;
    setSaving(true);
    let succeeded = false;

    try {
      const payload = buildQuotationPayload();

      const res = isEditMode
        ? await api.put(`/quotations/${id}`, payload)
        : await api.post("/quotations", payload);

      // Do not allow this completed form to submit again during navigation/modal close.
      succeeded = true;
      setSubmissionComplete(true);

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
      if (!succeeded) {
        toast.error(
          error.response?.data?.message ||
            error.response?.data?.error ||
            (isEditMode
              ? "Failed to update quotation"
              : "Failed to create quotation"),
        );
      } else {
        console.error("Quotation saved, but navigation/close failed:", error);
      }
    } finally {
      // Only release the lock on a failed request so the user may retry.
      if (!succeeded) submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className={`w-full max-w-full min-w-0 space-y-5 ${
        modalMode
          ? "h-full min-h-0 overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950"
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
                    target: {
                      name: "branch_id",
                      value,
                    },
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
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
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

                  <div
                    className={`quotation-item-fields grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 [&_.input]:min-h-9 [&_.input]:rounded-lg [&_.input]:px-2.5 [&_.input]:py-2 [&_label]:mb-1 [&_label]:text-xs ${
                      item.product_id &&
                      (variantsByProduct[String(item.product_id)]?.length ||
                        variantLoading[String(item.product_id)] ||
                        variantErrors[String(item.product_id)])
                        ? "xl:grid-cols-[minmax(160px,1.5fr)_minmax(170px,1.6fr)_minmax(125px,1.2fr)_minmax(95px,.8fr)_minmax(65px,.6fr)_minmax(100px,.85fr)_minmax(70px,.6fr)]"
                        : "xl:grid-cols-[minmax(180px,1.6fr)_minmax(150px,1.3fr)_minmax(105px,.9fr)_minmax(70px,.6fr)_minmax(115px,.9fr)_minmax(75px,.65fr)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <Field label="Product">
                        <ProductSelect
                          products={filteredProducts}
                          value={item.product_id}
                          canAddProduct={canManageProducts}
                          stockKinds={stockKinds}
                          onChange={(value) =>
                            handleProductSelect(index, {
                              target: { value },
                            })
                          }
                        />
                      </Field>
                    </div>

                    {(() => {
                      const productId = String(item.product_id || "");
                      const variants = variantsByProduct[productId] || [];
                      const loading =
                        Boolean(productId) &&
                        Boolean(variantLoading[productId]);
                      const failed =
                        Boolean(productId) && Boolean(variantErrors[productId]);
                      return variants.length > 0 || loading || failed ? (
                        <div className="min-w-0">
                          <Field label="Variant">
                            <SearchableDropdown
                              value={item.variant_id || ""}
                              placeholder={
                                loading
                                  ? "Loading variants..."
                                  : failed
                                    ? "Unable to load"
                                    : "Select Variant"
                              }
                              searchPlaceholder="Search variant..."
                              wide
                              emptyText="No active variants"
                              options={variants
                                .filter(
                                  (variant) =>
                                    variant.status === "active" &&
                                    Number(variant.quantity) > 0,
                                )
                                .map((variant) => ({
                                  value: String(variant.id),
                                  title: formatVariant(variant),
                                  subtitle: `SKU: ${variant.sku || "—"} • ₹${Number(variant.unit_price).toFixed(2)} • Stock: ${variant.quantity}`,
                                }))}
                              onChange={(value) =>
                                handleVariantSelect(index, value)
                              }
                            />
                          </Field>
                        </div>
                      ) : null;
                    })()}

                    <div className="min-w-0">
                      <Input
                        label="Description"
                        name="description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, e)}
                      />
                    </div>

                    <div className="min-w-0">
                      <Input
                        label="HSN/SAC"
                        name="hsn_sac_code"
                        value={item.hsn_sac_code}
                        onChange={(e) => handleItemChange(index, e)}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        label="Qty"
                        type="number"
                        name="quantity"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, e)}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        label="Price"
                        type="number"
                        name="price"
                        value={item.price}
                        readOnly
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        label="Tax %"
                        type="number"
                        name="tax_rate"
                        value={item.tax_rate}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              disabled={saving || submissionComplete || loadingQuotation}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Saving..."
                : submissionComplete
                  ? isEditMode
                    ? "Updated"
                    : "Saved"
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
          title="Add Product"
          description="Fill product details, image, GST mapping and stock information."
          icon={<Package size={22} />}
          onClose={closeProductModal}
        >
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Product Type
            </span>

            <div
              role="radiogroup"
              aria-label="Product Type"
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="product_type"
                  checked={!variantMode}
                  onChange={() => {
                    if (newProductVariants.some((variant) => variant.id)) {
                      setVariantMessage(
                        "Deactivate saved variants individually before switching back to Single Product.",
                      );
                      return;
                    }

                    setVariantMode(false);
                    setVariantMessage("");
                  }}
                  disabled={productSaving}
                  className="h-4 w-4 accent-blue-600"
                />
                Single Product
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="product_type"
                  checked={variantMode}
                  onChange={() => {
                    setVariantMode(true);
                    setVariantMessage("");
                  }}
                  disabled={productSaving}
                  className="h-4 w-4 accent-blue-600"
                />
                Add Variants Products
              </label>
            </div>
          </div>
          <Section title="Basic Product Details">
            <div className="relative min-w-0">
              <ModalInput
                icon={<Package size={16} />}
                label="Product Name"
                name="product_name"
                value={productForm.product_name}
                onChange={handleProductFormChange}
                error={productErrors.product_name}
                required
              />

              {!hsnSelected && productForm.product_name.trim().length >= 3 && (
                <div className="mt-1.5">
                  {hsnLoading && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Finding matching HSN/SAC codes...
                    </p>
                  )}

                  {hsnError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {hsnError}
                    </p>
                  )}

                  {hsnSuggestions.length > 0 && (
                    <div className="relative z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <p className="sticky top-0 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Suggested HSN/SAC — select the correct classification
                      </p>

                      {hsnSuggestions.map((item) => {
                        const validCode = /^\d{4,8}$/.test(String(item.code));

                        return (
                          <button
                            key={
                              item.id ??
                              `${item.type}-${item.code}-${item.description}`
                            }
                            type="button"
                            disabled={!validCode}
                            onClick={() => selectProductHsn(item)}
                            className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-300">
                              {item.type} {item.code}
                            </span>

                            <span>
                              {item.description}

                              <span className="ml-2 whitespace-nowrap font-medium text-emerald-700 dark:text-emerald-300">
                                {item.gst_rate == null || item.gst_rate === ""
                                  ? "GST not mapped"
                                  : `GST ${Number(item.gst_rate)}%`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {hsnSearched &&
                    !hsnLoading &&
                    !hsnError &&
                    hsnSuggestions.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No HSN matches for this name. Search HSN/SAC manually.
                      </p>
                    )}
                </div>
              )}
            </div>

            <ModalInput
              icon={<Barcode size={16} />}
              label="SKU"
              name="sku"
              value={productForm.sku}
              onChange={handleProductFormChange}
              error={productErrors.sku}
            />

            <Field
              icon={<Building2 size={16} />}
              label="Branch"
              error={productErrors.branch_id}
            >
              <BranchSelect
                branches={branches}
                value={productForm.branch_id}
                canAddBranch={canManageProductBranches}
                onChange={(value) =>
                  handleProductFormChange({
                    target: {
                      name: "branch_id",
                      value,
                    },
                  })
                }
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
              icon={<CheckCircle2 size={16} />}
              label="Status"
              error={productErrors.status}
            >
              <CustomDropdown
                value={productForm.status}
                onChange={(value) =>
                  handleProductFormChange({
                    target: {
                      name: "status",
                      value,
                    },
                  })
                }
                options={[
                  {
                    value: "active",
                    label: "Active",
                  },
                  {
                    value: "inactive",
                    label: "Inactive",
                  },
                ]}
              />
            </Field>
          </Section>

          {variantMode && (
            <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Product Variants
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Add attributes such as Size or Color and generate
                  combinations. Base Price and Total Stock will be calculated
                  automatically.
                </p>
              </div>

              {attributes.map((attribute, attributeIndex) => (
                <div
                  key={attributeIndex}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]"
                >
                  <input
                    type="text"
                    className="input"
                    placeholder="Attribute (Size, Color...)"
                    value={attribute.name}
                    onChange={(event) =>
                      setAttributes((previous) =>
                        previous.map((item, index) =>
                          index === attributeIndex
                            ? {
                                ...item,
                                name: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />

                  <input
                    type="text"
                    className="input"
                    placeholder="Values, comma separated: S, M, L"
                    value={attribute.values}
                    onChange={(event) =>
                      setAttributes((previous) =>
                        previous.map((item, index) =>
                          index === attributeIndex
                            ? {
                                ...item,
                                values: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />

                  <button
                    type="button"
                    disabled={attributes.length === 1}
                    onClick={() =>
                      setAttributes((previous) =>
                        previous.filter((_, index) => index !== attributeIndex),
                      )
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={attributes.length >= 10}
                  onClick={() =>
                    setAttributes((previous) => [...previous, makeAttribute()])
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  + Attribute
                </button>

                <button
                  type="button"
                  onClick={generateProductVariants}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Generate Combinations
                </button>
              </div>

              {variantMessage && (
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {variantMessage}
                </p>
              )}

              {newProductVariants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-700 dark:text-white">
                      <tr>
                        <th className="p-2 text-left">Combination</th>

                        <th className="p-2 text-left">SKU</th>

                        <th className="p-2 text-left">Price</th>

                        <th className="p-2 text-left">Stock</th>

                        <th className="p-2 text-left">Status</th>

                        <th className="p-2 text-center">Remove</th>
                      </tr>
                    </thead>

                    <tbody>
                      {newProductVariants.map((variant, variantIndex) => (
                        <tr
                          key={
                            variant.id ||
                            canonicalAttributes(variant.attributes)
                          }
                          className="border-b border-slate-200 dark:border-slate-700"
                        >
                          <td className="p-2 text-xs text-slate-700 dark:text-slate-200">
                            {Object.entries(variant.attributes)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(" / ")}
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              className="input"
                              value={variant.sku}
                              onChange={(event) =>
                                setNewProductVariants((previous) =>
                                  previous.map((item, index) =>
                                    index === variantIndex
                                      ? {
                                          ...item,
                                          sku: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input"
                              value={variant.unit_price}
                              onChange={(event) =>
                                setNewProductVariants((previous) =>
                                  previous.map((item, index) =>
                                    index === variantIndex
                                      ? {
                                          ...item,
                                          unit_price: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="input"
                              value={variant.quantity}
                              onChange={(event) =>
                                setNewProductVariants((previous) =>
                                  previous.map((item, index) =>
                                    index === variantIndex
                                      ? {
                                          ...item,
                                          quantity: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>

                          <td className="p-1">
                            <select
                              className="input"
                              value={variant.status}
                              onChange={(event) =>
                                setNewProductVariants((previous) =>
                                  previous.map((item, index) =>
                                    index === variantIndex
                                      ? {
                                          ...item,
                                          status: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="active">Active</option>

                              <option value="inactive">Inactive</option>
                            </select>
                          </td>

                          <td className="p-1 text-center">
                            <button
                              type="button"
                              disabled={Boolean(variant.id)}
                              title={
                                variant.id
                                  ? "Saved variant cannot be removed"
                                  : "Remove variant"
                              }
                              onClick={() =>
                                setNewProductVariants((previous) =>
                                  previous.filter(
                                    (_, index) => index !== variantIndex,
                                  ),
                                )
                              }
                              className="text-lg font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            <Section title="Pricing & Tax Details">
              <Field
                icon={<Percent size={16} />}
                label="GST / Tax Rule"
                error={productErrors.tax_id}
              >
                <CustomDropdown
                  value={selectedTaxOption}
                  onChange={handleTaxRuleSelection}
                  icon={<Percent size={16} />}
                  options={[
                    {
                      value: "",
                      label: "Select Tax Rule",
                    },

                    ...(hasMappedGst
                      ? [
                          {
                            value: "__hsn_mapped__",
                            label: `HSN Mapped GST — ${Number(
                              selectedHsnDetails.gst_rate,
                            )}%`,
                          },
                        ]
                      : []),

                    ...taxes.map((tax) => ({
                      value: String(tax.id),
                      label: `${tax.tax_name} - ${tax.tax_percentage}%`,
                    })),

                    ...(canManageTaxes
                      ? [
                          {
                            value: "__add_tax__",
                            label: "+ Add New Tax Rule",
                          },
                        ]
                      : []),
                  ]}
                />
              </Field>

              <ProductHsnSacPicker
                value={productForm.hsn_sac_code}
                onChange={selectProductHsn}
                error={productErrors.hsn_sac_code}
                suggestions={hsnSuggestions}
                suggestionLoading={hsnLoading}
                suggestionError={hsnError}
              />

              <ModalInput
                icon={<IndianRupee size={16} />}
                label={
                  variantMode
                    ? "Base Price (automatically uses lowest variant price)"
                    : "Unit Price"
                }
                name="unit_price"
                type="number"
                disabled={variantMode}
                value={
                  variantMode
                    ? newProductVariants.length
                      ? String(variantBasePrice)
                      : ""
                    : productForm.unit_price
                }
                onChange={handleProductFormChange}
                error={productErrors.unit_price}
                required
              />

              <ModalInput
                icon={<Percent size={16} />}
                label="Tax Rate %"
                name="tax_rate"
                type="number"
                value={productForm.tax_rate}
                onChange={handleProductFormChange}
                error={productErrors.tax_rate}
              />

              <ModalInput
                icon={<Boxes size={16} />}
                label={
                  variantMode
                    ? "Total Active Variant Stock (calculated)"
                    : "Quantity"
                }
                name="quantity"
                type="number"
                disabled={variantMode}
                value={
                  variantMode ? String(variantStock) : productForm.quantity
                }
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
                      target: {
                        name: "unit_type",
                        value,
                      },
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

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <AmountBox title="Taxable Value" value={productTaxableValue} />

              <AmountBox title="Tax Amount" value={productTaxAmount} />

              <AmountBox title="Final Value" value={productFinalValue} />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Image size={16} />
              Product Image
            </label>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {productImageFile ? (
                  <img
                    src={URL.createObjectURL(productImageFile)}
                    alt="Product preview"
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
                  onChange={(event) => {
                    setProductImageFile(event.target.files?.[0] || null);

                    clearProductError("image");
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 dark:text-slate-300 dark:file:bg-slate-700 dark:hover:file:bg-slate-600"
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

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <FileText size={16} />
              Description
            </label>

            <textarea
              name="description"
              value={productForm.description}
              onChange={handleProductFormChange}
              rows="3"
              className={`input ${
                productErrors.description ? "input-error" : ""
              }`}
            />

            {productErrors.description && (
              <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                {productErrors.description}
              </p>
            )}
          </div>

          <ModalActions
            onCancel={closeProductModal}
            onSave={handleCreateProduct}
            saveText={productSaving ? "Saving..." : "Add Product"}
            disabled={productSaving}
          />
        </Modal>
      )}

      {showTaxModal && (
        <Modal
          title="Add New Tax Rule"
          description="Create GST / Tax rule without leaving product form."
          icon={<BadgePercent size={22} />}
          onClose={() => {
            setShowTaxModal(false);
            resetTaxForm();
          }}
          topMost
        >
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
                  {
                    value: "GST",
                    label: "GST",
                  },
                  {
                    value: "CGST_SGST",
                    label: "CGST + SGST",
                  },
                  {
                    value: "IGST",
                    label: "IGST",
                  },
                  {
                    value: "TDS",
                    label: "TDS",
                  },
                  {
                    value: "TCS",
                    label: "TCS",
                  },
                  {
                    value: "OTHER",
                    label: "Other",
                  },
                ]}
              />
            </Field>

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

            <ModalInput
              icon={<Hash size={16} />}
              label="HSN / SAC Code"
              name="hsn_sac_code"
              value={taxForm.hsn_sac_code}
              onChange={handleTaxChange}
              error={taxErrors.hsn_sac_code}
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
                  {
                    value: "active",
                    label: "Active",
                  },
                  {
                    value: "inactive",
                    label: "Inactive",
                  },
                ]}
              />
            </Field>

            <label className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                name="reverse_charge"
                checked={Boolean(taxForm.reverse_charge)}
                onChange={handleTaxChange}
                className="h-4 w-4 accent-blue-600"
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
                className={`input ${
                  taxErrors.description ? "input-error" : ""
                }`}
              />

              {taxErrors.description && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  {taxErrors.description}
                </p>
              )}
            </div>
          </div>

          <ModalActions
            onCancel={() => {
              setShowTaxModal(false);
              resetTaxForm();
            }}
            onSave={handleCreateTax}
            saveText={taxLoading ? "Saving..." : "Save Tax Rule"}
            disabled={taxLoading}
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

            <div className="md:col-span-2 xl:col-span-3">
              <label className=" flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
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
            onCancel={() => setShowBranchModal(false)}
            onSave={handleCreateBranch}
            saveText="Save Branch"
          />
        </Modal>
      )}

      <style>{`
        .quotation-item-fields > div > label { margin-bottom: 4px; font-size: 12px; }
        .quotation-item-fields > div button { min-height: 36px; padding: 7px 9px; font-size: 13px; }
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

function Input({
  label,
  icon,
  name,
  value,
  onChange,
  type = "text",
  min,
  readOnly = false,
}) {
  return (
    <Field icon={icon} label={label}>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        min={min}
        readOnly={readOnly}
        className={`input ${readOnly ? "cursor-default bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" : ""}`}
      />
    </Field>
  );
}

function ProductHsnSacPicker({
  value = "",
  onChange,
  error,
  suggestions = [],
  suggestionLoading = false,
  suggestionError = "",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [focused, setFocused] = useState(false);

  const requestId = useRef(0);

  useEffect(() => {
    if (!focused || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setSearchError("");
      return;
    }

    let active = true;
    const currentRequestId = ++requestId.current;

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");

      try {
        const { data } = await api.get("/hsn-sac/search", {
          params: {
            q: query.trim(),
            limit: 12,
          },
        });

        if (!active || currentRequestId !== requestId.current) {
          return;
        }

        const list = Array.isArray(data) ? data : data?.results;

        setResults(Array.isArray(list) ? list : []);
      } catch (error) {
        if (!active || currentRequestId !== requestId.current) {
          return;
        }

        setResults([]);

        setSearchError(
          error.response?.data?.message || "HSN/SAC search unavailable",
        );
      } finally {
        if (active && currentRequestId === requestId.current) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [focused, query]);

  const handleSelect = (item) => {
    onChange(item);
    setQuery("");
    setResults([]);
    setFocused(false);
  };

  const manuallySearching = query.trim().length >= 2;

  const visibleItems = (manuallySearching ? results : suggestions).filter(
    (item) => /^\d{4,8}$/.test(String(item?.code ?? "")),
  );

  const busy = manuallySearching ? loading : suggestionLoading;

  const issue = manuallySearching ? searchError : suggestionError;

  return (
    <div className="relative z-20 min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <Hash size={16} />
        HSN / SAC Code
      </label>

      <input
        type="text"
        autoComplete="off"
        value={focused ? query : value || ""}
        placeholder="Type HSN code or description..."
        onFocus={() => {
          setQuery("");
          setFocused(true);
        }}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setFocused(false);
          }
        }}
        onBlur={() => {
          /*
           * Result button click register hone ke liye
           * dropdown ko thodi delay se close karna hai.
           */
          setTimeout(() => {
            setFocused(false);
          }, 180);
        }}
        className={`input ${error ? "input-error" : ""}`}
      />

      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {focused &&
        (manuallySearching || busy || issue || visibleItems.length > 0) && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[100] max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {busy && (
              <p className="p-3 text-xs text-blue-600 dark:text-blue-400">
                Searching HSN/SAC...
              </p>
            )}

            {issue && (
              <p className="p-3 text-xs text-amber-600 dark:text-amber-400">
                {issue}
              </p>
            )}

            {!busy && !issue && visibleItems.length === 0 && (
              <p className="p-3 text-xs text-slate-500 dark:text-slate-400">
                No matches found. Try another code or description.
              </p>
            )}

            {!busy &&
              visibleItems.map((item) => (
                <button
                  key={
                    item.id ?? `${item.type}-${item.code}-${item.description}`
                  }
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-300">
                    {item.type} {item.code}
                  </span>

                  <span className="min-w-0 flex-1">{item.description}</span>

                  <span className="shrink-0 font-medium text-emerald-700 dark:text-emerald-300">
                    {item.gst_rate == null || item.gst_rate === ""
                      ? "GST —"
                      : `GST ${Number(item.gst_rate)}%`}
                  </span>
                </button>
              ))}
          </div>
        )}
    </div>
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
  disabled = false,
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
        disabled={disabled}
        className={`input ${error ? "input-error" : ""} ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
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

function ProductSelect({
  products,
  value,
  canAddProduct = false,
  stockKinds = {},
  onChange,
}) {
  const productOptions = products
    .filter((product) => {
      const qty = Number(product.quantity);

      // No stock info available -> keep product visible as before.
      if (
        product.quantity === undefined ||
        product.quantity === null ||
        product.quantity === "" ||
        !Number.isFinite(qty) ||
        qty > 0
      ) {
        return true;
      }

      // Keep the currently selected product visible.
      if (String(product.id) === String(value)) return true;

      // Zero stock: hide simple products, keep variant products.
      const kind = stockKinds[String(product.id)];
      return kind === "variant" || kind === "error";
    })
    .map((product) => {
      const qty = Number(product.quantity);
      const hasStock =
        product.quantity !== undefined &&
        product.quantity !== null &&
        product.quantity !== "" &&
        Number.isFinite(qty) &&
        qty > 0;

      const baseSubtitle = product.branch_name
        ? `${product.branch_name}${product.sku ? ` • ${product.sku}` : ""}`
        : product.sku || "No SKU";

      return {
        value: String(product.id),
        title: product.product_name || product.name || "Unnamed Product",
        subtitle: hasStock
          ? `${baseSubtitle} • Stock: ${qty}${
              product.unit_type ? ` ${product.unit_type}` : ""
            }`
          : baseSubtitle,
      };
    });

  return (
    <SearchableDropdown
      value={value}
      placeholder="Select Product"
      searchPlaceholder="Search product..."
      emptyText="No product found"
      options={productOptions}
      wrapSubtitle
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
  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md ${
        topMost ? "z-[60000]" : "z-[50000]"
      }`}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/40 dark:text-blue-300">
              {icon || <FileText size={21} />}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-6 dark:bg-slate-950/20">
          {children}
        </div>
      </div>
    </div>,
    document.body,
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
  wide = false,
  wrapSubtitle = false,
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
    const dropdownHeight = wide ? 290 : 330;
    const shouldOpenUp =
      spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    const width = wide ? Math.min(300, window.innerWidth - 24) : rect.width;
    const left = wide
      ? Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
      : rect.left;

    setDropdownStyle({
      position: "fixed",
      left,
      width,
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
  }, [open, wide]);

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
                <p
                  className={`${wide ? "whitespace-normal break-words" : "truncate"} text-sm font-semibold text-slate-800 dark:text-slate-100`}
                >
                  {option.title}
                </p>

                {option.subtitle && (
                  <p
                    className={`${wide || wrapSubtitle ? "whitespace-normal break-words" : "truncate"} text-xs font-medium text-slate-500 dark:text-slate-400`}
                  >
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

  const addTaxOption = options.find((option) => option.value === "__add_tax__");

  const regularOptions = options.filter(
    (option) => option.value !== "__add_tax__",
  );

  const selected = regularOptions.find(
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

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
  };

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
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="max-h-60 overflow-y-auto">
            {regularOptions.map((option) => {
              const active = String(value) === String(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
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

          {addTaxOption && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelect(addTaxOption.value)}
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                <Plus size={16} />

                {addTaxOption.label.replace(/^\+\s*/, "")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CreateQuotation;
