import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function Customers() {
  const user = JSON.parse(localStorage.getItem("user"));

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

  const canManageBranches =
    user?.role === "company_admin" || Boolean(user?.permissions?.branches);

  const fetchCustomers = useCallback(async () => {
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
      setCustomers(list);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch customers");
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
    fetchBranches();
  }, [fetchCustomers, fetchBranches]);

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

    const csv = Papa.unparse(csvData);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

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

    if (!validateCustomerForm()) return;

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
      setCustomerLoading(false);
    }
  };

  const handleDelete = async (customer) => {
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

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {customer.customer_name || "Selected customer"} will become
            inactive.
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
                  await api.delete(`/customers/${customer.id}`);
                  toast.success("Customer deactivated successfully");
                  fetchCustomers();
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

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Users size={17} />
              Customer Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Customers
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage customer details, billing information and branch-wise
              customer records.
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={17} />
              Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Customers"
          value={stats.total}
          icon={<Users size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        />

        <StatsCard
          title="Active Customers"
          value={stats.active}
          icon={<CheckCircle2 size={20} />}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        />

        <StatsCard
          title="Inactive Customers"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        />

        <StatsCard
          title="Business Customers"
          value={stats.business}
          icon={<Building2 size={20} />}
          color="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Customer List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Search, filter, view and manage customers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
              <div className="relative min-w-[180px] flex-1 xl:w-[210px] xl:flex-none">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search customer"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>

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
                value={typeFilter}
                onChange={setTypeFilter}
                icon={<Tag size={16} />}
                options={[
                  { value: "all", label: "All Types" },
                  { value: "business", label: "Business" },
                  { value: "individual", label: "Individual" },
                ]}
              />

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <CustomerTable
          customers={paginatedCustomers}
          canEdit={canEdit}
          canDelete={canDelete}
          onView={setViewCustomer}
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
            {sortedCustomers.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedCustomers.length)}
            {" of "}
            {sortedCustomers.length}
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
          title={editId ? "Update Customer" : "Add New Customer"}
          description="Manage customer information, billing details and contact information"
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

      {viewCustomer && (
        <CustomerViewModal
          customer={viewCustomer}
          onClose={() => setViewCustomer(null)}
        />
      )}

      {showBranchModal && (
        <FormModal
          title="Add New Branch"
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

function CustomerTable({
  customers,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            {[
              "Customer",
              "Branch",
              "Company",
              "Contact",
              "Terms",
              "Type",
              "Status",
              "Balance",
              "Actions",
            ].map((head) => (
              <th
                key={head}
                className="p-4 text-center text-xs font-semibold uppercase tracking-wide"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-slate-900">
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <td className="p-4 text-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <User size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">
                      {customer.customer_name || "-"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {customer.customer_group || "General Customer"}
                    </p>
                  </div>
                </div>
              </td>

              <TableCell>{customer.branch_name || "-"}</TableCell>
              <TableCell>{customer.company_name || "-"}</TableCell>

              <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                <p className="truncate">{customer.email || "-"}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {customer.phone || "-"}
                </p>
              </td>

              <TableCell>
                {customer.payment_terms || "Due on Receipt"}
              </TableCell>

              <td className="p-4 text-center capitalize text-slate-600 dark:text-slate-300">
                {customer.customer_type || "-"}
              </td>

              <td className="p-4 text-center">
                <StatusBadge status={customer.status} />
              </td>

              <td className="p-4 text-center font-semibold text-red-600 dark:text-red-400">
                ₹ {Number(customer.opening_balance || 0).toFixed(2)}
              </td>

              <td className="p-4 text-center">
                <div className="flex gap-2">
                  <IconButton
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => onView(customer)}
                  />

                  {canEdit && (
                    <IconButton
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                      onClick={() => onEdit(customer)}
                    />
                  )}

                  {canDelete && customer.status !== "inactive" && (
                    <IconButton
                      icon={<Trash2 size={16} />}
                      className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                      onClick={() => onDelete(customer)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}

          {customers.length === 0 && (
            <tr>
              <td colSpan="9" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                  <Users className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No customers found
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
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

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
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
        value={value}
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

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
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
            className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function CustomerViewModal({ customer, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Customer Details
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Complete customer information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <ViewField label="Customer Name" value={customer.customer_name} />
          <ViewField label="Company Name" value={customer.company_name} />
          <ViewField
            label="Branch"
            value={
              customer.branch_code
                ? `${customer.branch_name} (${customer.branch_code})`
                : customer.branch_name || "-"
            }
          />
          <ViewField label="Email" value={customer.email} />
          <ViewField label="Phone" value={customer.phone} />
          <ViewField label="GSTIN" value={customer.gstin} />
          <ViewField label="Customer Type" value={customer.customer_type} />
          <ViewField label="Payment Terms" value={customer.payment_terms} />
          <ViewField
            label="Credit Limit"
            value={`₹ ${Number(customer.credit_limit || 0).toFixed(2)}`}
          />
          <ViewField
            label="Opening Balance"
            value={`₹ ${Number(customer.opening_balance || 0).toFixed(2)}`}
          />
          <ViewField
            label="Status"
            value={<StatusBadge status={customer.status} />}
          />
          <ViewField label="Group" value={customer.customer_group} />
          <ViewField
            label="Billing Address"
            value={customer.billing_address}
            full
          />
          <ViewField
            label="Shipping Address"
            value={customer.shipping_address}
            full
          />
          <ViewField label="Notes" value={customer.notes} full />
        </div>
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
    <div ref={dropdownRef} className="relative min-w-[170px]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
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

function BranchSelect({ branches, value, onChange, canAddBranch = false }) {
  const [open, setOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedBranch = branches.find(
    (branch) => String(branch.id) === String(value),
  );

  const filteredBranches = branches.filter((branch) =>
    `${branch.branch_name || ""} ${branch.branch_code || ""} ${
      branch.email || ""
    }`
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
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
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
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

export default Customers;
