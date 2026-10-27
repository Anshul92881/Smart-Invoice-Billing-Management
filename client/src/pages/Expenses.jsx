import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import {
  Wallet,
  IndianRupee,
  CalendarDays,
  Tag,
  Trash2,
  StickyNote,
  Search,
  Pencil,
  X,
  CheckCircle,
  Truck,
  Building2,
  Save,
  GitBranch,
  Hash,
  Mail,
  Phone,
  BadgePercent,
  MapPin,
  Globe,
  Plus,
  Eye,
  ChevronDown,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ZIP_REGEX = /^\d{5,6}$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const CATEGORY_REGEX = /^[a-zA-Z0-9\s&.,'()/-]+$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;

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

const getList = (data, key) => {
  if (Array.isArray(data)) return data;
  return data?.[key] || [];
};

const isValidDate = (value) => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
};

function Expenses() {
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
  }, [user?.company_id, user?.role]);

  const canManageExpenses =
    user?.role === "company_admin" ||
    user?.role === "accountant" ||
    Boolean(rolePermissions?.[user?.role]?.expenses);

  const canCreateOrEdit = canManageExpenses;
  const canDelete = canManageExpenses;

  const canManageBranches =
    user?.role === "company_admin" ||
    Boolean(rolePermissions?.[user?.role]?.branches);

  const canManageVendors =
    user?.role === "company_admin" ||
    Boolean(rolePermissions?.[user?.role]?.vendors);

  const initialForm = {
    vendor_id: "",
    branch_id: "",
    amount: "",
    category: "",
    notes: "",
    expense_date: new Date().toISOString().split("T")[0],
  };

  const initialVendorForm = {
    vendor_name: "",
    company_name: "",
    email: "",
    phone: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    zip_code: "",
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

  const defaultCategories = [
    "Office Rent",
    "Internet",
    "Salary",
    "Travel",
    "Utilities",
    "Software",
    "Marketing",
    "Stationery",
    "Maintenance",
  ];

  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);

  const [formData, setFormData] = useState(initialForm);
  const [vendorForm, setVendorForm] = useState(initialVendorForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [categoryName, setCategoryName] = useState("");

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);

  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = async () => {
    try {
      const [expenseRes, branchRes] = await Promise.all([
        api.get("/expenses"),
        api.get("/branches"),
      ]);

      const expenseList = getList(expenseRes.data, "expenses");
      const branchList = getList(branchRes.data, "branches");

      setExpenses(expenseList);

      setBranches(
        branchList.filter(
          (branch) =>
            branch.status === "active" ||
            branch.status === 1 ||
            branch.status === true,
        ),
      );

      const categoriesFromExpenses = expenseList
        .map((expense) => cleanString(expense.category))
        .filter(Boolean);

      setCategories((prev) => [
        ...new Set([...prev, ...categoriesFromExpenses]),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch expenses");
      setExpenses([]);
      setBranches([]);
    }

    try {
      if (canManageVendors) {
        const vendorRes = await api.get("/vendors");
        const vendorList = getList(vendorRes.data, "vendors");
        setVendors(vendorList.filter((v) => v.status === "active"));
      } else {
        setVendors([]);
      }
    } catch {
      setVendors([]);
    }
  };

  useEffect(() => {
    fetchData();
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

  const getDefaultBranchId = useCallback(() => {
    const hqBranch = activeBranches.find(
      (branch) => branch.is_main === 1 || branch.is_main === true,
    );

    return hqBranch?.id ? String(hqBranch.id) : "";
  }, [activeBranches]);

  useEffect(() => {
    const defaultBranchId = getDefaultBranchId();

    if (!defaultBranchId || formData.branch_id) return;

    setFormData((prev) => ({
      ...prev,
      branch_id: defaultBranchId,
    }));
  }, [getDefaultBranchId, formData.branch_id]);

  const filteredExpenses = useMemo(() => {
    return (Array.isArray(expenses) ? expenses : []).filter((expense) => {
      const keyword = search.toLowerCase().trim();

      const matchesSearch =
        !keyword ||
        expense.category?.toLowerCase().includes(keyword) ||
        expense.notes?.toLowerCase().includes(keyword) ||
        expense.vendor_name?.toLowerCase().includes(keyword) ||
        expense.vendor_company_name?.toLowerCase().includes(keyword) ||
        expense.branch_name?.toLowerCase().includes(keyword) ||
        expense.branch_code?.toLowerCase().includes(keyword);

      const matchesCategory = categoryFilter
        ? expense.category === categoryFilter
        : true;

      const matchesBranch = branchFilter
        ? Number(expense.branch_id) === Number(branchFilter)
        : true;

      return matchesSearch && matchesCategory && matchesBranch;
    });
  }, [expenses, search, categoryFilter, branchFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, branchFilter]);

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => b.id - a.id);
  }, [filteredExpenses]);

  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;

    return sortedExpenses.slice(start, start + itemsPerPage);
  }, [sortedExpenses, currentPage, itemsPerPage]);

  const totalExpense = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const monthlyExpense = filteredExpenses
    .filter((item) => {
      const expenseDate = new Date(item.expense_date);
      const now = new Date();

      return (
        expenseDate.getMonth() === now.getMonth() &&
        expenseDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const stats = {
    totalExpense,
    monthlyExpense,
    records: filteredExpenses.length,
    categories: categories.length,
  };

  const confirmToast = (message, onConfirm) => {
    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">{message}</p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
            >
              No
            </button>

            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                onConfirm();
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Yes
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
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

    if (name === "vendor_id" && value === "__add_vendor__") {
      if (!canManageVendors) {
        toast.error("Vendor permission required");
        return;
      }

      setShowVendorModal(true);
      return;
    }

    if (name === "category" && value === "__add_category__") {
      setShowCategoryModal(true);
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVendorChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "email"
        ? normalizeEmail(value)
        : name === "gstin"
          ? normalizeUpper(value)
          : value;

    setVendorForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleBranchChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "branch_code" || name === "gst_number"
        ? normalizeUpper(value)
        : name === "email"
          ? normalizeEmail(value)
          : value;

    setBranchForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const resetForm = () => {
    setFormData({
      ...initialForm,
      branch_id: getDefaultBranchId(),
    });
    setEditId(null);
  };

  const resetVendorForm = () => setVendorForm(initialVendorForm);
  const resetBranchForm = () => setBranchForm(initialBranchForm);

  const openCreateModal = () => {
    if (!canCreateOrEdit) {
      toast.error("Expense permission required");
      return;
    }

    resetForm();
    setShowExpenseModal(true);
  };

  const openEditModal = (expense) => {
    if (!canCreateOrEdit) {
      toast.error("Expense permission required");
      return;
    }

    setEditId(expense.id);

    setFormData({
      vendor_id: expense.vendor_id || "",
      branch_id: expense.branch_id || "",
      amount: expense.amount || "",
      category: expense.category || "",
      notes: expense.notes || "",
      expense_date: expense.expense_date
        ? String(expense.expense_date).split("T")[0]
        : "",
    });

    if (expense.category && !categories.includes(expense.category)) {
      setCategories((prev) => [...prev, expense.category]);
    }

    setShowExpenseModal(true);
  };

  const closeExpenseModal = () => {
    resetForm();
    setShowExpenseModal(false);
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
      toast.error("Branch code must be 2-20 characters");
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

  const validateVendorForm = () => {
    const vendorName = cleanString(vendorForm.vendor_name);
    const companyName = cleanString(vendorForm.company_name);
    const email = normalizeEmail(vendorForm.email);
    const phone = cleanString(vendorForm.phone);
    const gstin = normalizeUpper(vendorForm.gstin);
    const zipCode = cleanString(vendorForm.zip_code);

    if (!vendorName) {
      toast.error("Vendor name is required");
      return false;
    }

    if (vendorName.length < 2 || vendorName.length > 100) {
      toast.error("Vendor name must be between 2 and 100 characters");
      return false;
    }

    if (!NAME_REGEX.test(vendorName)) {
      toast.error("Vendor name contains invalid characters");
      return false;
    }

    if (
      companyName &&
      (companyName.length > 100 || !NAME_REGEX.test(companyName))
    ) {
      toast.error("Company name contains invalid characters");
      return false;
    }

    if (email && !EMAIL_REGEX.test(email)) {
      toast.error("Invalid vendor email format");
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

    if (zipCode && !ZIP_REGEX.test(zipCode)) {
      toast.error("ZIP code must be 5 to 6 digits");
      return false;
    }

    if (cleanString(vendorForm.notes).length > 500) {
      toast.error("Vendor notes must be less than 500 characters");
      return false;
    }

    if (!["active", "inactive"].includes(cleanString(vendorForm.status))) {
      toast.error("Status must be active or inactive");
      return false;
    }

    return true;
  };

  const validateCategoryName = (name) => {
    const finalCategory = cleanString(name);

    if (!finalCategory) {
      toast.error("Category name is required");
      return null;
    }

    if (finalCategory.length < 2 || finalCategory.length > 100) {
      toast.error("Category must be between 2 and 100 characters");
      return null;
    }

    if (!CATEGORY_REGEX.test(finalCategory)) {
      toast.error("Category contains invalid characters");
      return null;
    }

    return finalCategory;
  };

  const validateExpenseForm = () => {
    if (!canCreateOrEdit) {
      toast.error("Expense permission required");
      return false;
    }

    if (!formData.branch_id) {
      toast.error("Please select branch");
      return false;
    }

    const amount = toNumber(formData.amount, NaN);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter valid amount");
      return false;
    }

    if (amount > 999999999) {
      toast.error("Expense amount is too large");
      return false;
    }

    if (!validateCategoryName(formData.category)) {
      return false;
    }

    if (!isValidDate(formData.expense_date)) {
      toast.error("Please select valid expense date");
      return false;
    }

    if (cleanString(formData.notes).length > 1000) {
      toast.error("Notes must be less than 1000 characters");
      return false;
    }

    return true;
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
      const updatedBranches = getList(branchRes.data, "branches").filter(
        (branch) =>
          branch.status === "active" ||
          branch.status === 1 ||
          branch.status === true,
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

  const handleCreateVendor = async () => {
    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }

    if (!validateVendorForm()) return;

    try {
      setVendorLoading(true);

      const payload = {
        ...vendorForm,
        vendor_name: cleanString(vendorForm.vendor_name),
        company_name: cleanString(vendorForm.company_name),
        email: normalizeEmail(vendorForm.email),
        phone: cleanString(vendorForm.phone),
        gstin: normalizeUpper(vendorForm.gstin),
        billing_address: cleanString(vendorForm.address),
        address: cleanString(vendorForm.address),
        city: cleanString(vendorForm.city),
        state: cleanString(vendorForm.state),
        country: cleanString(vendorForm.country) || "India",
        zip_code: cleanString(vendorForm.zip_code),
        notes: cleanString(vendorForm.notes),
        status: cleanString(vendorForm.status).toLowerCase() || "active",
      };

      const res = await api.post("/vendors", payload);
      const newVendor = res.data?.vendor || res.data;

      const vendorRes = await api.get("/vendors");
      const updatedVendors = getList(vendorRes.data, "vendors").filter(
        (v) => v.status === "active",
      );

      setVendors(updatedVendors);

      const selectedVendor =
        newVendor?.id ||
        newVendor?.vendor_id ||
        updatedVendors.find(
          (vendor) =>
            vendor.vendor_name?.toLowerCase() ===
            payload.vendor_name.toLowerCase(),
        )?.id;

      if (selectedVendor) {
        setFormData((prev) => ({
          ...prev,
          vendor_id: String(selectedVendor),
        }));
      }

      resetVendorForm();
      setShowVendorModal(false);
      toast.success("Vendor added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Vendor create failed");
    } finally {
      setVendorLoading(false);
    }
  };

  const handleCreateCategory = () => {
    const finalCategory = validateCategoryName(categoryName);

    if (!finalCategory) return;

    const alreadyExists = categories.some(
      (category) => category.toLowerCase() === finalCategory.toLowerCase(),
    );

    if (!alreadyExists) {
      setCategories((prev) => [...prev, finalCategory]);
    }

    setFormData((prev) => ({
      ...prev,
      category: finalCategory,
    }));

    setCategoryName("");
    setShowCategoryModal(false);
    toast.success("Category added successfully");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateExpenseForm()) return;

    const payload = {
      ...formData,
      vendor_id: formData.vendor_id || null,
      branch_id: formData.branch_id,
      amount: Number(formData.amount || 0),
      category: cleanString(formData.category),
      notes: cleanString(formData.notes),
      expense_date: formData.expense_date,
    };

    try {
      setLoading(true);

      if (editId) {
        await api.put(`/expenses/${editId}`, payload);
        toast.success("Expense updated successfully");
      } else {
        await api.post("/expenses", payload);
        toast.success("Expense added successfully");
      }

      closeExpenseModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Expense save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    if (!canDelete) {
      toast.error("Expense permission required");
      return;
    }

    confirmToast("Delete this expense?", async () => {
      try {
        await api.delete(`/expenses/${id}`);
        toast.success("Expense deleted successfully");
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.message || "Delete failed");
      }
    });
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
              <Wallet size={17} />
              Expense Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Expenses
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track branch-wise company expenses. Vendor is optional for direct
              company expenses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateOrEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex w-fit items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Plus size={17} />
                Add Expense
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          title="Total Expenses"
          value={`₹ ${stats.totalExpense.toFixed(2)}`}
          icon={<IndianRupee size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        />
        <SummaryCard
          title="This Month"
          value={`₹ ${stats.monthlyExpense.toFixed(2)}`}
          icon={<CalendarDays size={20} />}
          color="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
        />
        <SummaryCard
          title="Total Records"
          value={stats.records}
          icon={<CheckCircle size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        />
        <SummaryCard
          title="Categories"
          value={stats.categories}
          icon={<Tag size={20} />}
          color="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Expense History
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Search, filter and manage branch-wise expenses.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Search expense"
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
                  { value: "", label: "All Branches" },
                  ...(Array.isArray(branches) ? branches : []).map(
                    (branch) => ({
                      value: String(branch.id),
                      label: `${branch.branch_name}${
                        branch.branch_code ? ` (${branch.branch_code})` : ""
                      }`,
                    }),
                  ),
                ]}
              />

              <CustomDropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                icon={<Tag size={16} />}
                options={[
                  { value: "", label: "All Categories" },
                  ...(Array.isArray(categories) ? categories : []).map(
                    (category) => ({
                      value: category,
                      label: category,
                    }),
                  ),
                ]}
              />
            </div>
          </div>
        </div>

        <ExpenseTable
          expenses={paginatedExpenses}
          canCreateOrEdit={canCreateOrEdit}
          canDelete={canDelete}
          formatDate={formatDate}
          onView={setViewExpense}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-red-950/50"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            {sortedExpenses.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedExpenses.length)}
            {" of "}
            {sortedExpenses.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showExpenseModal && (
        <FormModal
          title={editId ? "Update Expense" : "Add Expense"}
          description="Vendor optional hai. Direct company expense ke liye vendor blank chhod sakte ho."
          icon={<Wallet size={21} />}
          onClose={closeExpenseModal}
        >
          <ExpenseForm
            formData={formData}
            branches={activeBranches}
            vendors={vendors}
            categories={categories}
            editId={editId}
            loading={loading}
            canManageBranches={canManageBranches}
            canManageVendors={canManageVendors}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeExpenseModal}
          />
        </FormModal>
      )}

      {viewExpense && (
        <ExpenseViewModal
          expense={viewExpense}
          formatDate={formatDate}
          onClose={() => setViewExpense(null)}
        />
      )}

      {showBranchModal && (
        <FormModal
          title="Add New Branch"
          description="Create branch without leaving expense page."
          icon={<GitBranch size={21} />}
          onClose={() => setShowBranchModal(false)}
        >
          <BranchForm
            branchForm={branchForm}
            branchLoading={branchLoading}
            handleBranchChange={handleBranchChange}
            handleCreateBranch={handleCreateBranch}
            onCancel={() => setShowBranchModal(false)}
          />
        </FormModal>
      )}

      {showVendorModal && (
        <FormModal
          title="Add New Vendor"
          description="Create vendor without leaving expense page."
          icon={<Truck size={21} />}
          onClose={() => setShowVendorModal(false)}
        >
          <VendorForm
            vendorForm={vendorForm}
            vendorLoading={vendorLoading}
            handleVendorChange={handleVendorChange}
            handleCreateVendor={handleCreateVendor}
            onCancel={() => setShowVendorModal(false)}
          />
        </FormModal>
      )}

      {showCategoryModal && (
        <FormModal
          title="Add New Category"
          description="Create a custom expense category for this expense."
          icon={<Tag size={21} />}
          onClose={() => setShowCategoryModal(false)}
        >
          <CategoryForm
            categoryName={categoryName}
            setCategoryName={setCategoryName}
            handleCreateCategory={handleCreateCategory}
            onCancel={() => setShowCategoryModal(false)}
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
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px #fee2e2;
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
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(127, 29, 29, 0.35);
        }
      `}</style>
    </div>
  );
}

function ExpenseTable({
  expenses,
  canCreateOrEdit,
  canDelete,
  formatDate,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {[
              "Branch",
              "Vendor",
              "Category",
              "Amount",
              "Date",
              "Notes",
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
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {expense.branch_code
                  ? `${expense.branch_name} (${expense.branch_code})`
                  : expense.branch_name || "-"}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {expense.vendor_name || "Direct Company Expense"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {expense.vendor_company_name || ""}
                </p>
              </td>

              <td className="p-4 font-semibold text-slate-900 dark:text-white">
                {expense.category || "-"}
              </td>
              <td className="p-4 font-bold text-red-600 dark:text-red-400">
                ₹ {Number(expense.amount || 0).toFixed(2)}
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {formatDate(expense.expense_date)}
              </td>

              <td className="max-w-xs p-4 text-slate-600 dark:text-slate-300">
                <p className="truncate">{expense.notes || "-"}</p>
              </td>

              <td className="p-4">
                <div className="flex items-center gap-2">
                  <IconButton
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100"
                    onClick={() => onView(expense)}
                  />

                  {canCreateOrEdit && (
                    <IconButton
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                      onClick={() => onEdit(expense)}
                    />
                  )}

                  {canDelete && (
                    <IconButton
                      icon={<Trash2 size={16} />}
                      className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950"
                      onClick={() => onDelete(expense.id)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}

          {expenses.length === 0 && (
            <tr>
              <td colSpan="7" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Wallet className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No expenses found
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

function ExpenseForm({
  formData,
  branches,
  vendors,
  categories,
  editId,
  loading,
  canManageBranches,
  canManageVendors,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputWrapper label="Branch" icon={<Building2 size={16} />}>
          <SearchableDropdown
            value={String(formData.branch_id || "")}
            placeholder="Select Branch"
            searchPlaceholder="Search branch..."
            emptyText="No branch found"
            options={[
              ...(Array.isArray(branches) ? branches : []).map((branch) => ({
                value: String(branch.id),
                label: branch.branch_code
                  ? `${branch.branch_name} (${branch.branch_code})`
                  : branch.branch_name || "Unnamed Branch",
                description:
                  branch.is_main === 1 || branch.is_main === true
                    ? "HQ Branch"
                    : "Company branch",
              })),

              ...(canManageBranches
                ? [
                    {
                      value: "__add_branch__",
                      label: "Add New Branch",
                      isAdd: true,
                    },
                  ]
                : []),
            ]}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "branch_id",
                  value,
                },
              })
            }
          />
        </InputWrapper>

        <InputWrapper label="Vendor" icon={<Truck size={16} />}>
          <SearchableDropdown
            value={String(formData.vendor_id || "")}
            placeholder="Direct Company Expense"
            searchPlaceholder="Search vendor..."
            emptyText="No vendor found"
            options={[
              {
                value: "",
                label: "Direct Company Expense",
                description: "No vendor selected",
              },

              ...(Array.isArray(vendors) ? vendors : []).map((vendor) => ({
                value: String(vendor.id),
                label: vendor.vendor_name || "Unnamed Vendor",
                description:
                  vendor.company_name || vendor.email || "No company name",
              })),

              ...(canManageVendors
                ? [
                    {
                      value: "__add_vendor__",
                      label: "Add New Vendor",
                      isAdd: true,
                    },
                  ]
                : []),
            ]}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "vendor_id",
                  value,
                },
              })
            }
          />
        </InputWrapper>

        <InputWrapper label="Amount" icon={<IndianRupee size={16} />}>
          <input
            type="number"
            name="amount"
            min="0"
            step="0.01"
            placeholder="Expense amount"
            value={formData.amount}
            onChange={handleChange}
            className="input"
          />
        </InputWrapper>

        <InputWrapper label="Category" icon={<Tag size={16} />}>
          <SearchableDropdown
            value={formData.category}
            placeholder="Select Category"
            searchPlaceholder="Search category..."
            emptyText="No category found"
            options={[
              ...(Array.isArray(categories) ? categories : []).map(
                (category) => ({
                  value: category,
                  label: category,
                  description: "Expense category",
                }),
              ),

              {
                value: "__add_category__",
                label: "Add New Category",
                description: "Create category",
                isAdd: true,
              },
            ]}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "category",
                  value,
                },
              })
            }
          />
        </InputWrapper>

        <InputWrapper label="Expense Date" icon={<CalendarDays size={16} />}>
          <input
            type="date"
            name="expense_date"
            value={formData.expense_date}
            onChange={handleChange}
            className="input"
          />
        </InputWrapper>

        <InputWrapper label="Notes" icon={<StickyNote size={16} />}>
          <input
            type="text"
            name="notes"
            maxLength={1000}
            placeholder="Expense notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
          />
        </InputWrapper>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-400"
        >
          <Save size={16} />
          {loading ? "Saving..." : editId ? "Update Expense" : "Add Expense"}
        </button>
      </div>
    </form>
  );
}

function BranchForm({
  branchForm,
  branchLoading,
  handleBranchChange,
  handleCreateBranch,
  onCancel,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Input
          icon={<Building2 size={16} />}
          label="Branch Name"
          name="branch_name"
          value={branchForm.branch_name}
          onChange={handleBranchChange}
          required
        />
        <Input
          icon={<Hash size={16} />}
          label="Branch Code"
          name="branch_code"
          value={branchForm.branch_code}
          onChange={handleBranchChange}
        />
        <Input
          icon={<Mail size={16} />}
          label="Email"
          name="email"
          type="email"
          value={branchForm.email}
          onChange={handleBranchChange}
        />
        <Input
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={branchForm.phone}
          onChange={handleBranchChange}
        />
        <Input
          icon={<BadgePercent size={16} />}
          label="GST Number"
          name="gst_number"
          value={branchForm.gst_number}
          onChange={handleBranchChange}
        />
        <Input
          icon={<MapPin size={16} />}
          label="City"
          name="city"
          value={branchForm.city}
          onChange={handleBranchChange}
        />
        <Input
          icon={<MapPin size={16} />}
          label="State"
          name="state"
          value={branchForm.state}
          onChange={handleBranchChange}
        />
        <Input
          icon={<Globe size={16} />}
          label="Country"
          name="country"
          value={branchForm.country}
          onChange={handleBranchChange}
        />
        <Input
          icon={<Hash size={16} />}
          label="ZIP Code"
          name="zip_code"
          value={branchForm.zip_code}
          onChange={handleBranchChange}
        />

        <Field icon={<CheckCircle size={16} />} label="Status">
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
            icon={<CheckCircle size={16} />}
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

      <ModalActions
        onCancel={onCancel}
        onSave={handleCreateBranch}
        loading={branchLoading}
        saveText="Save Branch"
      />
    </>
  );
}

function VendorForm({
  vendorForm,
  vendorLoading,
  handleVendorChange,
  handleCreateVendor,
  onCancel,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Input
          icon={<Truck size={16} />}
          label="Vendor Name"
          name="vendor_name"
          value={vendorForm.vendor_name}
          onChange={handleVendorChange}
          required
        />
        <Input
          icon={<Building2 size={16} />}
          label="Company Name"
          name="company_name"
          value={vendorForm.company_name}
          onChange={handleVendorChange}
        />
        <Input
          icon={<Mail size={16} />}
          label="Email"
          name="email"
          type="email"
          value={vendorForm.email}
          onChange={handleVendorChange}
        />
        <Input
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={vendorForm.phone}
          onChange={handleVendorChange}
        />
        <Input
          icon={<BadgePercent size={16} />}
          label="GSTIN"
          name="gstin"
          value={vendorForm.gstin}
          onChange={handleVendorChange}
        />

        <Field icon={<CheckCircle size={16} />} label="Status">
          <CustomDropdown
            value={vendorForm.status}
            onChange={(value) =>
              handleVendorChange({
                target: {
                  name: "status",
                  value,
                },
              })
            }
            icon={<CheckCircle size={16} />}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>

        <Input
          icon={<MapPin size={16} />}
          label="City"
          name="city"
          value={vendorForm.city}
          onChange={handleVendorChange}
        />
        <Input
          icon={<MapPin size={16} />}
          label="State"
          name="state"
          value={vendorForm.state}
          onChange={handleVendorChange}
        />
        <Input
          icon={<Globe size={16} />}
          label="Country"
          name="country"
          value={vendorForm.country}
          onChange={handleVendorChange}
        />
        <Input
          icon={<Hash size={16} />}
          label="ZIP Code"
          name="zip_code"
          value={vendorForm.zip_code}
          onChange={handleVendorChange}
        />

        <div className="md:col-span-2 xl:col-span-3">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <MapPin size={16} />
            Address
          </label>
          <textarea
            name="address"
            value={vendorForm.address}
            onChange={handleVendorChange}
            rows="3"
            className="input"
          />
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <StickyNote size={16} />
            Notes
          </label>
          <textarea
            name="notes"
            value={vendorForm.notes}
            onChange={handleVendorChange}
            rows="3"
            className="input"
          />
        </div>
      </div>

      <ModalActions
        onCancel={onCancel}
        onSave={handleCreateVendor}
        loading={vendorLoading}
        saveText="Save Vendor"
      />
    </>
  );
}

function CategoryForm({
  categoryName,
  setCategoryName,
  handleCreateCategory,
  onCancel,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          icon={<Tag size={16} />}
          label="Category Name"
          name="category_name"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          required
        />
      </div>

      <ModalActions
        onCancel={onCancel}
        onSave={handleCreateCategory}
        saveText="Save Category"
      />
    </>
  );
}

function ExpenseViewModal({ expense, formatDate, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[50000] isolate flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <Wallet size={28} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {expense.category || "Expense Details"}
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Complete expense information
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <ViewField
              label="Branch"
              value={
                expense.branch_code
                  ? `${expense.branch_name} (${expense.branch_code})`
                  : expense.branch_name || "-"
              }
            />

            <ViewField
              label="Vendor"
              value={expense.vendor_name || "Direct Company Expense"}
            />

            <ViewField
              label="Vendor Company"
              value={expense.vendor_company_name}
            />

            <ViewField label="Category" value={expense.category} />

            <ViewField
              label="Amount"
              value={`₹ ${Number(expense.amount || 0).toFixed(2)}`}
            />

            <ViewField
              label="Expense Date"
              value={formatDate(expense.expense_date)}
            />

            <ViewField label="Notes" value={expense.notes} full />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[50000] isolate flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-5">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {icon}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {title}
              </h2>

              {description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModalActions({ onSave, onCancel, saveText, loading = false }) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <X size={16} />
        Cancel
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-400"
      >
        <Save size={16} />
        {loading ? "Saving..." : saveText}
      </button>
    </div>
  );
}

function SummaryCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
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
    `${option.label || ""} ${option.description || ""}`
      .toLowerCase()
      .includes(keyword.trim().toLowerCase()),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 330;
    const spaceBelow = window.innerHeight - rect.bottom;
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
    setKeyword("");
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-500 dark:focus:ring-red-950/50"
      >
        <span className="min-w-0 truncate">
          {selected?.label || placeholder}
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-red-950/50"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full rounded-xl px-3 py-2 text-left transition ${
                  option.isAdd
                    ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950"
                    : `hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        String(value || "") === String(option.value)
                          ? "bg-red-50 dark:bg-red-950/40"
                          : ""
                      }`
                }`}
              >
                <p
                  className={`truncate text-sm font-medium ${
                    option.isAdd
                      ? "text-red-700 dark:text-red-300"
                      : "text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {option.isAdd ? `+ ${option.label}` : option.label}
                </p>

                {option.description && (
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {option.description}
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
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-500 dark:focus:ring-red-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="text-slate-400 dark:text-slate-500">{icon}</span>
          )}
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
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-slate-800 dark:hover:text-red-300 ${
                String(value) === String(option.value)
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="truncate">{option.label}</span>

              {String(value) === String(option.value) && (
                <CheckCircle size={16} className="shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InputWrapper({ label, icon, children }) {
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

function Input({
  icon,
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
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
        className="input"
      />
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

export default Expenses;
