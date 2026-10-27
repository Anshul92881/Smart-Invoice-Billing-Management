import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import {
  Percent,
  Pencil,
  Trash2,
  Search,
  BadgePercent,
  X,
  ShieldCheck,
  Plus,
  Save,
  Eye,
  Filter,
  Download,
  FileText,
  RotateCcw,
  XCircle,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { create } from "axios";

const ALLOWED_TAX_TYPES = ["GST", "CGST_SGST", "IGST", "TDS", "TCS", "OTHER"];
const HSN_SAC_REGEX = /^[0-9]{4,8}$/;
const TAX_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),/_-]+$/;

const cleanString = (value) =>
  String(value || "")
    .replace(/<[^>]*>?/gm, "")
    .trim();

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

function Taxes() {
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
  }, [user?.role]);

  const canManage =
    user?.role === "company_admin" ||
    user?.role === "accountant" ||
    Boolean(user?.permissions?.taxes) ||
    Boolean(rolePermissions?.[user?.role]?.taxes);

  const canDelete = canManage;

  const initialForm = {
    tax_name: "",
    tax_type: "GST",
    hsn_sac_code: "",
    tax_percentage: "",
    cgst_percentage: "",
    sgst_percentage: "",
    igst_percentage: "",
    tds_percentage: "",
    tcs_percentage: "",
    reverse_charge: false,
    is_active: true,
    description: "",
  };

  const [taxes, setTaxes] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [viewTax, setViewTax] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sampleAmount, setSampleAmount] = useState(10000);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchTaxes = async () => {
    try {
      const res = await api.get("/taxes", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter,
          limit: 1000,
        },
      });

      setTaxes(getList(res.data, "taxes"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch taxes");
      setTaxes([]);
    }
  };

  useEffect(() => {
    fetchTaxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredTaxes = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const list = Array.isArray(taxes) ? taxes : [];

    return list.filter((tax) => {
      const isActive = Number(tax.is_active) === 1;

      const matchesSearch =
        !keyword ||
        tax.tax_name?.toLowerCase().includes(keyword) ||
        tax.tax_type?.toLowerCase().includes(keyword) ||
        tax.hsn_sac_code?.toLowerCase().includes(keyword) ||
        tax.description?.toLowerCase().includes(keyword);

      const matchesType = typeFilter === "all" || tax.tax_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [taxes, search, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const list = Array.isArray(taxes) ? taxes : [];

    const active = list.filter((tax) => Number(tax.is_active) === 1).length;
    const reverseCharge = list.filter(
      (tax) => Number(tax.reverse_charge) === 1,
    ).length;
    const hsnSac = list.filter((tax) => tax.hsn_sac_code).length;

    return {
      total: list.length,
      active,
      inactive: list.length - active,
      reverseCharge,
      hsnSac,
    };
  }, [taxes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter]);

  const sortedTaxes = useMemo(() => {
    return [...filteredTaxes].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredTaxes]);

  const totalPages = Math.ceil(sortedTaxes.length / itemsPerPage);

  const paginatedTaxes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTaxes.slice(start, start + itemsPerPage);
  }, [sortedTaxes, currentPage, itemsPerPage]);

  const preview = useMemo(() => {
    const base = Number(sampleAmount || 0);

    const cgst = (base * Number(formData.cgst_percentage || 0)) / 100;
    const sgst = (base * Number(formData.sgst_percentage || 0)) / 100;
    const igst = (base * Number(formData.igst_percentage || 0)) / 100;
    const tds = (base * Number(formData.tds_percentage || 0)) / 100;
    const tcs = (base * Number(formData.tcs_percentage || 0)) / 100;

    const outputTax = cgst + sgst + igst + tcs;
    const finalAmount = base + outputTax - tds;

    return {
      base,
      cgst,
      sgst,
      igst,
      tds,
      tcs,
      outputTax,
      finalAmount,
    };
  }, [sampleAmount, formData]);

  const clearError = (name) => {
    if (!errors[name]) return;

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "tax_type") {
      setFormData((prev) => ({
        ...prev,
        tax_type: value,
        tax_percentage: "",
        cgst_percentage: "",
        sgst_percentage: "",
        igst_percentage: "",
        tds_percentage: "",
        tcs_percentage: "",
      }));
      setErrors({});
      return;
    }

    if (name === "tax_percentage") {
      const rate = Number(value || 0);

      if (formData.tax_type === "GST" || formData.tax_type === "CGST_SGST") {
        setFormData((prev) => ({
          ...prev,
          tax_percentage: value,
          cgst_percentage: value === "" ? "" : rate / 2,
          sgst_percentage: value === "" ? "" : rate / 2,
          igst_percentage: 0,
          tds_percentage: 0,
          tcs_percentage: 0,
        }));
        clearError(name);
        return;
      }

      if (formData.tax_type === "IGST") {
        setFormData((prev) => ({
          ...prev,
          tax_percentage: value,
          cgst_percentage: 0,
          sgst_percentage: 0,
          igst_percentage: value === "" ? "" : rate,
          tds_percentage: 0,
          tcs_percentage: 0,
        }));
        clearError(name);
        return;
      }

      if (formData.tax_type === "TDS") {
        setFormData((prev) => ({
          ...prev,
          tax_percentage: value,
          cgst_percentage: 0,
          sgst_percentage: 0,
          igst_percentage: 0,
          tds_percentage: value === "" ? "" : rate,
          tcs_percentage: 0,
        }));
        clearError(name);
        return;
      }

      if (formData.tax_type === "TCS") {
        setFormData((prev) => ({
          ...prev,
          tax_percentage: value,
          cgst_percentage: 0,
          sgst_percentage: 0,
          igst_percentage: 0,
          tds_percentage: 0,
          tcs_percentage: value === "" ? "" : rate,
        }));
        clearError(name);
        return;
      }
    }

    const nextValue =
      name === "hsn_sac_code"
        ? normalizeUpper(value)
        : type === "checkbox"
          ? checked
          : value;

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    clearError(name);
  };

  const resetForm = () => {
    setFormData(initialForm);
    setErrors({});
    setEditId(null);
  };

  const openCreateModal = () => {
    if (!canManage) {
      toast.error("Tax permission required");
      return;
    }

    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (tax) => {
    if (!canManage) {
      toast.error("Tax permission required");
      return;
    }

    setEditId(tax.id);
    setErrors({});

    setFormData({
      tax_name: tax.tax_name || "",
      tax_type: tax.tax_type || "GST",
      hsn_sac_code: tax.hsn_sac_code || "",
      tax_percentage:
        tax.tax_percentage === null || tax.tax_percentage === undefined
          ? ""
          : String(tax.tax_percentage),
      cgst_percentage:
        tax.cgst_percentage === null || tax.cgst_percentage === undefined
          ? ""
          : String(tax.cgst_percentage),
      sgst_percentage:
        tax.sgst_percentage === null || tax.sgst_percentage === undefined
          ? ""
          : String(tax.sgst_percentage),
      igst_percentage:
        tax.igst_percentage === null || tax.igst_percentage === undefined
          ? ""
          : String(tax.igst_percentage),
      tds_percentage:
        tax.tds_percentage === null || tax.tds_percentage === undefined
          ? ""
          : String(tax.tds_percentage),
      tcs_percentage:
        tax.tcs_percentage === null || tax.tcs_percentage === undefined
          ? ""
          : String(tax.tcs_percentage),
      reverse_charge: Number(tax.reverse_charge) === 1,
      is_active: Number(tax.is_active) === 1,
      description: tax.description || "",
    });

    setShowFormModal(true);
  };

  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };

  const validatePercentage = (value, label) => {
    const number = toNumber(value, NaN);

    if (Number.isNaN(number)) {
      return `${label} must be a valid number`;
    }

    if (number < 0 || number > 100) {
      return `${label} must be between 0 and 100`;
    }

    return "";
  };

  const validateForm = () => {
    const nextErrors = {};

    const taxName = cleanString(formData.tax_name);
    const taxType = cleanString(formData.tax_type);
    const hsnSac = normalizeUpper(formData.hsn_sac_code);
    const description = cleanString(formData.description);

    if (!taxName) {
      nextErrors.tax_name = "Tax name is required";
    } else if (taxName.length < 2 || taxName.length > 100) {
      nextErrors.tax_name = "Tax name must be between 2 and 100 characters";
    } else if (!TAX_NAME_REGEX.test(taxName)) {
      nextErrors.tax_name = "Tax name contains invalid characters";
    }

    if (!ALLOWED_TAX_TYPES.includes(taxType)) {
      nextErrors.tax_type = `Tax type must be one of: ${ALLOWED_TAX_TYPES.join(
        ", ",
      )}`;
    }

    const percentageFields = [
      ["tax_percentage", "Tax percentage"],
      ["cgst_percentage", "CGST percentage"],
      ["sgst_percentage", "SGST percentage"],
      ["igst_percentage", "IGST percentage"],
      ["tds_percentage", "TDS percentage"],
      ["tcs_percentage", "TCS percentage"],
    ];

    percentageFields.forEach(([field, label]) => {
      const error = validatePercentage(formData[field], label);
      if (error) nextErrors[field] = error;
    });

    if (taxType === "GST" || taxType === "CGST_SGST") {
      const taxPercentage = toNumber(formData.tax_percentage);
      const splitTotal =
        toNumber(formData.cgst_percentage) + toNumber(formData.sgst_percentage);

      if (Number(splitTotal.toFixed(2)) !== Number(taxPercentage.toFixed(2))) {
        nextErrors.cgst_percentage = "CGST + SGST must equal tax percentage";
        nextErrors.sgst_percentage = "CGST + SGST must equal tax percentage";
      }
    }

    if (hsnSac && !HSN_SAC_REGEX.test(hsnSac)) {
      nextErrors.hsn_sac_code = "HSN/SAC code must be 4 to 8 digits";
    }

    if (description && description.length > 500) {
      nextErrors.description = "Description must be less than 500 characters";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = () => ({
    tax_name: cleanString(formData.tax_name),
    tax_type: cleanString(formData.tax_type) || "GST",

    // Preserve the existing HSN on old tax records.
    // New tax rules will have an empty HSN.
    hsn_sac_code: normalizeUpper(formData.hsn_sac_code),

    tax_percentage:
      formData.tax_percentage === "" ? "" : Number(formData.tax_percentage),

    cgst_percentage:
      formData.cgst_percentage === "" ? 0 : Number(formData.cgst_percentage),

    sgst_percentage:
      formData.sgst_percentage === "" ? 0 : Number(formData.sgst_percentage),

    igst_percentage:
      formData.igst_percentage === "" ? 0 : Number(formData.igst_percentage),

    tds_percentage:
      formData.tds_percentage === "" ? 0 : Number(formData.tds_percentage),

    tcs_percentage:
      formData.tcs_percentage === "" ? 0 : Number(formData.tcs_percentage),

    reverse_charge: Boolean(formData.reverse_charge),
    is_active: Boolean(formData.is_active),
    description: cleanString(formData.description),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManage) {
      toast.error("Tax permission required");
      return;
    }

    if (!validateForm()) return;

    try {
      setLoading(true);

      const payload = buildPayload();

      if (editId) {
        await api.put(`/taxes/${editId}`, payload);
        toast.success("Tax updated successfully");
      } else {
        await api.post("/taxes", payload);
        toast.success("Tax added successfully");
      }

      closeFormModal();
      fetchTaxes();
    } catch (error) {
      toast.error(error.response?.data?.message || "Tax save failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmToast = (message, onConfirm) => {
    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {message}
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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

  const handleDelete = (tax) => {
    if (!canDelete) {
      toast.error("Tax permission required");
      return;
    }

    if (Number(tax.is_active) === 0) {
      toast.error("Tax already inactive");
      return;
    }

    confirmToast("Deactivate this tax rule?", async () => {
      try {
        await api.delete(`/taxes/${tax.id}`);
        toast.success("Tax deactivated successfully");
        fetchTaxes();
      } catch (error) {
        toast.error(error.response?.data?.message || "Deactivate failed");
      }
    });
  };

  const exportGSTSummary = () => {
    if (!filteredTaxes.length) {
      toast.error("No tax rules available to export");
      return;
    }

    const headers = [
      "Tax Name",
      "Tax Type",
      "HSN/SAC",
      "Tax %",
      "CGST %",
      "SGST %",
      "IGST %",
      "TDS %",
      "TCS %",
      "Reverse Charge",
      "Status",
      "Description",
    ];

    const rows = filteredTaxes.map((tax) => [
      tax.tax_name || "",
      tax.tax_type || "",
      tax.hsn_sac_code || "",
      tax.tax_percentage || 0,
      tax.cgst_percentage || 0,
      tax.sgst_percentage || 0,
      tax.igst_percentage || 0,
      tax.tds_percentage || 0,
      tax.tcs_percentage || 0,
      Number(tax.reverse_charge) === 1 ? "Yes" : "No",
      Number(tax.is_active) === 1 ? "Active" : "Inactive",
      tax.description || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `gst_tax_summary_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();

    toast.success("GST summary exported successfully");
  };

  const getTaxAmount = (amount, rate) => {
    return (Number(amount || 0) * Number(rate || 0)) / 100;
  };

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <BadgePercent size={17} />
              Tax Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Tax & GST Management
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage GST, CGST, SGST, IGST, TDS, TCS, HSN/SAC and reverse charge
              rules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={exportGSTSummary}
                className="flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Download size={16} />
                Export GST Summary
              </button>
            )}

            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={17} />
                Add Tax Rule
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard
          title="Total Rules"
          value={stats.total}
          icon={<Percent size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        />

        <SummaryCard
          title="Active Rules"
          value={stats.active}
          icon={<ShieldCheck size={20} />}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        />

        <SummaryCard
          title="Inactive"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        />

        <SummaryCard
          title="Reverse Charge"
          value={stats.reverseCharge}
          icon={<RotateCcw size={20} />}
          color="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
        />

        <SummaryCard
          title="HSN/SAC Rules"
          value={stats.hsnSac}
          icon={<FileText size={20} />}
          color="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                GST / Tax Rules
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                These rules are used for invoice, product and GST summary
                calculations.
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
                  placeholder="Search tax / HSN / SAC"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>

              <CustomDropdown
                value={typeFilter}
                onChange={setTypeFilter}
                icon={<Filter size={16} />}
                options={[
                  { value: "all", label: "All Types" },
                  { value: "GST", label: "GST" },
                  { value: "CGST_SGST", label: "CGST + SGST" },
                  { value: "IGST", label: "IGST" },
                  { value: "TDS", label: "TDS" },
                  { value: "TCS", label: "TCS" },
                  { value: "OTHER", label: "Other" },
                ]}
              />

              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                icon={<ShieldCheck size={16} />}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </div>
          </div>
        </div>

        <TaxTable
          taxes={paginatedTaxes}
          sampleAmount={sampleAmount}
          canManage={canManage}
          canDelete={canDelete}
          getTaxAmount={getTaxAmount}
          onView={setViewTax}
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            {sortedTaxes.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedTaxes.length)}
            {" of "}
            {sortedTaxes.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
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
              type="button"
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
          title={editId ? "Update Tax Rule" : "Create Tax Rule"}
          description="Configure GST, CGST/SGST/IGST, TDS/TCS, HSN/SAC and reverse charge."
          icon={<BadgePercent size={21} />}
          onClose={closeFormModal}
        >
          <TaxForm
            formData={formData}
            errors={errors}
            sampleAmount={sampleAmount}
            setSampleAmount={setSampleAmount}
            preview={preview}
            loading={loading}
            editId={editId}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {viewTax && (
        <TaxViewModal
          tax={viewTax}
          sampleAmount={sampleAmount}
          getTaxAmount={getTaxAmount}
          onClose={() => setViewTax(null)}
        />
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
      `}</style>
    </div>
  );
}

function TaxTable({
  taxes,
  sampleAmount,
  canManage,
  canDelete,
  getTaxAmount,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1150px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {[
              "Tax Rule",
              "Type",
              "HSN/SAC",
              "GST %",
              "CGST/SGST/IGST",
              "TDS/TCS",
              "Reverse",
              "Preview Tax",
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
          {taxes.map((tax) => {
            const taxAmount = getTaxAmount(sampleAmount, tax.tax_percentage);

            return (
              <tr
                key={tax.id}
                className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <td className="p-4">
                  <p className="font-bold text-slate-900 dark:text-white">
                    {tax.tax_name || "-"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tax.description || "No description"}
                  </p>
                </td>

                <td className="p-4 text-slate-600 dark:text-slate-300">
                  {tax.tax_type || "-"}
                </td>

                <td className="p-4 text-slate-600 dark:text-slate-300">
                  {tax.hsn_sac_code || "-"}
                </td>

                <td className="p-4 font-semibold text-slate-900 dark:text-white">
                  {Number(tax.tax_percentage || 0)}%
                </td>

                <td className="p-4 text-slate-600 dark:text-slate-300">
                  <p>CGST: {Number(tax.cgst_percentage || 0)}%</p>
                  <p>SGST: {Number(tax.sgst_percentage || 0)}%</p>
                  <p>IGST: {Number(tax.igst_percentage || 0)}%</p>
                </td>

                <td className="p-4 text-slate-600 dark:text-slate-300">
                  <p>TDS: {Number(tax.tds_percentage || 0)}%</p>
                  <p>TCS: {Number(tax.tcs_percentage || 0)}%</p>
                </td>

                <td className="p-4">
                  {Number(tax.reverse_charge) === 1 ? (
                    <StatusPill
                      text="Yes"
                      className="border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300"
                    />
                  ) : (
                    <StatusPill
                      text="No"
                      className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    />
                  )}
                </td>

                <td className="p-4 font-bold text-blue-600 dark:text-blue-400">
                  ₹ {taxAmount.toFixed(2)}
                </td>

                <td className="p-4">
                  <StatusBadge active={Number(tax.is_active) === 1} />
                </td>

                <td className="p-4">
                  <div className="flex gap-2">
                    <IconButton
                      icon={<Eye size={16} />}
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                      onClick={() => onView(tax)}
                    />

                    {canManage && (
                      <IconButton
                        icon={<Pencil size={16} />}
                        className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                        onClick={() => onEdit(tax)}
                      />
                    )}

                    {canDelete && Number(tax.is_active) === 1 && (
                      <IconButton
                        icon={<Trash2 size={16} />}
                        className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                        onClick={() => onDelete(tax)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {taxes.length === 0 && (
            <tr>
              <td colSpan="10" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <BadgePercent className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No tax rules found
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

function TaxForm({
  formData,
  errors,
  sampleAmount,
  setSampleAmount,
  preview,
  loading,
  editId,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Section title="Tax Rule Details">
        <Input
          label="Tax Name"
          name="tax_name"
          value={formData.tax_name}
          onChange={handleChange}
          error={errors.tax_name}
          placeholder="GST 18%"
          required
        />

        <Field label="Tax Type" error={errors.tax_type}>
          <CustomDropdown
            value={formData.tax_type}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "tax_type",
                  value,
                },
              })
            }
            icon={<Filter size={16} />}
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

        <Input
          label="Total Tax %"
          type="number"
          step="0.01"
          name="tax_percentage"
          value={formData.tax_percentage}
          onChange={handleChange}
          error={errors.tax_percentage}
          placeholder="18"
          required
        />
      </Section>

      <Section title="GST / TDS / TCS Split">
        <Input
          label="CGST %"
          type="number"
          step="0.01"
          name="cgst_percentage"
          value={formData.cgst_percentage}
          onChange={handleChange}
          error={errors.cgst_percentage}
        />

        <Input
          label="SGST %"
          type="number"
          step="0.01"
          name="sgst_percentage"
          value={formData.sgst_percentage}
          onChange={handleChange}
          error={errors.sgst_percentage}
        />

        <Input
          label="IGST %"
          type="number"
          step="0.01"
          name="igst_percentage"
          value={formData.igst_percentage}
          onChange={handleChange}
          error={errors.igst_percentage}
        />

        <Input
          label="TDS %"
          type="number"
          step="0.01"
          name="tds_percentage"
          value={formData.tds_percentage}
          onChange={handleChange}
          error={errors.tds_percentage}
        />

        <Input
          label="TCS %"
          type="number"
          step="0.01"
          name="tcs_percentage"
          value={formData.tcs_percentage}
          onChange={handleChange}
          error={errors.tcs_percentage}
        />

        <Input
          label="Sample Amount"
          type="number"
          value={sampleAmount}
          onChange={(e) => setSampleAmount(e.target.value)}
        />
      </Section>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
          Live Tax Calculation Preview
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PreviewBox title="Base Amount" value={preview.base} />

          <PreviewBox title="CGST" value={preview.cgst} />

          <PreviewBox title="SGST" value={preview.sgst} />

          <PreviewBox title="IGST" value={preview.igst} />

          <PreviewBox title="TDS Deduction" value={preview.tds} />

          <PreviewBox title="TCS Amount" value={preview.tcs} />

          <PreviewBox title="Output Tax" value={preview.outputTax} />

          <PreviewBox
            title="Final Amount"
            value={preview.finalAmount}
            highlight
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="reverse_charge"
              checked={formData.reverse_charge}
              onChange={handleChange}
            />
            Reverse Charge Applicable
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Active Tax Rule
          </label>
        </div>

        <div className="mt-4">
          <Field label="Description" error={errors.description}>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`input ${errors.description ? "input-error" : ""}`}
              rows="3"
              placeholder="Tax rule description"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          <Save size={16} />
          {loading ? "Saving..." : editId ? "Update Tax" : "Add Tax"}
        </button>
      </div>
    </form>
  );
}

function TaxViewModal({ tax, sampleAmount, getTaxAmount, onClose }) {
  const cgstAmount = getTaxAmount(sampleAmount, tax.cgst_percentage);
  const sgstAmount = getTaxAmount(sampleAmount, tax.sgst_percentage);
  const igstAmount = getTaxAmount(sampleAmount, tax.igst_percentage);
  const tdsAmount = getTaxAmount(sampleAmount, tax.tds_percentage);
  const tcsAmount = getTaxAmount(sampleAmount, tax.tcs_percentage);
  const totalTax = cgstAmount + sgstAmount + igstAmount + tcsAmount;
  const finalAmount = Number(sampleAmount || 0) + totalTax - tdsAmount;

  return createPortal(
    <div className="fixed inset-0 z-[50000] isolate flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <BadgePercent size={28} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {tax.tax_name || "Tax Details"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                GST / TDS / TCS rule details with sample calculation.
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

        <div className="max-h-[calc(90vh-96px)] overflow-y-auto overflow-x-hidden p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ViewField label="Tax Name" value={tax.tax_name} />
            <ViewField label="Tax Type" value={tax.tax_type} />
            <ViewField label="HSN / SAC" value={tax.hsn_sac_code} />

            <ViewField
              label="Total Tax %"
              value={`${Number(tax.tax_percentage || 0)}%`}
            />
            <ViewField
              label="CGST %"
              value={`${Number(tax.cgst_percentage || 0)}%`}
            />
            <ViewField
              label="SGST %"
              value={`${Number(tax.sgst_percentage || 0)}%`}
            />
            <ViewField
              label="IGST %"
              value={`${Number(tax.igst_percentage || 0)}%`}
            />
            <ViewField
              label="TDS %"
              value={`${Number(tax.tds_percentage || 0)}%`}
            />
            <ViewField
              label="TCS %"
              value={`${Number(tax.tcs_percentage || 0)}%`}
            />

            <ViewField
              label="Reverse Charge"
              value={Number(tax.reverse_charge) === 1 ? "Yes" : "No"}
            />
            <ViewField
              label="Status"
              value={Number(tax.is_active) === 1 ? "Active" : "Inactive"}
            />
            <ViewField label="Description" value={tax.description} full />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              Sample Calculation
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <PreviewBox title="Base Amount" value={sampleAmount} />
              <PreviewBox title="CGST" value={cgstAmount} />
              <PreviewBox title="SGST" value={sgstAmount} />
              <PreviewBox title="IGST" value={igstAmount} />
              <PreviewBox title="TDS" value={tdsAmount} />
              <PreviewBox title="TCS" value={tcsAmount} />
              <PreviewBox title="Output Tax" value={totalTax} />
              <PreviewBox title="Final Amount" value={finalAmount} highlight />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {icon}
            </div>

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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
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

function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
  step,
  placeholder = "",
  error,
  required = false,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <input
        type={type}
        step={step}
        name={name}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
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

function Field({ label, children, error }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
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

    return () => {
      document.removeEventListener("mousedown", closeDropdown);
    };
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
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
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

function PreviewBox({ title, value, highlight = false }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight
          ? "bg-blue-600 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      }`}
    >
      <p className="text-sm font-medium">{title}</p>
      <h3 className="mt-1 text-lg font-bold">
        ₹ {Number(value || 0).toFixed(2)}
      </h3>
    </div>
  );
}

function ViewField({ label, value, full = false }) {
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

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-red-100 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StatusPill({ text, className }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {text}
    </span>
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

export default Taxes;
