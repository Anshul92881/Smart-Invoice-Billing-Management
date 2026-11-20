import {
  useCallback,
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import Papa from "papaparse";

import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Wallet,
  BadgePercent,
  Users,
  Pencil,
  Trash2,
  StickyNote,
  Landmark,
  Tag,
  Search,
  Eye,
  Plus,
  X,
  Save,
  Filter,
  GitBranch,
  CheckCircle2,
  XCircle,
  Download,
  ChevronDown,
  Globe,
  Hash,
  ArrowLeft,
  FileText,
  Activity,
  CalendarDays,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const BRANCH_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;
const ZIP_REGEX = /^\d{5,6}$/;

const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

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

// Existing customer API calls, permissions and form handlers.
function Customers() {
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const canManageCustomers =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    Boolean(user?.permissions?.customers);

  const canEdit = canManageCustomers;
  const canDelete = canManageCustomers;

  const initialForm = {
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

  const [customers, setCustomers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const customerRequest = useRef(0);
  const customerSaveLock = useRef(false);
  const branchSaveLock = useRef(false);
  const [branches, setBranches] = useState([]);

  const getDefaultBranchId = useCallback(() => {
    const hqBranch = branches.find(
      (branch) => branch.is_main === 1 || branch.is_main === true,
    );

    return hqBranch?.id ? String(hqBranch.id) : "";
  }, [branches]);

  const [formData, setFormData] = useState(initialForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);

  const [errors, setErrors] = useState({});
  const [branchErrors, setBranchErrors] = useState({});

  const [editId, setEditId] = useState(null);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Keep the page locked until both dialogs are closed.
  const hasOpenDialog = showFormModal || showBranchModal;
  useEffect(() => {
    if (!hasOpenDialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOpenDialog]);

  const canManageBranches =
    user?.role === "company_admin" || Boolean(user?.permissions?.branches);

  const fetchCustomers = useCallback(async () => {
    const requestId = ++customerRequest.current;
    setListLoading(true);
    setListError("");
    try {
      const res = await api.get("/customers", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter,
          limit: 1000,
        },
      });

      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.customers || [];
      if (requestId === customerRequest.current)
        setCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      if (requestId === customerRequest.current)
        setListError(
          error.response?.data?.message || "Failed to fetch customers",
        );
    } finally {
      if (requestId === customerRequest.current) setListLoading(false);
    }
  }, [search, statusFilter]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get("/branches", {
        params: {
          status: "active",
          limit: 1000,
        },
      });

      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.branches || [];
      setBranches(list.filter((branch) => branch.status === "active"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch branches");
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const stats = useMemo(() => {
    const active = customers.filter(
      (c) => (c.status || "active") === "active",
    ).length;

    const business = customers.filter(
      (c) => c.customer_type === "business",
    ).length;

    return {
      total: customers.length,
      active,
      inactive: customers.length - active,
      business,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return customers.filter((customer) => {
      const status = customer.status || "active";

      const matchesSearch =
        !keyword ||
        customer.customer_name?.toLowerCase().includes(keyword) ||
        customer.company_name?.toLowerCase().includes(keyword) ||
        customer.email?.toLowerCase().includes(keyword) ||
        customer.phone?.toLowerCase().includes(keyword) ||
        customer.branch_name?.toLowerCase().includes(keyword) ||
        customer.branch_code?.toLowerCase().includes(keyword) ||
        customer.gstin?.toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesBranch =
        branchFilter === "all" ||
        String(customer.branch_id || "") === String(branchFilter);

      const matchesType =
        typeFilter === "all" || customer.customer_type === typeFilter;

      return matchesSearch && matchesStatus && matchesBranch && matchesType;
    });
  }, [customers, search, statusFilter, branchFilter, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, branchFilter, typeFilter]);

  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => b.id - a.id);
  }, [filteredCustomers]);

  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedCustomers.slice(start, start + itemsPerPage);
  }, [sortedCustomers, currentPage, itemsPerPage]);

  const validateCustomerForm = () => {
    const nextErrors = {};

    const customerName = cleanString(formData.customer_name);
    const companyName = cleanString(formData.company_name);
    const customerEmail = normalizeEmail(formData.email);
    const phone = cleanString(formData.phone);
    const gstin = normalizeUpper(formData.gstin);
    const customerType = cleanString(formData.customer_type).toLowerCase();
    const currency = normalizeUpper(formData.currency);
    const openingBalance = toNumber(formData.opening_balance);
    const creditLimit = toNumber(formData.credit_limit);
    const paymentTerms = cleanString(formData.payment_terms);
    const customerGroup = cleanString(formData.customer_group);
    const status = cleanString(formData.status).toLowerCase();

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

    if (!customerEmail) {
      nextErrors.email = "Customer email is required";
    } else if (!EMAIL_REGEX.test(customerEmail)) {
      nextErrors.email = "Please enter a valid customer email";
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone must be a valid 10 digit Indian mobile number";
    }

    if (gstin && !GST_REGEX.test(gstin)) {
      nextErrors.gstin = "Invalid GST number format";
    }

    if (!["business", "individual"].includes(customerType)) {
      nextErrors.customer_type = "Customer type must be business or individual";
    }

    if (!ALLOWED_CURRENCIES.includes(currency)) {
      nextErrors.currency = `Currency must be one of: ${ALLOWED_CURRENCIES.join(
        ", ",
      )}`;
    }

    if (Number.isNaN(openingBalance)) {
      nextErrors.opening_balance = "Opening balance must be a valid number";
    } else if (openingBalance < 0) {
      nextErrors.opening_balance = "Opening balance cannot be negative";
    }

    if (Number.isNaN(creditLimit)) {
      nextErrors.credit_limit = "Credit limit must be a valid number";
    } else if (creditLimit < 0) {
      nextErrors.credit_limit = "Credit limit cannot be negative";
    }

    if (paymentTerms.length > 100) {
      nextErrors.payment_terms =
        "Payment terms must be less than 100 characters";
    }

    if (customerGroup.length > 100) {
      nextErrors.customer_group =
        "Customer group must be less than 100 characters";
    }

    if (!["active", "inactive"].includes(status)) {
      nextErrors.status = "Status must be active or inactive";
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

  const handleExportCSV = () => {
    if (!filteredCustomers.length) {
      toast.error("No customers available to export");
      return;
    }

    const csvData = filteredCustomers.map((customer) => ({
      Customer_Name: customer.customer_name || "",
      Company_Name: customer.company_name || "",
      Branch: customer.branch_name || "",
      Branch_Code: customer.branch_code || "",
      Email: customer.email || "",
      Phone: customer.phone || "",
      GSTIN: customer.gstin || "",
      Customer_Type: customer.customer_type || "",
      Payment_Terms: customer.payment_terms || "",
      Currency: customer.currency || "",
      Opening_Balance: customer.opening_balance || 0,
      Credit_Limit: customer.credit_limit || 0,
      Status: customer.status || "",
    }));

    const csv = Papa.unparse(csvData, { escapeFormulae: true });

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const downloadUrl = URL.createObjectURL(blob);
    link.href = downloadUrl;
    link.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    toast.success("Customer CSV exported successfully");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "branch_id" && value === "__add_branch__") {
      setShowBranchModal(true);
      return;
    }

    let nextValue = value;

    if (name === "gstin" || name === "currency") {
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

  const resetBranchForm = () => {
    setBranchForm(initialBranchForm);
    setBranchErrors({});
  };

  const handleCreateBranch = async () => {
    if (!canManageBranches || branchSaveLock.current || !validateBranchForm())
      return;
    branchSaveLock.current = true;

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

      const branchRes = await api.get("/branches", {
        params: {
          status: "active",
          limit: 1000,
        },
      });

      const updatedBranchesRaw = Array.isArray(branchRes.data)
        ? branchRes.data
        : branchRes.data?.branches || [];

      const updatedBranches = updatedBranchesRaw.filter(
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
      branchSaveLock.current = false;
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
  };

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (customer) => {
    setEditId(customer.id);
    setErrors({});
    setFormData({
      branch_id: customer.branch_id ? String(customer.branch_id) : "",
      customer_name: customer.customer_name || "",
      company_name: customer.company_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      gstin: customer.gstin || "",
      customer_type: customer.customer_type || "business",
      billing_address: customer.billing_address || "",
      shipping_address: customer.shipping_address || "",
      payment_terms: customer.payment_terms || "Due on Receipt",
      currency: customer.currency || "INR",
      opening_balance:
        customer.opening_balance === null ||
        customer.opening_balance === undefined
          ? ""
          : String(customer.opening_balance),
      customer_group: customer.customer_group || "",
      credit_limit:
        customer.credit_limit === null || customer.credit_limit === undefined
          ? ""
          : String(customer.credit_limit),
      notes: customer.notes || "",
      status: customer.status || "active",
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };

  const buildCustomerPayload = () => ({
    branch_id: formData.branch_id || "",
    customer_name: cleanString(formData.customer_name),
    company_name: cleanString(formData.company_name),
    email: normalizeEmail(formData.email),
    phone: cleanString(formData.phone),
    gstin: normalizeUpper(formData.gstin),
    customer_type:
      cleanString(formData.customer_type).toLowerCase() || "business",
    billing_address: cleanString(formData.billing_address),
    shipping_address: cleanString(formData.shipping_address),
    payment_terms: cleanString(formData.payment_terms) || "Due on Receipt",
    currency: normalizeUpper(formData.currency) || "INR",
    opening_balance:
      formData.opening_balance === "" ? 0 : Number(formData.opening_balance),
    customer_group: cleanString(formData.customer_group),
    credit_limit:
      formData.credit_limit === "" ? 0 : Number(formData.credit_limit),
    notes: cleanString(formData.notes),
    status: cleanString(formData.status).toLowerCase() || "active",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canEdit || customerSaveLock.current || !validateCustomerForm()) return;
    customerSaveLock.current = true;

    try {
      setCustomerLoading(true);

      const payload = buildCustomerPayload();

      if (editId) {
        await api.put(`/customers/${editId}`, payload);
        toast.success("Customer updated successfully");
      } else {
        await api.post("/customers", payload);
        toast.success("Customer added successfully");
      }

      closeFormModal();
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      customerSaveLock.current = false;
      setCustomerLoading(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!canDelete) return;
    if ((customer.status || "active") === "inactive") {
      toast.error("Customer already inactive");
      return;
    }

    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Deactivate this customer?
          </p>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {customer.customer_name || "Selected customer"} will become
            inactive.
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);

                try {
                  await api.delete(`/customers/${customer.id}`);
                  toast.success("Customer deactivated successfully");
                  fetchCustomers();
                } catch (error) {
                  toast.error(error.response?.data?.message || "Delete failed");
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
  };

  return (
    <div className="customer-workspace w-full min-w-0 space-y-5 text-[15px] text-slate-700 dark:text-slate-200">
      {!viewCustomer ? (
        <>
          <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-sm text-slate-400">
                Business / Customers
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Customers
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Your customer relationships, all in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <Download size={16} />
                Export CSV
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus size={17} />
                  New Customer
                </button>
              )}
            </div>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Total Customers",
                stats.total,
                Users,
                "bg-blue-50 text-blue-600",
              ],
              [
                "Active Customers",
                stats.active,
                CheckCircle2,
                "bg-emerald-50 text-emerald-600",
              ],
              [
                "Business Customers",
                stats.business,
                Building2,
                "bg-violet-50 text-violet-600",
              ],
              [
                "Inactive Customers",
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
              />
            ))}
          </div>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pt-4 dark:border-slate-800">
              <div
                className="flex gap-5 overflow-x-auto"
                role="tablist"
                aria-label="Customer status"
              >
                {[
                  ["all", "All Customers"],
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
                aria-label="Refresh customers"
                disabled={listLoading}
                onClick={fetchCustomers}
                className="mb-3 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <RefreshCw
                  size={16}
                  className={listLoading ? "animate-spin" : ""}
                />
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
                  aria-label="Search customers"
                  placeholder="Search by name, email, phone or GSTIN…"
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
                  label="Filter by type"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  icon={<Filter size={15} />}
                  options={[
                    { value: "all", label: "All Types" },
                    { value: "business", label: "Business" },
                    { value: "individual", label: "Individual" },
                  ]}
                />
              </div>
            </div>
            {listError ? (
              <div role="alert" className="p-10 text-center">
                <p className="text-sm text-red-500">{listError}</p>
                <button
                  type="button"
                  onClick={fetchCustomers}
                  className="mt-3 text-sm text-blue-600"
                >
                  Try again
                </button>
              </div>
            ) : listLoading ? (
              <div
                role="status"
                className="space-y-4 p-6"
                aria-label="Loading customers"
              >
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : (
              <CustomerTable
                customers={paginatedCustomers}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={setViewCustomer}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            )}
            <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center">
              <span>
                Showing{" "}
                {sortedCustomers.length
                  ? (currentPage - 1) * itemsPerPage + 1
                  : 0}
                –{Math.min(currentPage * itemsPerPage, sortedCustomers.length)}{" "}
                of {sortedCustomers.length} customers
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
        <CustomerDetail
          key={viewCustomer.id}
          customer={
            customers.find(
              (item) => String(item.id) === String(viewCustomer.id),
            ) || viewCustomer
          }
          onClose={() => setViewCustomer(null)}
          onEdit={canEdit ? openEditModal : null}
        />
      )}
      {showFormModal && (
        <FormModal
          title={editId ? "Update Customer" : "Add New Customer"}
          description="Keep customer, billing and contact information up to date."
          icon={<Users size={22} />}
          onClose={closeFormModal}
        >
          <CustomerForm
            formData={formData}
            errors={errors}
            branches={branches}
            editId={editId}
            loading={customerLoading}
            canManageBranches={canManageBranches}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {showBranchModal && (
        <FormModal
          title="Add New Branch"
          nested
          description="Create branch without leaving customer page."
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

      <style>{`
        .customer-workspace .input {
          width: 100%;
          border: 1px solid #e2e8f0;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 15px;
          min-height: 44px;
          outline: none;
          background: #ffffff;
          color: #334155;
        }

        .customer-workspace .input::placeholder {
          color: #94a3b8;
        }

        .customer-workspace .input:focus {
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

        .dark .customer-workspace .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }

        .dark .customer-workspace .input:focus {
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

const formatCustomerMoney = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: ALLOWED_CURRENCIES.includes(currency) ? currency : "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
function CustomerTable({
  customers,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
}) {
  // Same table markup and styling as AccountantTable, with Customer fields.
  const formatBranchLabel = (customer) =>
    customer.branch_code
      ? (customer.branch_name || "Unassigned") +
        " (" +
        customer.branch_code +
        ")"
      : customer.branch_name || "Unassigned";
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-[15px]">
        <thead className="bg-blue-50 text-sm tracking-wide text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {[
              ["Customer", "customer_name"],
              ["Contact", "email"],
              ["Branch / Type", "branch_name"],
              ["Opening Balance", "opening_balance"],
              ["Status", "status"],
              ["Actions", null],
            ].map(([label]) => (
              <th
                key={label}
                scope="col"
                className="whitespace-nowrap px-5 py-4 text-left text-sm font-medium"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {customers.map((item) => (
            <tr
              key={item.id}
              className="transition hover:bg-blue-50/30 dark:hover:bg-slate-800/40"
            >
              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => onView(item)}
                  className="flex items-center gap-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-600 dark:bg-blue-950">
                    {String(item.customer_name || "C")
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[200px] truncate text-base font-semibold text-slate-800 hover:text-blue-600 dark:text-slate-100">
                      {item.customer_name || "—"}
                    </span>
                    <span
                      className="mt-1 block max-w-[210px] truncate text-sm text-slate-500"
                      title={
                        item.company_name ||
                        item.customer_group ||
                        "Individual customer"
                      }
                    >
                      {item.company_name ||
                        item.customer_group ||
                        "Individual customer"}
                    </span>
                  </span>
                </button>
              </td>
              <td className="px-5 py-4">
                <span
                  className="block max-w-[210px] truncate text-sm text-slate-600 dark:text-slate-300"
                  title={item.email}
                >
                  {item.email || "—"}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {item.phone || "No phone added"}
                </span>
              </td>
              <td className="px-5 py-4">
                <span
                  className="block max-w-[170px] truncate text-sm text-slate-600 dark:text-slate-300"
                  title={formatBranchLabel(item)}
                >
                  {formatBranchLabel(item)}
                </span>
                <div className="mt-2" />
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-sm font-medium capitalize text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  <Tag size={13} />
                  {item.customer_type || "business"}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-[15px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
                {formatCustomerMoney(item.opening_balance, item.currency)}
              </td>
              <td className="px-5 py-4 ">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="View profile"
                    aria-label={`View ${item.customer_name}`}
                    onClick={() => onView(item)}
                    className="rounded-lg bg-blue-50 p-2.5 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    <Eye size={16} />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      title="Edit customer"
                      aria-label={`Edit ${item.customer_name}`}
                      onClick={() => onEdit(item)}
                      className="rounded-lg bg-amber-50 p-2.5 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {canDelete && item.status !== "inactive" && (
                    <button
                      type="button"
                      aria-label={"Deactivate " + item.customer_name}
                      title="Deactivate customer"
                      onClick={() => onDelete(item)}
                      className="ml-2 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!customers.length && (
            <tr>
              <td colSpan={6} className="p-12 text-center">
                <Users size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No customers found
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Add your first customer or adjust the search and filters.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
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
            label="Branch Status"
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
          className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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

function CustomerForm({
  formData,
  errors,
  branches,
  editId,
  loading,
  canManageBranches,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      <Section title="Basic Customer Details">
        <Input
          icon={<User size={16} />}
          label="Customer Name"
          required
          name="customer_name"
          value={formData.customer_name}
          onChange={handleChange}
          error={errors.customer_name}
        />

        <Input
          icon={<Building2 size={16} />}
          label="Company Name"
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          error={errors.company_name}
        />

        <Field label="Branch">
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

        <Field label="Customer Type" error={errors.customer_type}>
          <CustomDropdown
            label="Customer Type"
            value={formData.customer_type}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "customer_type",
                  value,
                },
              })
            }
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
          value={formData.customer_group}
          onChange={handleChange}
          error={errors.customer_group}
        />

        <Field label="Status" error={errors.status}>
          <CustomDropdown
            label="Customer Status"
            value={formData.status}
            onChange={(value) =>
              handleChange({
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
      </Section>

      <Section title="Contact Information">
        <Input
          icon={<Mail size={16} />}
          label="Email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />

        <Input
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          error={errors.phone}
        />
      </Section>

      <Section title="Tax & Billing Details">
        <Input
          icon={<BadgePercent size={16} />}
          label="GSTIN"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          error={errors.gstin}
        />

        <Field label="Payment Terms" error={errors.payment_terms}>
          <CustomDropdown
            label="Payment Terms"
            value={formData.payment_terms}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "payment_terms",
                  value,
                },
              })
            }
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
          value={formData.currency}
          onChange={handleChange}
          error={errors.currency}
        />

        <Input
          icon={<Wallet size={16} />}
          label="Opening Balance"
          name="opening_balance"
          type="number"
          value={formData.opening_balance}
          onChange={handleChange}
          error={errors.opening_balance}
        />

        <Input
          icon={<CreditCard size={16} />}
          label="Credit Limit"
          name="credit_limit"
          type="number"
          value={formData.credit_limit}
          onChange={handleChange}
          error={errors.credit_limit}
        />
      </Section>

      <Section title="Address Details">
        <Input
          icon={<MapPin size={16} />}
          label="Billing Address"
          name="billing_address"
          value={formData.billing_address}
          onChange={handleChange}
        />

        <Input
          icon={<MapPin size={16} />}
          label="Shipping Address"
          name="shipping_address"
          value={formData.shipping_address}
          onChange={handleChange}
        />
      </Section>

      <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 dark:border-slate-800 dark:bg-slate-950">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <StickyNote size={16} />
          Notes
        </label>

        <textarea
          name="notes"
          value={formData.notes || ""}
          onChange={handleChange}
          className="input"
          rows="3"
        />
      </div>

      <div className="sticky -bottom-7 z-10 -mx-5 flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:-mx-7 sm:px-7">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          <Save size={16} />
          {loading ? "Saving..." : editId ? "Update Customer" : "Add Customer"}
        </button>
      </div>
    </form>
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
      <label
        htmlFor={`branch-${name}`}
        className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        {icon}
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>

      <input
        type={type}
        id={`branch-${name}`}
        aria-invalid={Boolean(error)}
        name={name}
        value={value}
        onChange={onChange}
        className={`input ${error ? "input-error" : ""}`}
      />

      {error && (
        <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon, color }) {
  const tone = color.includes("emerald")
    ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-950/40 dark:to-slate-900"
    : color.includes("amber")
      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900 dark:from-amber-950/40 dark:to-slate-900"
      : color.includes("violet")
        ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:border-violet-900 dark:from-violet-950/40 dark:to-slate-900"
        : "border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900 dark:from-blue-950/40 dark:to-slate-900";
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm ${tone} `}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${color}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-500">{title}</span>
        <span className="mt-1 block text-2xl font-semibold leading-tight text-slate-900 dark:text-white">
          {value}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">
          Current customer records
        </span>
      </span>
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
  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") {
        const dialogs = document.querySelectorAll("[data-customer-dialog]");
        if (dialogs[dialogs.length - 1]?.getAttribute("aria-label") === title)
          onClose();
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
    };
  }, [onClose, title]);
  return createPortal(
    <div className="customer-workspace">
      <div
        className={`fixed inset-0 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 ${nested ? "z-[90]" : "z-[80]"}`}
      >
        <section
          data-customer-dialog
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${nested ? "max-w-3xl" : "max-w-5xl"}`}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:px-7">
            <div className="flex gap-3">
              <span className="hidden h-fit rounded-xl bg-blue-50 p-2.5 text-blue-600 sm:block">
                {icon}
              </span>
              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-widest text-slate-400">
                  Customer Workspace
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto p-5 sm:p-7">{children}</div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

// Use the existing read APIs so invoice, payment and quotation access stays unchanged.
const customerRecord = (row, customer) =>
  String(row.customer_id) === String(customer.id) &&
  String(row.company_id) === String(customer.company_id);

const billingDay = (value) =>
  String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
const todayInIndia = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

// Convert DECIMAL strings to paise before adding, so floating-point rounding
// cannot affect the totals. Unknown or unexpected values stay unavailable.
function sumBillingAmounts(rows, field) {
  if (!rows) return null;
  let total = 0;
  for (const row of rows) {
    const match = /^(\d+)(?:\.(\d{1,2})0*)?$/.exec(String(row[field] ?? ""));
    if (!match) return null;
    const paise =
      Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(total + paise)) return null;
    total += paise;
  }
  return total / 100;
}

async function fetchBillingRows(path, signal) {
  const { data } = await api.get(path, { signal });
  if (!Array.isArray(data)) throw new Error("Unexpected billing response");
  return data;
}

async function fetchCustomerQuotations(customer, signal) {
  const rows = [];
  let page = 1;
  let lastPage = 1;
  do {
    const { data } = await api.get("/quotations", {
      signal,
      params: { page, limit: 1000 },
    });
    if (
      !Array.isArray(data?.quotations) ||
      !Number.isInteger(data.totalPages) ||
      data.totalPages < 0 ||
      Number(data.page) !== page
    ) {
      throw new Error("Unexpected quotation response");
    }
    lastPage = Math.max(lastPage, data.totalPages);
    rows.push(
      ...data.quotations.filter((row) => customerRecord(row, customer)),
    );
    page += 1;
  } while (page <= lastPage);
  return [...new Map(rows.map((row) => [String(row.id), row])).values()];
}

function useCustomerBilling(customer) {
  const { id, company_id } = customer;
  const [billing, setBilling] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setBilling(null);
    const selected = { id, company_id };
    if (id == null || company_id == null) {
      setBilling({ unavailable: ["invoices", "payments", "quotations"] });
      return () => controller.abort();
    }

    Promise.allSettled([
      fetchBillingRows("/invoices", signal),
      fetchBillingRows("/payments", signal),
      fetchCustomerQuotations(selected, signal),
    ]).then(([invoiceResult, paymentResult, quotationResult]) => {
      if (signal.aborted) return;
      const invoices =
        invoiceResult.status === "fulfilled"
          ? invoiceResult.value.filter((row) => customerRecord(row, selected))
          : null;
      const invoiceIds = new Set((invoices || []).map((row) => String(row.id)));
      const payments =
        invoices && paymentResult.status === "fulfilled"
          ? paymentResult.value.filter(
              (row) =>
                String(row.company_id) === String(company_id) &&
                invoiceIds.has(String(row.invoice_id)),
            )
          : null;
      const quotations =
        quotationResult.status === "fulfilled" ? quotationResult.value : null;
      const unavailable = [
        ...(!invoices ? ["invoices"] : []),
        ...(!payments ? ["payments"] : []),
        ...(!quotations ? ["quotations"] : []),
      ];
      setBilling({ invoices, payments, quotations, unavailable });
    });

    return () => controller.abort();
  }, [id, company_id, attempt]);

  return { billing, retry: () => setAttempt((current) => current + 1) };
}

function buildCustomerBusiness(billing) {
  const { invoices, payments, quotations } = billing || {};
  // Draft and cancelled documents remain visible in history, not in balances.
  const posted = invoices?.filter((row) =>
    ["sent", "partial", "paid", "overdue", "unpaid"].includes(
      String(row.status).toLowerCase(),
    ),
  );
  const activeIds = new Set(posted?.map((row) => String(row.id)));
  const collections = payments?.filter((row) =>
    activeIds.has(String(row.invoice_id)),
  );
  const today = todayInIndia();
  const overdue = posted?.filter(
    (row) => billingDay(row.due_date) && billingDay(row.due_date) < today,
  );
  const summary = {
    total_invoiced: sumBillingAmounts(posted, "total_amount"),
    payments_received: sumBillingAmounts(collections, "amount"),
    outstanding: sumBillingAmounts(posted, "balance_due"),
    overdue: sumBillingAmounts(overdue, "balance_due"),
  };

  const transactions = [
    ...(quotations || []).map((row) => ({
      id: row.id,
      type: "Quotation",
      number: row.quotation_number,
      date: row.quotation_date,
      amount: row.total_amount,
      status: row.status,
      created_at: row.created_at,
    })),
    ...(invoices || []).map((row) => ({
      id: row.id,
      type: "Invoice",
      number: row.invoice_number,
      date: row.invoice_date,
      amount: row.total_amount,
      status: row.status,
      created_at: row.created_at,
    })),
    ...(payments || []).map((row) => ({
      id: row.id,
      type: "Payment",
      number: row.invoice_number,
      date: row.payment_date,
      amount: row.amount,
      status: "Recorded",
      created_at: row.created_at,
    })),
  ].sort((a, b) => billingDay(b.date).localeCompare(billingDay(a.date)));

  const activities = transactions
    .filter((row) => billingDay(row.created_at))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 20)
    .map((row) => ({
      id: `${row.type}-${row.id}`,
      title:
        row.type === "Payment" ? "Payment recorded" : `${row.type} created`,
      description: row.number,
      created_at: row.created_at,
    }));

  const monthly = [];
  if (
    posted &&
    collections &&
    (posted.length || collections.length) &&
    summary.total_invoiced != null &&
    summary.payments_received != null &&
    posted.every((row) => billingDay(row.invoice_date)) &&
    collections.every((row) => billingDay(row.payment_date))
  ) {
    const [year, month] = today.split("-").map(Number);
    for (let offset = 11; offset >= 0; offset -= 1) {
      const start = new Date(Date.UTC(year, month - 1 - offset, 1));
      const key = start.toISOString().slice(0, 7);
      monthly.push({
        month: start.toLocaleDateString("en-IN", {
          month: "short",
          timeZone: "UTC",
        }),
        invoiced: sumBillingAmounts(
          posted.filter((row) => billingDay(row.invoice_date).startsWith(key)),
          "total_amount",
        ),
        received: sumBillingAmounts(
          collections.filter((row) =>
            billingDay(row.payment_date).startsWith(key),
          ),
          "amount",
        ),
      });
    }
  }
  return { summary, transactions, activities, monthly };
}

function CustomerDetail({ customer, onClose, onEdit }) {
  const [tab, setTab] = useState("Overview");
  const [transactionType, setTransactionType] = useState("All");
  const { billing, retry } = useCustomerBilling(customer);
  const { summary, monthly, transactions, activities } = useMemo(
    () => buildCustomerBusiness(billing),
    [billing],
  );
  // The supplied document/collection controllers store/display INR amounts.
  // Customer profile currency still applies to credit limit and opening balance.
  const currency = "INR";
  const profileCurrency = ALLOWED_CURRENCIES.includes(customer.currency)
    ? customer.currency
    : "INR";
  const money = (value, amountCurrency = currency) =>
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
      ? "—"
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: amountCurrency,
          maximumFractionDigits: 2,
        }).format(Number(value));
  const date = (value) => {
    if (!value) return "Date unavailable";
    const day = billingDay(value);
    const parsed = new Date(day ? `${day}T00:00:00Z` : value);
    return Number.isNaN(parsed.getTime())
      ? "Date unavailable"
      : parsed.toLocaleDateString("en-IN", {
          timeZone: "UTC",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };
  const visibleTransactions = transactions.filter(
    (item) =>
      transactionType === "All" ||
      String(item.type).toLowerCase() === transactionType.toLowerCase(),
  );
  const chartRows = monthly.filter(
    (row) =>
      Number.isFinite(Number(row.invoiced)) &&
      Number.isFinite(Number(row.received)),
  );
  const max = Math.max(
    1,
    ...chartRows.flatMap((row) => [Number(row.invoiced), Number(row.received)]),
  );
  const pointX = (index) =>
    55 + (index * 610) / Math.max(1, chartRows.length - 1);
  const points = (field) =>
    chartRows
      .map(
        (row, index) =>
          `${pointX(index)},${205 - (Number(row[field]) / max) * 160}`,
      )
      .join(" ");
  const card =
    "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
  const empty = (title, description) => (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
      <FileText size={28} className="mb-3 text-slate-300" />
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
  return (
    <div className="min-w-0 space-y-5 text-slate-900 dark:text-slate-100">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft size={16} /> Back to Customers
      </button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-slate-500">
            Customers / Customer Details
          </p>
          <h1 className="text-2xl font-semibold">
            {customer.company_name || customer.customer_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer overview, business history and activity
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(customer)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Pencil size={16} /> Edit Customer
          </button>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-xl font-semibold text-blue-600 dark:bg-blue-950">
              {String(customer.customer_name || "C")
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <h2 className="break-words text-lg font-semibold">
              {customer.customer_name}
            </h2>
            <p className="mb-3 mt-1 break-words text-sm text-slate-500">
              {customer.company_name || "Individual customer"}
            </p>
            <StatusBadge status={customer.status} />
          </div>
          <div className="space-y-5 p-5">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Contact Information
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <Mail size={15} className="mt-1 shrink-0 text-slate-400" />
                {customer.email ? (
                  <a
                    className="break-all text-blue-600"
                    href={`mailto:${customer.email}`}
                  >
                    {customer.email}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div className="mt-3 flex gap-2 text-sm">
                <Phone size={15} className="shrink-0 text-slate-400" />
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            {[
              ["Billing Address", customer.billing_address],
              ["Shipping Address", customer.shipping_address],
            ].map(([label, value]) => (
              <div key={label}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </h3>
                <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {value || "Not provided"}
                </p>
              </div>
            ))}
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              {[
                ["GSTIN", customer.gstin],
                ["Type", customer.customer_type],
                ["Branch", customer.branch_name],
                ["Payment Terms", customer.payment_terms],
                ["Currency", profileCurrency],
                ["Credit Limit", money(customer.credit_limit, profileCurrency)],
                [
                  "Opening Balance",
                  money(customer.opening_balance, profileCurrency),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-1 break-words text-sm">{value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <div className="min-w-0 space-y-5">
          {!billing && (
            <p role="status" className="text-sm text-slate-500">
              Loading customer billing data…
            </p>
          )}
          {billing?.unavailable.length > 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 px-4 py-3 text-sm text-slate-600 dark:border-amber-900 dark:text-slate-300"
            >
              <span>
                Could not load: {billing.unavailable.join(", ")}. Check access
                or retry.
              </span>
              <button
                type="button"
                onClick={retry}
                className="font-medium text-blue-600 dark:text-blue-300"
              >
                Retry
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Total Invoiced",
                "total_invoiced",
                FileText,
                "text-blue-600 bg-blue-50",
              ],
              [
                "Payments Received",
                "payments_received",
                Wallet,
                "text-emerald-600 bg-emerald-50",
              ],
              [
                "Outstanding",
                "outstanding",
                CreditCard,
                "text-amber-600 bg-amber-50",
              ],
              ["Overdue", "overdue", CalendarDays, "text-red-600 bg-red-50"],
            ].map(([label, field, Icon, color]) => (
              <div key={field} className={`${card} p-4`}>
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg p-2 ${color}`}>
                    <Icon size={17} />
                  </span>
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
                <p className="mt-3 break-words text-xl font-semibold">
                  {money(summary[field])}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {summary[field] == null
                    ? !billing
                      ? "Loading…"
                      : "Business data unavailable"
                    : field === "overdue"
                      ? "Past due date"
                      : "All time"}
                </p>
              </div>
            ))}
          </div>
          <div
            className="flex gap-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800"
            role="tablist"
            aria-label="Customer sections"
          >
            {["Overview", "Transactions", "Notes"].map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium ${tab === name ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0 space-y-5">
              {tab === "Overview" && (
                <section className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
                    <div>
                      <h2 className="font-semibold">Business Overview</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Monthly billing and collections
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                        Invoiced
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Received
                      </span>
                    </div>
                  </div>
                  {chartRows.length ? (
                    <div className="overflow-x-auto p-4">
                      <svg
                        viewBox="0 0 710 250"
                        className="w-full min-w-[400px]"
                        role="img"
                        aria-label="Monthly invoiced amounts and payments received"
                      >
                        <title>{`Monthly billing and collections in ${currency}`}</title>
                        {[0, 1, 2, 3, 4].map((tick) => (
                          <g key={tick}>
                            <line
                              x1="55"
                              x2="665"
                              y1={45 + tick * 40}
                              y2={45 + tick * 40}
                              stroke="currentColor"
                              className="text-slate-100 dark:text-slate-800"
                            />
                            <text
                              x="48"
                              y={49 + tick * 40}
                              textAnchor="end"
                              fontSize="12"
                              fill="#94a3b8"
                            >
                              {new Intl.NumberFormat("en-IN", {
                                notation: "compact",
                              }).format((max * (4 - tick)) / 4)}
                            </text>
                          </g>
                        ))}
                        <polyline
                          points={points("invoiced")}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="3"
                        />
                        <polyline
                          points={points("received")}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                        />
                        {chartRows.map((row, index) => (
                          <g key={index}>
                            <circle
                              cx={pointX(index)}
                              cy={205 - (Number(row.invoiced) / max) * 160}
                              r="4"
                              fill="#2563eb"
                            >
                              <title>{`${row.month}: invoiced ${money(row.invoiced)}`}</title>
                            </circle>
                            <circle
                              cx={pointX(index)}
                              cy={205 - (Number(row.received) / max) * 160}
                              r="4"
                              fill="#10b981"
                            >
                              <title>{`${row.month}: received ${money(row.received)}`}</title>
                            </circle>
                            <text
                              x={pointX(index)}
                              y="232"
                              textAnchor="middle"
                              fontSize="12"
                              fill="#94a3b8"
                            >
                              {row.month}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  ) : (
                    empty(
                      "No billing history available",
                      !billing
                        ? "Loading billing data…"
                        : "No complete invoice and payment history is available for the chart.",
                    )
                  )}
                </section>
              )}
              {tab !== "Notes" && (
                <section className={`${card} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
                    <h2 className="font-semibold">
                      Transactions{" "}
                      <span className="ml-1 text-sm font-normal text-slate-400">
                        ({transactions.length})
                      </span>
                    </h2>
                    <select
                      aria-label="Filter transaction type"
                      value={transactionType}
                      onChange={(event) =>
                        setTransactionType(event.target.value)
                      }
                      className="!font-normal rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                    >
                      {["All", "Quotation", "Invoice", "Payment"].map(
                        (type) => (
                          <option className="!font-normal" key={type}>
                            {type}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  {visibleTransactions.length ? (
                    <div>
                      <table className="w-full min-w-[525px] text-left text-sm">
                        <thead className="bg-slate-50 text-sm text-slate-500 dark:bg-slate-800">
                          <tr>
                            {[
                              "Document",
                              "Type",
                              "Date",
                              "Amount",
                              "Status",
                            ].map((label) => (
                              <th key={label} className="px-4 py-3 font-medium">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleTransactions.map((item, index) => (
                            <tr
                              key={`${item.type}-${item.id || index}`}
                              className="border-t border-slate-100 dark:border-slate-800"
                            >
                              <td className="px-4 py-4 font-medium text-blue-600">
                                {item.number || "—"}
                              </td>
                              <td className="px-4 py-4 capitalize">
                                {item.type}
                              </td>
                              <td className="px-4 py-4 text-slate-500">
                                {date(item.date)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {money(item.amount)}
                              </td>
                              <td className="px-4 py-4">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-sm capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {item.status || "—"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    empty(
                      !billing
                        ? "Loading transactions…"
                        : billing.unavailable.length
                          ? "Some transactions unavailable"
                          : "No matching transactions",
                      "This view shows invoice, quotation and payment records you can access.",
                    )
                  )}
                </section>
              )}
              {tab === "Notes" && (
                <section className={`${card} p-5`}>
                  <h2 className="mb-4 font-semibold">Customer Notes</h2>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-500">
                    {customer.notes || "No notes added for this customer."}
                  </p>
                </section>
              )}
            </div>
            <aside className={card}>
              <div className="flex items-center gap-2 border-b border-slate-100 p-5 dark:border-slate-800">
                <Activity size={17} className="text-blue-600" />
                <h2 className="font-semibold">Billing Activity</h2>
              </div>
              {activities.length ? (
                <ol className="space-y-0 p-5">
                  {activities.map((item, index) => (
                    <li
                      key={item.id || index}
                      className="relative border-l border-slate-200 pb-6 pl-6 last:pb-0 dark:border-slate-700"
                    >
                      <span className="absolute -left-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 ring-4 ring-white dark:ring-slate-900">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      </span>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 break-words text-sm leading-5 text-slate-500">
                        {item.description}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        {date(item.created_at)}
                        {item.created_at &&
                        !Number.isNaN(Date.parse(item.created_at))
                          ? ` · ${new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                empty(
                  "No activity history available",
                  "Shows recent document and payment creation events when the record includes a creation timestamp.",
                )
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  const descriptions = {
    "Basic Customer Details": "Customer identity and account preferences.",
    "Contact Information": "Where to reach this customer.",
    "Tax & Billing Details":
      "Tax registration, payment terms and credit settings.",
    "Address Details": "Addresses used on customer documents.",
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
      <label
        htmlFor={`customer-${name}`}
        className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        {icon}
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>

      <input
        type={type}
        id={`customer-${name}`}
        aria-invalid={Boolean(error)}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        className={`input ${error ? "input-error" : ""}`}
      />

      {error && (
        <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">
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
        <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">
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
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        {value || "-"}
      </div>
    </div>
  );
}

function TableCell({ children }) {
  return (
    <td className="p-4 text-center text-slate-600 dark:text-slate-300">
      {children}
    </td>
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

function CustomDropdown({
  value,
  onChange,
  options,
  icon,
  label = "Choose an option",
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({});
  const buttonRef = useRef(null),
    panelRef = useRef(null),
    searchRef = useRef(null);
  const listId = useId();
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );
  const filtered = options.filter(
    (option) =>
      option.value === "__add_branch__" ||
      option.label.toLowerCase().includes(query.toLowerCase()),
  );
  const choose = (option) => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
    buttonRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const availableBelow = window.innerHeight - rect.bottom - 12;
      const above = availableBelow < 220 && rect.top > availableBelow;
      const maxHeight = Math.max(
        100,
        Math.min(340, above ? rect.top - 16 : availableBelow),
      );
      setPosition({
        position: "fixed",
        left: Math.max(
          8,
          Math.min(
            rect.left,
            window.innerWidth - Math.max(rect.width, 180) - 8,
          ),
        ),
        width: Math.min(Math.max(rect.width, 180), window.innerWidth - 16),
        maxHeight,
        zIndex: 100010,
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
        setOpen(false);
        setQuery("");
      }
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    place();
    searchRef.current?.focus();
    if (!searchable)
      panelRef.current?.querySelector('[role="listbox"]')?.focus();
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  const keyboard = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) =>
        Math.max(
          0,
          Math.min(
            filtered.length - 1,
            index + (event.key === "ArrowDown" ? 1 : -1),
          ),
        ),
      );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(filtered[active]);
    }
    if (event.key === "Tab") setOpen(false);
  };
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
        className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left text-[15px] !font-normal text-slate-700 shadow-sm transition focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-slate-900 dark:text-slate-200 ${open ? "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-950" : "border-slate-200 hover:border-blue-300 dark:border-slate-700"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-blue-600 dark:text-blue-300">
              {icon}
            </span>
          )}
          <span className="truncate">{selected?.label || label}</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={position}
            className="flex flex-col overflow-hidden rounded-xl border border-blue-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {searchable && (
              <div className="shrink-0 border-b border-slate-100 p-2 dark:border-slate-800">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-slate-400"
                  />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    onKeyDown={keyboard}
                    aria-label={`Search ${label}`}
                    aria-controls={listId}
                    aria-activedescendant={
                      filtered[active] ? `${listId}-${active}` : undefined
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[15px] text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Search…"
                  />
                </div>
              </div>
            )}
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={searchable ? -1 : 0}
              onKeyDown={searchable ? undefined : keyboard}
              className="min-h-0 overflow-y-auto p-1.5"
            >
              {filtered.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={String(value) === String(option.value)}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] !font-normal transition ${option.value === "__add_branch__" ? "mt-1 border-t border-blue-100 !font-normal text-blue-600 dark:border-blue-900" : ""} ${String(value) === String(option.value) ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : index === active ? "bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}
                >
                  <span className="break-words">{option.label}</span>
                  {String(value) === String(option.value) && (
                    <CheckCircle2
                      size={16}
                      className="shrink-0 text-blue-600"
                    />
                  )}
                </button>
              ))}
              {!filtered.length && (
                <p className="px-3 py-5 text-center text-[15px] text-slate-500">
                  No matches found
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
function BranchSelect({ branches, value, onChange, canAddBranch = false }) {
  const options = branches.map((branch) => ({
    value: String(branch.id),
    label:
      (branch.branch_name || "Unnamed Branch") +
      (branch.branch_code ? " (" + branch.branch_code + ")" : "") +
      (branch.is_main === 1 || branch.is_main === true ? " · HQ" : ""),
  }));
  if (canAddBranch)
    options.push({ value: "__add_branch__", label: "+ Add New Branch" });
  return (
    <CustomDropdown
      label="Select Branch"
      value={value}
      onChange={onChange}
      icon={<GitBranch size={16} />}
      options={options}
    />
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

export default Customers;
