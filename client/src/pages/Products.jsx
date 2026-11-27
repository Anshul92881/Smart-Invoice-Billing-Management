import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import {
  Package,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Barcode,
  FileText,
  IndianRupee,
  Percent,
  Boxes,
  Tag,
  Pencil,
  Search,
  X,
  Building2,
  Eye,
  Phone,
  BadgePercent,
  MapPin,
  Plus,
  Save,
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
const makeAttribute = () => ({ name: "", values: "" });
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
const asVariantAttributes = (value) => {
  if (typeof value === "string") {
    try {
      return asVariantAttributes(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
};
// Product detail and the variant list can return different response envelopes.
const readVariantList = (body, allowBareList = false) => {
  const lists = [
    body?.variants,
    body?.data?.variants,
    body?.product?.variants,
    body?.data?.product?.variants,
    ...(allowBareList ? [body, body?.data, body?.rows, body?.data?.rows] : []),
  ].filter(Array.isArray);
  return lists.find((items) => items.length > 0) ?? lists[0];
};

const getSavedVariants = async (product) => {
  const url = `/products/${product.id}`;
  let detailList;
  let detailCount;
  try {
    const { data } = await api.get(url);
    detailList = readVariantList(data);
    detailCount = Number(
      data?.product?.variant_count ??
        data?.data?.product?.variant_count ??
        data?.data?.variant_count ??
        data?.variant_count ??
        0,
    );
    if (detailList?.length) return detailList;
  } catch (error) {
    // Only try the alternate route when this route is unavailable.
    if (![404, 405].includes(error.response?.status)) throw error;
  }

  const expected = Math.max(
    Number(product.variant_count) || 0,
    detailCount || 0,
  );
  try {
    const { data } = await api.get(`${url}/variants`);
    const list = readVariantList(data, true);
    if (list && (list.length || !expected)) return list;
  } catch (error) {
    if (
      detailList &&
      !expected &&
      [404, 405].includes(error.response?.status)
    ) {
      return detailList;
    }
    throw error;
  }

  throw new Error("The server did not return the saved product variants.");
};

const activeVariantQuantity = (items) =>
  items.reduce(
    (sum, item) =>
      sum + (item.status === "active" ? Number(item.quantity) || 0 : 0),
    0,
  );

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

const LOW_STOCK_LIMIT = 10;
// Same rule as the product list API: active products, active variants, <= 10.
function isLowStockProduct(product) {
  if ((product.status || "active") !== "active") return false;
  return Number(product.variant_count || 0) > 0
    ? Number(product.low_stock_variant_count || 0) > 0
    : Number(product.quantity || 0) <= LOW_STOCK_LIMIT;
}

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
  const [showLowStock, setShowLowStock] = useState(false);
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
  const [branchFilter, setBranchFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [saving, setSaving] = useState(false);
  const [variantMode, setVariantMode] = useState(false);
  const [attributes, setAttributes] = useState([makeAttribute()]);
  const [variants, setVariants] = useState([]);
  const [variantMessage, setVariantMessage] = useState("");
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [hsnSuggestions, setHsnSuggestions] = useState([]);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnError, setHsnError] = useState("");
  const [hsnSearched, setHsnSearched] = useState(false);
  const [hsnSelected, setHsnSelected] = useState(false);
  const [selectedHsnDetails, setSelectedHsnDetails] = useState(null);
  // Track auto-filled rates so manual rates are never silently overwritten.
  const autoFilledGstRef = useRef(false);

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

  const fetchData = async () => {
    try {
      const taxEndpoint =
        user?.role === "sales_user" ? "/taxes/dropdown" : "/taxes";

      const [productRes, taxRes, branchRes] = await Promise.all([
        api.get("/products", {
          params: {
            search: search.trim() || undefined,
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
  }, []);

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))];
  }, [products]);

  const stats = useMemo(() => {
    const active = products.filter(
      (product) => (product.status || "active") === "active",
    ).length;

    const inactive = products.length - active;

    const lowStock = products.filter(isLowStockProduct).length;

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
      const matchesSearch =
        !keyword ||
        product.product_name?.toLowerCase().includes(keyword) ||
        product.sku?.toLowerCase().includes(keyword) ||
        product.hsn_sac_code?.toLowerCase().includes(keyword) ||
        product.category?.toLowerCase().includes(keyword) ||
        product.branch_name?.toLowerCase().includes(keyword) ||
        product.branch_code?.toLowerCase().includes(keyword) ||
        product.tax_name?.toLowerCase().includes(keyword);

      const matchesBranch =
        branchFilter === "all" ||
        String(product.branch_id || "") === String(branchFilter);

      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || (product.status || "active") === statusFilter;

      return matchesSearch && matchesBranch && matchesCategory && matchesStatus;
    });
  }, [products, search, branchFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, branchFilter, categoryFilter, statusFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => b.id - a.id);
  }, [filteredProducts]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;

    return sortedProducts.slice(start, start + itemsPerPage);
  }, [sortedProducts, currentPage, itemsPerPage]);

  // Keep requests limited to the visible page (not all 1000 products).
  const [visibleVariantStock, setVisibleVariantStock] = useState({});
  useEffect(() => {
    let live = true;
    setVisibleVariantStock({});
    Promise.allSettled(
      paginatedProducts.map(async (product) => ({
        id: product.id,
        variants: await getSavedVariants(product),
      })),
    ).then((results) => {
      if (!live) return;
      const next = {};
      results.forEach((result, index) => {
        const id = paginatedProducts[index].id;
        next[id] =
          result.status === "fulfilled"
            ? {
                count: result.value.variants.length,
                quantity: activeVariantQuantity(result.value.variants),
              }
            : { error: true };
      });
      setVisibleVariantStock(next);
    });
    return () => {
      live = false;
    };
  }, [paginatedProducts]);

  const getSelectedTax = (taxId) => {
    return taxes.find((tax) => Number(tax.id) === Number(taxId));
  };

  // Product-name suggestions run independently of the manual HSN picker.
  // Do not guess/select a classification without user confirmation.
  useEffect(() => {
    if (!showFormModal || hsnSelected) {
      setHsnSuggestions([]);
      setHsnError("");
      setHsnSearched(false);
      return;
    }
    const name = cleanString(formData.product_name);
    if (name.length < 3) {
      setHsnSuggestions([]);
      setHsnError("");
      setHsnLoading(false);
      setHsnSearched(false);
      return;
    }
    let live = true;
    setHsnLoading(true);
    setHsnSearched(false);
    setHsnSuggestions([]);
    setHsnError("");
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/hsn-sac/suggest", {
          params: { product_name: name, limit: 20 },
        });
        if (live) {
          setHsnSuggestions(
            Array.isArray(data?.suggestions)
              ? data.suggestions
              : Array.isArray(data)
                ? data
                : [],
          );
          setHsnSearched(true);
        }
      } catch (err) {
        if (live) {
          setHsnSuggestions([]);
          setHsnError(
            err.response?.data?.message ||
              "HSN suggestions unavailable. Check the API request.",
          );
          setHsnSearched(true);
        }
      } finally {
        if (live) setHsnLoading(false);
      }
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [formData.product_name, showFormModal, hsnSelected]);

  const selectHsn = (item) => {
    // Store the selected search result, not just its code, for rate preview.
    const code = String(item?.code ?? "");
    const confirmedCode = /^\d{4,8}$/.test(code) ? code : "";
    const hasRate =
      item?.gst_rate !== null &&
      item?.gst_rate !== undefined &&
      item?.gst_rate !== "" &&
      Number.isFinite(Number(item.gst_rate));

    setSelectedHsnDetails(confirmedCode ? item : null);
    setHsnSelected(Boolean(confirmedCode));
    setHsnSuggestions([]);

    setFormData((prev) => {
      const shouldFill =
        confirmedCode &&
        hasRate &&
        !prev.tax_id &&
        (prev.tax_rate === "" || autoFilledGstRef.current);

      // When changing from an auto-filled code to one without a rate,
      // remove that outdated auto-fill instead of implying it is applicable.
      const clearOldAuto =
        autoFilledGstRef.current && !prev.tax_id && !shouldFill;
      autoFilledGstRef.current = Boolean(shouldFill);

      return {
        ...prev,
        hsn_sac_code: confirmedCode,
        ...(shouldFill
          ? { tax_rate: String(Number(item.gst_rate)) }
          : clearOldAuto
            ? { tax_rate: "" }
            : {}),
      };
    });
    setErrors((prev) => ({ ...prev, hsn_sac_code: "", tax_rate: "" }));
  };

  const hasMappedGst = Boolean(
    selectedHsnDetails &&
    selectedHsnDetails.gst_rate !== null &&
    selectedHsnDetails.gst_rate !== undefined &&
    selectedHsnDetails.gst_rate !== "" &&
    Number.isFinite(Number(selectedHsnDetails.gst_rate)),
  );

  const selectedTaxOption = formData.tax_id
    ? String(formData.tax_id)
    : hasMappedGst && autoFilledGstRef.current
      ? "__hsn_mapped__"
      : "";

  const handleTaxRuleSelection = (value) => {
    if (value === "__hsn_mapped__") {
      if (!hasMappedGst) return;
      autoFilledGstRef.current = true;
      setFormData((prev) => ({
        ...prev,
        tax_id: "",
        tax_rate: String(Number(selectedHsnDetails.gst_rate)),
      }));
      setErrors((prev) => ({ ...prev, tax_id: "", tax_rate: "" }));
      return;
    }

    if (value === "") {
      autoFilledGstRef.current = false;
      setFormData((prev) => ({ ...prev, tax_id: "", tax_rate: "" }));
      setErrors((prev) => ({ ...prev, tax_id: "", tax_rate: "" }));
      return;
    }

    // Keep the existing Add Tax and manual Tax Rule behavior unchanged.
    handleChange({ target: { name: "tax_id", value } });
  };

  const generateVariants = () => {
    setVariantMessage("");
    if (!attributes.length || attributes.length > 10) {
      setVariantMessage("Add 1–10 attributes.");
      return;
    }
    const parsed = [];
    const names = new Set();
    for (const attr of attributes) {
      const name = cleanString(attr.name);
      const values = [
        ...new Set(attr.values.split(",").map(cleanString).filter(Boolean)),
      ];
      if (
        !name ||
        name.length > 50 ||
        !values.length ||
        values.some((v) => v.length > 100)
      ) {
        setVariantMessage(
          "Enter each attribute name and comma-separated values.",
        );
        return;
      }
      if (names.has(name.toLowerCase())) {
        setVariantMessage("Attribute names must be unique.");
        return;
      }
      names.add(name.toLowerCase());
      parsed.push({ name, values });
    }
    let combinations = [{}];
    for (const attr of parsed) {
      combinations = combinations.flatMap((entry) =>
        attr.values.map((value) => ({ ...entry, [attr.name]: value })),
      );
      if (combinations.length > 60) {
        setVariantMessage(
          "Maximum 60 combinations per product for this editor.",
        );
        return;
      }
    }
    const existing = new Map(
      variants.map((v) => [canonicalAttributes(v.attributes), v]),
    );
    const next = combinations.map(
      (entry) => existing.get(canonicalAttributes(entry)) || makeVariant(entry),
    );
    const missingSaved = variants.filter(
      (v) => v.id && !next.some((n) => n.id === v.id),
    );
    if (missingSaved.length) {
      setVariantMessage(
        "Some saved variants are outside these combinations. Edit attributes or deactivate those variants separately; existing records were preserved.",
      );
      return;
    }
    setVariants(next);
  };

  const validateVariants = () => {
    if (!variantMode) return true;
    if (!variants.length) {
      setVariantMessage("Generate at least one variant.");
      return false;
    }
    const skus = new Set();
    for (const v of variants) {
      const sku = normalizeUpper(v.sku);
      const price = Number(v.unit_price);
      const qty = Number(v.quantity);
      if (!SKU_REGEX.test(sku)) {
        setVariantMessage(
          "Each variant needs a unique valid SKU (2–50 characters).",
        );
        return false;
      }
      if (skus.has(sku) || sku === normalizeUpper(formData.sku)) {
        setVariantMessage("Duplicate SKU found in variants or parent product.");
        return false;
      }
      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99999999.99 ||
        !/^\d+(\.\d{1,2})?$/.test(String(v.unit_price))
      ) {
        setVariantMessage(
          `Invalid price for ${sku}. Use a positive amount with up to 2 decimals.`,
        );
        return false;
      }
      if (
        !Number.isSafeInteger(qty) ||
        qty < 0 ||
        String(v.quantity).trim() === ""
      ) {
        setVariantMessage(`Invalid stock for ${sku}.`);
        return false;
      }
      skus.add(sku);
    }
    setVariantMessage("");
    return true;
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
    } else if (unitPrice <= 0 && !variantMode) {
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

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0 && validateVariants();
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

      const selectedTaxHsn = normalizeUpper(selectedTax?.hsn_sac_code || "");

      autoFilledGstRef.current = false;

      setFormData((prev) => ({
        ...prev,
        tax_id: value,
        tax_rate: selectedTax?.tax_percentage ?? "",
        hsn_sac_code: selectedTaxHsn || prev.hsn_sac_code,
      }));

      if (selectedTaxHsn) {
        setHsnSelected(true);
        setSelectedHsnDetails(null);
        setHsnSuggestions([]);
        setHsnSearched(false);
        setHsnError("");
      }

      setErrors((prev) => ({
        ...prev,
        tax_id: "",
        tax_rate: "",
        hsn_sac_code: "",
      }));

      return;
    }

    let nextValue = value;

    if (name === "sku") {
      nextValue = value.toUpperCase();
    }

    // A changed product name invalidates its previously confirmed HSN.
    // Do not mark the HSN as selected just because somebody is typing.
    if (name === "product_name" && value !== formData.product_name) {
      setHsnSelected(false);
      setHsnSuggestions([]);
      setHsnSearched(false);
      setHsnError("");
      setSelectedHsnDetails(null);
    }
    const clearAutoRate =
      name === "product_name" &&
      value !== formData.product_name &&
      autoFilledGstRef.current &&
      !formData.tax_id;
    if (name === "tax_rate" || name === "product_name") {
      autoFilledGstRef.current = false;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "product_name" && value !== prev.product_name
        ? { hsn_sac_code: "", ...(clearAutoRate ? { tax_rate: "" } : {}) }
        : {}),
    }));

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

      if (selectedTaxId && Number(selectedTax?.is_active) === 1) {
        const selectedTaxHsn = normalizeUpper(
          selectedTax?.hsn_sac_code || payload.hsn_sac_code || "",
        );

        setFormData((prev) => ({
          ...prev,
          tax_id: String(selectedTaxId),
          tax_rate: selectedTax?.tax_percentage ?? payload.tax_percentage,
          hsn_sac_code: selectedTaxHsn || prev.hsn_sac_code,
        }));

        if (selectedTaxHsn) {
          setHsnSelected(true);
          setSelectedHsnDetails(null);
          setHsnSuggestions([]);
          setHsnSearched(false);
          setHsnError("");
        }
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

  const resetForm = () => {
    setFormData({
      ...initialForm,
      branch_id: getDefaultBranchId(),
    });
    setErrors({});
    setEditId(null);
    setVariantMode(false);
    setAttributes([makeAttribute()]);
    setVariants([]);
    setVariantMessage("");
    setLoadingVariants(false);
    setHsnSuggestions([]);
    setHsnSelected(false);
    setSelectedHsnDetails(null);
    autoFilledGstRef.current = false;
    setHsnError("");
    setHsnSearched(false);
  };

  const openCreateModal = () => {
    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = async (product) => {
    if (!canManageProducts) {
      toast.error("Product permission required");
      return;
    }

    resetForm();
    setEditId(product.id);
    setErrors({});
    setHsnSelected(true);
    autoFilledGstRef.current = false;
    setSelectedHsnDetails(null);

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

    setShowFormModal(true);
    setLoadingVariants(true);
    try {
      const list = await getSavedVariants(product);
      setVariants(
        list.map((v) => makeVariant(asVariantAttributes(v.attributes), v)),
      );
      setVariantMode(list.length > 0);
      if (list.length) {
        const values = {};
        for (const v of list) {
          for (const [key, value] of Object.entries(
            asVariantAttributes(v.attributes),
          )) {
            values[key] ||= new Set();
            values[key].add(value);
          }
        }
        setAttributes(
          Object.entries(values).map(([name, items]) => ({
            name,
            values: [...items].join(", "),
          })),
        );
      }
    } catch (error) {
      setVariantMessage(
        error.response?.data?.message ||
          "Could not load variants. Saving is disabled until reload.",
      );
      setLoadingVariants("error");
      return;
    }
    setLoadingVariants(false);
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
    quantity: variantMode
      ? 0
      : formData.quantity === ""
        ? 0
        : Number(formData.quantity),
    unit_type: cleanString(formData.unit_type).toLowerCase() || "pcs",
    category: cleanString(formData.category),
    status: cleanString(formData.status).toLowerCase() || "active",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageProducts || saving || loadingVariants) return;
    if (!validateProductForm()) return;
    if (variantMode && editId && Number(formData.quantity || 0) > 0) {
      setVariantMessage(
        "Existing parent stock must be reconciled before enabling variants. No automatic stock migration is performed.",
      );
      return;
    }
    if (variantMode && !editId && formData.status !== "active") {
      setVariantMessage("Create variants for an active product first.");
      return;
    }

    let savedProductId = editId;
    let parentSaved = false;
    let synced = 0;
    try {
      setSaving(true);
      const payload = buildProductPayload();
      if (variantMode) {
        const minPrice = Math.min(...variants.map((v) => Number(v.unit_price)));
        payload.unit_price = minPrice;
        payload.quantity = 0;
      }
      if (editId) {
        await api.put(`/products/${editId}`, payload);
      } else {
        const { data } = await api.post("/products", payload);
        savedProductId = data?.product?.id || data?.product_id || data?.id;
        if (!savedProductId)
          throw new Error("Product created but ID missing from API response");
      }
      parentSaved = true;

      if (variantMode) {
        for (const variant of variants) {
          const body = {
            sku: normalizeUpper(variant.sku),
            attributes: variant.attributes,
            unit_price: Number(variant.unit_price),
            quantity: Number(variant.quantity),
            status: variant.status,
          };
          if (variant.id) {
            await api.put(
              `/products/${savedProductId}/variants/${variant.id}`,
              body,
            );
          } else {
            const { data } = await api.post(
              `/products/${savedProductId}/variants`,
              body,
            );
            variant.id = data?.variant_id || null;
          }
          synced++;
        }
      }
      toast.success(editId ? "Product updated" : "Product created");
      closeFormModal();
      await fetchData();
    } catch (error) {
      if (parentSaved) {
        if (!editId && savedProductId) setEditId(savedProductId);
        toast.error(
          `Product saved, but variant sync stopped after ${synced} item(s). ${error.response?.data?.message || error.message || "Please retry."}`,
          { duration: 8000 },
        );
        setVariantMessage(
          "Partial save: keep this window open and retry. Existing completed variants will be updated, not created again.",
        );
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Product save failed",
        );
      }
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

  // Variant pricing/stock are maintained per combination, not on the parent.
  const variantBasePrice = variants.length
    ? Math.min(...variants.map((variant) => Number(variant.unit_price) || 0))
    : 0;
  const variantStock = variants.reduce(
    (total, variant) =>
      total + (variant.status === "active" ? Number(variant.quantity) || 0 : 0),
    0,
  );
  const taxableValue = variantMode
    ? variants.reduce(
        (total, variant) =>
          total +
          (variant.status === "active"
            ? (Number(variant.unit_price) || 0) *
              (Number(variant.quantity) || 0)
            : 0),
        0,
      )
    : Number(formData.unit_price || 0) * Number(formData.quantity || 0);

  const taxAmount = (taxableValue * Number(formData.tax_rate || 0)) / 100;
  const finalValue = taxableValue + taxAmount;

  const hasOpenDialog = Boolean(
    showFormModal || showBranchModal || showTaxModal,
  );
  useEffect(() => {
    if (!hasOpenDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [hasOpenDialog]);

  return (
    <div className="products-workspace w-full min-w-0 space-y-5 text-[15px] text-slate-700 dark:text-slate-200">
      {showLowStock && (
        <LowStockModal
          products={products.filter(isLowStockProduct)}
          onClose={() => setShowLowStock(false)}
        />
      )}
      {!viewProduct ? (
        <>
          <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-sm text-slate-400">Business / Products</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Products
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Manage your product catalogue, pricing, GST and stock.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManageProducts && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus size={17} />
                  Add Product
                </button>
              )}
            </div>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Total Products",
                stats.total,
                Package,
                "bg-blue-50 text-blue-600",
              ],
              [
                "Active Products",
                stats.active,
                CheckCircle2,
                "bg-emerald-50 text-emerald-600",
              ],
              [
                "Low Stock",
                stats.lowStock,
                Boxes,
                "bg-violet-50 text-violet-600",
              ],
              [
                "Inactive Products",
                stats.inactive,
                XCircle,
                "bg-amber-50 text-amber-600",
              ],
            ].map(([title, value, Icon, color]) => (
              <StatsCard
                key={title}
                title={title}
                value={value}
                icon={<Icon size={20} />}
                color={color}
                onClick={
                  title === "Low Stock"
                    ? () => setShowLowStock(true)
                    : undefined
                }
              />
            ))}
          </div>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pt-4 dark:border-slate-800">
              <div
                className="flex gap-5 overflow-x-auto"
                role="tablist"
                aria-label="Product status"
              >
                {[
                  ["all", "All Products"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                    className={`whitespace-nowrap border-b-2 pb-4 text-sm font-medium transition ${statusFilter === value ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Refresh products"
                onClick={() => fetchData()}
                className="mb-3 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  aria-label="Search products"
                  placeholder="Search by product, SKU, HSN/SAC or branch…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 lg:flex">
                <CustomDropdown
                  label="Filter by branch"
                  value={branchFilter}
                  onChange={setBranchFilter}
                  icon={<Building2 size={15} />}
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
                  label="Filter by category"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  icon={<Tag size={15} />}
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
            <ProductTable
              products={paginatedProducts}
              variantStockById={visibleVariantStock}
              canManage={canManageProducts}
              onView={setViewProduct}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />

            <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center">
              <span>
                Showing{" "}
                {sortedProducts.length
                  ? (currentPage - 1) * itemsPerPage + 1
                  : 0}
                –{Math.min(currentPage * itemsPerPage, sortedProducts.length)}{" "}
                of {sortedProducts.length} products
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  Rows
                  <select
                    aria-label="Rows per page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="!font-normal rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 dark:border-slate-700"
                  >
                    {[10, 20, 50, 100].map((count) => (
                      <option className="!font-normal" key={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-700"
                >
                  <ChevronLeft size={15} />
                </button>
                <span>
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-700"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <ProductDetail
          key={viewProduct.id}
          product={
            products.find((item) => item.id === viewProduct.id) || viewProduct
          }
          onClose={() => setViewProduct(null)}
          onEdit={canManageProducts ? openEditModal : undefined}
        />
      )}

      {showFormModal && (
        <FormModal
          title={editId ? "Update Product" : "Add Product"}
          description="Fill product details, GST mapping and stock information."
          icon={<Package size={22} />}
          onClose={closeFormModal}
        >
          <ProductForm
            formData={formData}
            errors={errors}
            taxes={taxes}
            branches={branches}
            editId={editId}
            saving={saving}
            taxableValue={taxableValue}
            taxAmount={taxAmount}
            finalValue={finalValue}
            canManageBranches={canManageBranches}
            canManageTaxes={canManageTaxes}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            variantMode={variantMode}
            variantBasePrice={variantBasePrice}
            variantStock={variantStock}
            onVariantModeChange={(value) => {
              if (!value && variants.some((v) => v.id)) {
                setVariantMessage(
                  "Deactivate saved variants individually before switching back to Single Product.",
                );
                return;
              }
              setVariantMode(value);
              setVariantMessage("");
            }}
            attributes={attributes}
            setAttributes={setAttributes}
            variants={variants}
            setVariants={setVariants}
            generateVariants={generateVariants}
            variantMessage={variantMessage}
            loadingVariants={loadingVariants}
            hsnSuggestions={hsnSuggestions}
            hsnLoading={hsnLoading}
            hsnError={hsnError}
            hsnSearched={hsnSearched}
            hsnSelected={hsnSelected}
            selectedHsnDetails={selectedHsnDetails}
            selectedTaxOption={selectedTaxOption}
            onTaxRuleSelection={handleTaxRuleSelection}
            onSelectHsn={selectHsn}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {showBranchModal && (
        <FormModal
          nested
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
          nested
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
        .products-workspace .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 400;
          outline: none;
          background: #ffffff;
          color: #334155;
        }

        .products-workspace .input::placeholder {
          color: #94a3b8;
        }

        .products-workspace .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }

        .products-workspace .input-error {
          border-color: #f87171 !important;
        }

        .products-workspace .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px #fee2e2 !important;
        }

        .dark .products-workspace .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }

        .dark .products-workspace .input::placeholder {
          color: #64748b;
        }

        .dark .products-workspace .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }

        .dark .products-workspace .input-error {
          border-color: #f87171 !important;
        }

        .dark .products-workspace .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25) !important;
        }
      `}</style>
    </div>
  );
}

// Shared HSN/SAC field for Product and Tax Rule forms.
// Product-name matches and manual searches are suggestions, not GST rate mappings.
function HsnSacPicker({
  value = "",
  onChange,
  error,
  suggestions = [],
  suggestionLoading = false,
  suggestionError = "",
  hint,
  disabled = false,
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
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const { data } = await api.get("/hsn-sac/search", {
          params: { q: query.trim(), limit: 12 },
        });
        if (!active || id !== requestId.current) return;
        const list = Array.isArray(data) ? data : data?.results;
        setResults(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!active || id !== requestId.current) return;
        setResults([]);
        setSearchError(
          err.response?.data?.message || "HSN/SAC search unavailable",
        );
      } finally {
        if (active && id === requestId.current) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [focused, query]);

  const select = (item) => {
    onChange(item);
    setQuery("");
    setResults([]);
    setFocused(false);
  };

  const searching = query.trim().length >= 2;
  const items = (searching ? results : suggestions).filter((item) =>
    /^\d{4,8}$/.test(String(item?.code ?? "")),
  );
  const busy = searching ? loading : suggestionLoading;
  const issue = searching ? searchError : suggestionError;

  return (
    <div className="relative z-20 min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <Hash size={16} /> HSN / SAC Code
      </label>
      <input
        type="text"
        autoComplete="off"
        value={focused ? query : value || ""}
        placeholder={
          disabled ? "Selected HSN/SAC code" : "Type HSN code or description..."
        }
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;

          setQuery("");
          setFocused(true);
        }}
        onChange={(e) => {
          if (disabled) return;

          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setFocused(false);
          }
        }}
        onBlur={() => {
          setTimeout(() => setFocused(false), 180);
        }}
        className={`input relative z-10 ${error ? "input-error" : ""} ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-600 opacity-80 dark:bg-slate-800 dark:text-slate-300"
            : ""
        }`}
      />
      {hint && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {focused && (searching || busy || issue || items.length > 0) && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[100] max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {busy && (
            <p className="p-3 text-xs text-blue-600">Searching HSN/SAC...</p>
          )}
          {issue && <p className="p-3 text-xs text-amber-600">{issue}</p>}
          {!busy && !issue && items.length === 0 && (
            <p className="p-3 text-xs text-slate-500">
              No matches found. Try a different code or keyword.
            </p>
          )}
          {!busy &&
            items.map((item) => (
              <button
                key={item.id ?? `${item.type}-${item.code}-${item.description}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="shrink-0 font-semibold">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
          icon={<FileText size={16} />}
          label="HSN / SAC Code"
          name="hsn_sac_code"
          value={taxForm.hsn_sac_code}
          onChange={handleTaxChange}
          error={taxErrors.hsn_sac_code}
          placeholder="Enter 4 to 8 digit code"
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

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-3">
          <input
            type="checkbox"
            name="reverse_charge"
            checked={Boolean(taxForm.reverse_charge)}
            onChange={handleTaxChange}
          />
          Reverse Charge
        </label>

        <div className="md:col-span-4">
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

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateTax}
          disabled={taxLoading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <div className="md:col-span-2">
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

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateBranch}
          disabled={branchLoading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
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
  disabled = false,
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
        disabled={disabled}
        className={`input ${error ? "input-error" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
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
  variantStockById,
  canManage,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1120px] table-auto text-left text-[15px]">
        <thead className="bg-blue-50 text-sm tracking-wide text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
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
                scope="col"
                className="whitespace-nowrap px-5 py-4 text-left text-sm font-semiboldS"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {products.map((product) => (
            <tr
              key={product.id}
              className="transition hover:bg-blue-50/30 dark:hover:bg-slate-800/40"
            >
              <td className="whitespace-nowrap px-5 py-4 text-left">
                <button
                  type="button"
                  onClick={() => onView(product)}
                  className="flex max-w-[240px] items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Package size={19} />
                  </div>

                  <div className="min-w-0 max-w-[200px] text-left">
                    <p className="truncate text-10px font-medium text-slate-700 hover:text-blue-600 dark:text-slate-100">
                      {product.product_name || "-"}
                    </p>
                    <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1 text-sm text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      <Tag size={13} className="shrink-0" />
                      <span className="truncate">
                        {product.category || "No category"}
                      </span>
                    </span>
                  </div>
                </button>
              </td>

              <td className="px-5 py-4 text-left text-sm">
                <span className="whitespace-nowrap">
                  {product.branch_name || "-"}
                </span>
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left text-slate-600 dark:text-slate-300">
                {product.sku || "-"}
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left text-slate-600 dark:text-slate-300">
                {product.hsn_sac_code || "-"}
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left font-medium tabular-nums text-slate-600 dark:text-white">
                ₹ {Number(product.unit_price || 0).toFixed(2)}
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left text-slate-600 dark:text-slate-300">
                <span
                  className="inline-block max-w-[175px] truncate align-middle"
                  title={product.tax_name || ""}
                >
                  {product.tax_name || "-"}
                </span>
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left tabular-nums text-slate-600 dark:text-slate-300">
                {Number(product.tax_rate || 0)}%
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left tabular-nums text-slate-600 dark:text-slate-300">
                {variantStockById[product.id]?.count > 0
                  ? variantStockById[product.id].quantity
                  : Number(product.quantity || 0)}{" "}
                {product.unit_type || ""}
                {isLowStockProduct(product) && (
                  <span className="mt-1 block text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Low Stock
                  </span>
                )}
                {variantStockById[product.id]?.count > 0 && (
                  <span className="block text-sm text-slate-500 dark:text-slate-400">
                    {variantStockById[product.id].count} variants
                  </span>
                )}
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left">
                <StatusBadge status={product.status} />
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-left">
                <div className="flex w-max items-center gap-2">
                  <IconButton
                    label="View product"
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => onView(product)}
                  />

                  {canManage && (
                    <>
                      <IconButton
                        label="Edit product"
                        icon={<Pencil size={16} />}
                        className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                        onClick={() => onEdit(product)}
                      />

                      {product.status !== "inactive" && (
                        <button
                          type="button"
                          onClick={() => onDelete(product)}
                          className="ml-2 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                        >
                          Inactive
                        </button>
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
  saving,
  taxableValue,
  taxAmount,
  finalValue,
  canManageBranches,
  canManageTaxes,
  handleChange,
  handleSubmit,
  onCancel,
  variantMode,
  variantBasePrice,
  variantStock,
  onVariantModeChange,
  attributes,
  setAttributes,
  variants,
  setVariants,
  generateVariants,
  variantMessage,
  loadingVariants,
  hsnSuggestions,
  hsnLoading,
  hsnError,
  hsnSearched,
  hsnSelected,
  selectedHsnDetails,
  selectedTaxOption,
  onTaxRuleSelection,
  onSelectHsn,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
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
              onChange={() => onVariantModeChange(false)}
              disabled={Boolean(loadingVariants) || saving}
              className="h-4 w-4 accent-blue-600"
            />
            Single Product
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="product_type"
              checked={variantMode}
              onChange={() => onVariantModeChange(true)}
              disabled={Boolean(loadingVariants) || saving}
              className="h-4 w-4 accent-blue-600"
            />
            Add Variants Products
          </label>
        </div>
        {variantMessage && !variantMode && (
          <p className="w-full text-xs text-amber-700 dark:text-amber-300">
            {variantMessage}
          </p>
        )}
      </div>
      <Section title="Basic Product Details">
        <div className="relative min-w-0">
          <Input
            icon={<Package size={16} />}
            label="Product Name"
            name="product_name"
            value={formData.product_name}
            onChange={handleChange}
            error={errors.product_name}
            required
          />
          {!hsnSelected && formData.product_name.trim().length >= 3 && (
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
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
                        title={
                          !validCode
                            ? "This is a short heading; choose a 4–8 digit classification code"
                            : undefined
                        }
                        onClick={() => onSelectHsn(item)}
                        className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-300">
                          {item.type} {item.code}
                        </span>
                        <span>
                          {item.description}
                          {!validCode ? " (heading only)" : ""}
                          <span className="ml-2 whitespace-nowrap font-medium text-emerald-700 dark:text-emerald-300">
                            {item.gst_rate == null || item.gst_rate === ""
                              ? "GST not mapped"
                              : `GST ${Number(item.gst_rate)}%`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {!hsnSuggestions.some((item) =>
                    /^\d{4,8}$/.test(String(item.code)),
                  ) && (
                    <p className="px-3 py-2 text-xs text-amber-600">
                      Only broad headings matched. Search a more specific
                      code/description in HSN/SAC.
                    </p>
                  )}
                </div>
              )}
              {hsnSearched &&
                !hsnLoading &&
                !hsnError &&
                hsnSuggestions.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No HSN matches for this name. Try a more descriptive name or
                    search HSN/SAC directly.
                  </p>
                )}
            </div>
          )}
        </div>

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

      <div>
        {variantMode && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Enter Price and Stock for each combination below. Base Price and
              Total Stock are calculated automatically; Invoicing integration is
              not enabled yet.
            </p>
            {attributes.map((attr, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]"
              >
                <input
                  className="input"
                  placeholder="Attribute (Size, Color...)"
                  value={attr.name}
                  onChange={(e) =>
                    setAttributes((old) =>
                      old.map((a, i) =>
                        i === index ? { ...a, name: e.target.value } : a,
                      ),
                    )
                  }
                />
                <input
                  className="input"
                  placeholder="Values, comma separated: S, M, L"
                  value={attr.values}
                  onChange={(e) =>
                    setAttributes((old) =>
                      old.map((a, i) =>
                        i === index ? { ...a, values: e.target.value } : a,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-sm dark:text-white"
                  disabled={attributes.length === 1}
                  onClick={() =>
                    setAttributes((old) => old.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm dark:text-white"
                disabled={attributes.length >= 10}
                onClick={() =>
                  setAttributes((old) => [...old, { name: "", values: "" }])
                }
              >
                + Attribute
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                onClick={generateVariants}
              >
                Generate Combinations
              </button>
            </div>
            {variantMessage && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {variantMessage}
              </p>
            )}
            {loadingVariants && (
              <p className="text-sm text-slate-500">
                {loadingVariants === "error"
                  ? "Could not load variants"
                  : "Loading variants..."}
              </p>
            )}
            {variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b dark:text-white">
                    <tr>
                      <th className="p-2 text-left">Combination</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Price</th>
                      <th className="p-2">Stock</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant, index) => (
                      <tr
                        key={
                          variant.id || canonicalAttributes(variant.attributes)
                        }
                        className="border-b dark:border-slate-700"
                      >
                        <td className="p-2 text-xs dark:text-slate-200">
                          {Object.entries(variant.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" / ")}
                        </td>
                        {["sku", "unit_price", "quantity"].map((field) => (
                          <td key={field} className="p-1">
                            <input
                              className="input"
                              type={field === "sku" ? "text" : "number"}
                              min={field === "quantity" ? "0" : undefined}
                              step={field === "unit_price" ? "0.01" : undefined}
                              value={variant[field]}
                              onChange={(e) =>
                                setVariants((old) =>
                                  old.map((v, i) =>
                                    i === index
                                      ? { ...v, [field]: e.target.value }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </td>
                        ))}
                        <td className="p-1">
                          <select
                            className="input"
                            value={variant.status}
                            onChange={(e) =>
                              setVariants((old) =>
                                old.map((v, i) =>
                                  i === index
                                    ? { ...v, status: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                        <td className="p-1 text-left">
                          <button
                            type="button"
                            disabled={Boolean(variant.id)}
                            title={
                              variant.id
                                ? "For saved variants use Inactive status"
                                : "Remove unsaved variant"
                            }
                            onClick={() =>
                              setVariants((old) =>
                                old.filter((_, i) => i !== index),
                              )
                            }
                            className="text-red-600 disabled:opacity-30"
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
      </div>

      <Section title="Pricing & Tax Details">
        <Field icon={<Percent size={16} />} label="GST / Tax Rule">
          <CustomDropdown
            value={selectedTaxOption}
            onChange={onTaxRuleSelection}
            icon={<Percent size={16} />}
            options={[
              { value: "", label: "Select Tax Rule" },
              ...(selectedHsnDetails?.gst_rate !== null &&
              selectedHsnDetails?.gst_rate !== undefined &&
              selectedHsnDetails?.gst_rate !== "" &&
              Number.isFinite(Number(selectedHsnDetails?.gst_rate))
                ? [
                    {
                      value: "__hsn_mapped__",
                      label: `HSN Mapped GST — ${Number(selectedHsnDetails.gst_rate)}%`,
                    },
                  ]
                : []),
              ...taxes.map((tax) => ({
                value: String(tax.id),
                label: `${tax.tax_name} — ${Number(tax.tax_percentage || 0)}%${
                  tax.hsn_sac_code ? ` — HSN/SAC ${tax.hsn_sac_code}` : ""
                }`,
              })),
              ...(canManageTaxes
                ? [{ value: "__add_tax__", label: "+ Add New Tax Rule" }]
                : []),
            ]}
          />
        </Field>

        <HsnSacPicker
          value={formData.hsn_sac_code}
          onChange={onSelectHsn}
          error={errors.hsn_sac_code}
          suggestions={hsnSuggestions}
          suggestionLoading={hsnLoading}
          suggestionError={hsnError}
          disabled={hsnSelected}
          hint={
            hsnSelected
              ? "HSN/SAC code is locked after selection."
              : "Search and select the correct HSN/SAC classification."
          }
        />

        <Input
          icon={<IndianRupee size={16} />}
          label={
            variantMode
              ? "Base Price (automatically uses lowest variant price)"
              : "Unit Price"
          }
          name="unit_price"
          disabled={variantMode}
          type="number"
          value={
            variantMode
              ? variants.length
                ? String(variantBasePrice)
                : ""
              : formData.unit_price
          }
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
          label={
            variantMode ? "Total Active Variant Stock (calculated)" : "Quantity"
          }
          name="quantity"
          type="number"
          disabled={variantMode}
          value={variantMode ? String(variantStock) : formData.quantity}
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
          disabled={saving || Boolean(loadingVariants)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Saving..." : editId ? "Update Product" : "Add Product"}
        </button>
      </div>
    </form>
  );
}

function ProductDetail({ product, onClose, onEdit }) {
  const backButtonRef = useRef(null);
  const [savedVariants, setSavedVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    setSavedVariants([]);
    getSavedVariants(product)
      .then((items) => {
        if (live) setSavedVariants(items);
      })
      .catch((error) => {
        if (live)
          setLoadError(
            error.response?.data?.message ||
              error.message ||
              "Could not load variants.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [product, attempt]);

  const hasVariants = savedVariants.length > 0;
  const stock = hasVariants
    ? activeVariantQuantity(savedVariants)
    : Number(product.quantity || 0);
  const taxableValue = hasVariants
    ? savedVariants.reduce(
        (sum, item) =>
          sum +
          (item.status === "active"
            ? Number(item.unit_price || 0) * Number(item.quantity || 0)
            : 0),
        0,
      )
    : Number(product.unit_price || 0) * Number(product.quantity || 0);
  const taxAmount = (taxableValue * Number(product.tax_rate || 0)) / 100;
  const finalValue = taxableValue + taxAmount;

  const detailsReady = !loading && !loadError;

  const card =
    "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
  const money = (amount) => `₹ ${Number(amount || 0).toFixed(2)}`;
  const stockLabel = loading
    ? "Loading…"
    : loadError
      ? "Unavailable"
      : `${stock} ${product.unit_type || ""}`;
  const metrics = [
    [
      "Stock",
      stockLabel,
      Boxes,
      "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    ],
    [
      "Taxable Value",
      detailsReady ? money(taxableValue) : "—",
      IndianRupee,
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    ],
    [
      "Tax Amount",
      detailsReady ? money(taxAmount) : "—",
      Percent,
      "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    ],
    [
      "Final Value",
      detailsReady ? money(finalValue) : "—",
      FileText,
      "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
    ],
  ];

  return (
    <div
      aria-label="Product details"
      className="min-w-0 space-y-5 text-slate-900 dark:text-slate-100"
    >
      <button
        ref={backButtonRef}
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft size={16} /> Back to Products
      </button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-slate-500">
            Products / Product Details
          </p>
          <h1 className="break-words text-2xl font-semibold">
            {product.product_name || "Product Details"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Product overview, stock and saved variants
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Pencil size={16} /> Edit Product
          </button>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <Package size={25} />
            </div>
            <h2 className="break-words text-lg font-semibold">
              {product.product_name || "—"}
            </h2>
            <p className="mb-3 mt-1 break-words text-sm text-slate-500">
              {product.category || "No category"}
            </p>
            <StatusBadge status={product.status} />
          </div>
          <div className="space-y-3 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Product Information
            </h3>
            {[
              ["SKU", product.sku],
              ["Branch", product.branch_name],
              ["HSN / SAC", product.hsn_sac_code],
              ["Unit", product.unit_type],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm">{value || "—"}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(([label, value, Icon, tone]) => (
              <div key={label} className={`${card} min-w-0 p-4`}>
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-lg p-2 ${tone}`}>
                    <Icon size={17} />
                  </span>
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
                <p className="mt-3 break-words text-lg font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <section className={card}>
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold dark:border-slate-800">
              Product Overview
            </h2>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              {[
                ["Unit Price", money(product.unit_price)],
                ["GST Rate", `${Number(product.tax_rate || 0)}%`],
                ["Tax Rule", product.tax_name || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-1 break-words font-medium">{value}</p>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800 sm:col-span-3">
                <p className="text-sm text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-line break-words">
                  {product.description || "—"}
                </p>
              </div>
            </div>
          </section>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Product Variants
                {detailsReady && hasVariants
                  ? ` (${savedVariants.length})`
                  : ""}
              </h3>
              {detailsReady && hasVariants && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Active stock: {stock} {product.unit_type || ""}
                </p>
              )}
            </header>
            {loading && (
              <p
                role="status"
                className="p-4 text-sm text-slate-600 dark:text-slate-300"
              >
                Loading variant details…
              </p>
            )}
            {loadError && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-red-700 dark:text-red-300"
              >
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((current) => current + 1)}
                  className="rounded-lg border border-current px-3 py-1.5"
                >
                  Retry
                </button>
              </div>
            )}
            {detailsReady && !hasVariants && (
              <p className="p-4 text-sm text-slate-600 dark:text-slate-300">
                No variants saved for this product.
              </p>
            )}
            {detailsReady && hasVariants && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-[15px]">
                  <thead className="bg-blue-50 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    <tr>
                      {[
                        "Attributes",
                        "SKU",
                        "Unit Price",
                        "Stock",
                        "Status",
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="whitespace-nowrap px-4 py-3 font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {savedVariants.map((variant, index) => (
                      <tr
                        key={variant.id ?? index}
                        className="border-t border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200"
                      >
                        <td className="px-4 py-3">
                          {Object.entries(
                            asVariantAttributes(variant.attributes),
                          )
                            .map(([name, value]) => `${name}: ${value}`)
                            .join(" / ") || "—"}
                        </td>
                        <td className="px-4 py-3">{variant.sku || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {variant.unit_price == null
                            ? "—"
                            : `₹ ${Number(variant.unit_price).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {variant.quantity ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {variant.status ? (
                            <StatusBadge status={variant.status} />
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FormModal({
  title,
  description,
  icon,
  onClose,
  children,
  nested = false,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      const dialogs = document.querySelectorAll("[data-product-dialog]");
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        dialogs[dialogs.length - 1] === dialogRef.current
      ) {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="products-workspace">
      <div
        className={`fixed inset-0 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 ${nested ? "z-[50100]" : "z-[50000]"}`}
      >
        <section
          ref={dialogRef}
          data-product-dialog={nested ? "nested" : "main"}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900 ${nested ? "max-w-3xl" : "max-w-5xl"}`}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:px-7">
            <div className="flex min-w-0 items-start gap-3">
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 sm:flex">
                {icon}
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-sm font-medium uppercase tracking-widest text-slate-400">
                  Product Workspace
                </p>
                <h2 className="break-words text-xl font-semibold text-slate-900 dark:text-white">
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-blue-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-7">
            {children}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }) {
  const descriptions = {
    "Basic Product Details": "Identity, branch, category and HSN/SAC.",
    "Pricing & Tax Details": "Unit price, GST rule and applicable rate.",
  };
  return (
    <section className="grid grid-cols-1 gap-5 border-b border-slate-100 pb-7 dark:border-slate-800 md:grid-cols-[175px_minmax(0,1fr)]">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-5 text-slate-400">
          {descriptions[title] || "Enter the details below."}
        </p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function LowStockModal({ products, onClose }) {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const resultRows = [];
      const failures = [];
      // Small request batches avoid requesting every product simultaneously.
      for (let start = 0; start < products.length; start += 5) {
        if (cancelled) return;
        await Promise.all(
          products.slice(start, start + 5).map(async (product) => {
            if (Number(product.variant_count || 0) === 0) {
              resultRows.push({
                product,
                key: `product-${product.id}`,
                sku: product.sku,
                variant: "Single product",
                quantity: Number(product.quantity || 0),
              });
              return;
            }
            try {
              const variants = await getSavedVariants(product);
              const lowVariants = variants.filter(
                (variant) =>
                  variant.status === "active" &&
                  Number(variant.quantity || 0) <= LOW_STOCK_LIMIT,
              );
              if (!lowVariants.length)
                failures.push(
                  `${product.product_name}: stock changed; refresh product list.`,
                );
              lowVariants.forEach((variant) => {
                const attributes = asVariantAttributes(variant.attributes);
                resultRows.push({
                  product,
                  key: `variant-${product.id}-${variant.id || variant.sku}`,
                  sku: variant.sku,
                  variant:
                    Object.entries(attributes)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" / ") ||
                    variant.variant_name ||
                    "Variant",
                  quantity: Number(variant.quantity || 0),
                });
              });
            } catch {
              failures.push(
                `${product.product_name}: unable to load variants. Close and reopen to retry.`,
              );
            }
          }),
        );
      }
      if (!cancelled) {
        setRows(resultRows);
        setErrors(failures);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [products]);

  return (
    <FormModal
      title="Low Stock Products"
      description={`Active stock at or below ${LOW_STOCK_LIMIT} units; each low-stock variant is listed separately.`}
      icon={<Boxes size={22} />}
      onClose={onClose}
    >
      {loading ? (
        <p role="status" className="py-8 text-center text-slate-500">
          Loading stock details…
        </p>
      ) : (
        <>
          {errors.length > 0 && (
            <div
              role="alert"
              className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
            >
              {errors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                <tr>
                  {[
                    "Product",
                    "Variant / SKU",
                    "Branch",
                    "Available Stock",
                    "Low-stock Limit",
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap p-4 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="p-4 font-medium">
                      {row.product.product_name || "—"}
                    </td>
                    <td className="p-4">
                      <p>{row.variant}</p>
                      <p className="mt-1 text-slate-500">{row.sku || "—"}</p>
                    </td>
                    <td className="p-4">{row.product.branch_name || "—"}</td>
                    <td className="p-4">
                      <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                        {row.quantity} {row.product.unit_type || ""}
                      </span>
                    </td>
                    <td className="p-4">{LOW_STOCK_LIMIT}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      {errors.length
                        ? "Stock details could not be confirmed."
                        : "No low-stock items found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </FormModal>
  );
}

function StatsCard({ title, value, icon, color, onClick }) {
  const Tag = onClick ? "button" : "div";
  const tone = color.includes("emerald")
    ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-950/40 dark:to-slate-900"
    : color.includes("amber")
      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900 dark:from-amber-950/40 dark:to-slate-900"
      : color.includes("violet")
        ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:border-violet-900 dark:from-violet-950/40 dark:to-slate-900"
        : "border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900 dark:from-blue-950/40 dark:to-slate-900";
  return (
    <Tag
      {...(onClick
        ? { type: "button", onClick, "aria-haspopup": "dialog" }
        : {})}
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm ${tone} `}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${color}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-500">{title}</span>
        <span className="mt-1 block text-2xl font-semibold leading-tight text-slate-900 dark:text-white">
          {value}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">
          {onClick ? "View low-stock details" : "Current product records"}
        </span>
      </span>
    </Tag>
  );
}

// Portaling the menu keeps it out of table and modal scroll containers.
function useDropdownPortal(open, close) {
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [position, setPosition] = useState({ visibility: "hidden" });

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = below < 260 && rect.top > below;
      const width = Math.min(Math.max(rect.width, 185), window.innerWidth - 16);
      const modal = buttonRef.current.closest("[data-product-dialog]");
      const modalLayer =
        modal?.dataset.productDialog === "nested"
          ? 50100
          : modal
            ? 50000
            : 49900;

      setPosition({
        position: "fixed",
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight: Math.max(80, Math.min(340, above ? rect.top - 12 : below)),
        zIndex: modalLayer + 10,
        ...(above
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };
    const outside = (event) => {
      if (
        !buttonRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        close(false);
      }
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(false);
      buttonRef.current?.focus();
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, close]);

  return { buttonRef, panelRef, position };
}

function CustomDropdown({ value, onChange, options, icon, label }) {
  const [open, setOpen] = useState(false);
  const { buttonRef, panelRef, position } = useDropdownPortal(open, setOpen);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        aria-label={label}
        aria-expanded={open}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-[15px] font-normal text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
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

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={position}
            className="overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
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
                        setOpen(false);
                        onChange(option.value);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-normal text-black transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
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
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[15px] font-normal transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
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
          </div>,
          document.body,
        )}
    </div>
  );
}

function BranchSelect({ branches, value, canAddBranch, onChange }) {
  const [open, setOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const closeDropdown = useCallback(() => {
    setOpen(false);
    setBranchSearch("");
  }, []);
  const { buttonRef, panelRef, position } = useDropdownPortal(
    open,
    closeDropdown,
  );

  const selectedBranch = branches.find(
    (branch) => String(branch.id) === String(value),
  );

  const filteredBranches = branches.filter((branch) =>
    `${branch.branch_name || ""} ${branch.branch_code || ""} ${branch.email || ""}`
      .toLowerCase()
      .includes(branchSearch.toLowerCase()),
  );

  const handleSelect = (selectedValue) => {
    closeDropdown();
    onChange(selectedValue);
  };

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-[15px] font-normal text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
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

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={position}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="shrink-0 border-b border-slate-100 p-2 dark:border-slate-800">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[15px] font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
                  <p className="truncate text-[15px] font-normal text-slate-800 dark:text-slate-100">
                    {branch.branch_name || "Unnamed Branch"}
                    {(branch.is_main === true || branch.is_main === 1) &&
                      " • HQ"}
                  </p>

                  <p className="truncate text-sm font-normal text-slate-500 dark:text-slate-400">
                    {branch.branch_code
                      ? `Code: ${branch.branch_code}`
                      : "No branch code"}
                  </p>
                </button>
              ))}

              {filteredBranches.length === 0 && (
                <div className="px-3 py-4 text-center text-[15px] font-normal text-slate-500 dark:text-slate-400">
                  No branch found
                </div>
              )}
            </div>

            {canAddBranch && (
              <div className="shrink-0 border-t border-slate-100 p-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSelect("__add_branch__")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-normal text-black transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <Plus size={16} />
                  Add New Branch
                </button>
              </div>
            )}
          </div>,
          document.body,
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
  disabled = false,
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
        disabled={disabled}
        className={`input ${error ? "input-error" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
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

function IconButton({ icon, label, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 transition ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status = "active" }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium capitalize ${active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {status || "active"}
    </span>
  );
}

export default Products;
