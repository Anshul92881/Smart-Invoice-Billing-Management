import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import {
  Truck,
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  Mail,
  Phone,
  BadgePercent,
  Wallet,
  MapPin,
  Building2,
  Eye,
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
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
const getList = (data, key) => {
  if (Array.isArray(data)) return data;
  return data?.[key] || [];
};
function Vendors() {
  const user = JSON.parse(localStorage.getItem("user"));
  const canDelete = user?.role === "company_admin";
  const initialForm = {
    vendor_name: "",
    company_name: "",
    email: "",
    phone: "",
    gstin: "",
    billing_address: "",
    opening_balance: "",
    notes: "",
    status: "Active",
  };
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [viewVendor, setViewVendor] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const canManageVendors =
    user?.role === "company_admin" || Boolean(user?.permissions?.vendors);
  const fetchVendors = async () => {
    try {
      const res = await api.get("/vendors", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter,
          limit: 1000,
        },
      });
      setVendors(getList(res.data, "vendors"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch vendors");
      setVendors([]);
    }
  };
  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);
  const stats = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    const active = list.filter(
      (vendor) => (vendor.status || "active") === "active",
    ).length;
    const gstRegistered = list.filter((vendor) => vendor.gstin).length;
    return {
      total: list.length,
      active,
      inactive: list.length - active,
      gstRegistered,
    };
  }, [vendors]);
  const filteredVendors = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    const list = Array.isArray(vendors) ? vendors : [];
    return list.filter((vendor) => {
      const status = vendor.status || "active";
      const matchesSearch =
        !keyword ||
        vendor.vendor_name?.toLowerCase().includes(keyword) ||
        vendor.company_name?.toLowerCase().includes(keyword) ||
        vendor.email?.toLowerCase().includes(keyword) ||
        vendor.phone?.toLowerCase().includes(keyword) ||
        vendor.gstin?.toLowerCase().includes(keyword) ||
        vendor.billing_address?.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [vendors, search, statusFilter]);
  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredVendors]);
  const totalPages = Math.ceil(sortedVendors.length / itemsPerPage);
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedVendors.slice(start, start + itemsPerPage);
  }, [sortedVendors, currentPage, itemsPerPage]);
  const validateForm = () => {
    const nextErrors = {};
    const vendorName = cleanString(formData.vendor_name);
    const companyName = cleanString(formData.company_name);
    const email = normalizeEmail(formData.email);
    const phone = cleanString(formData.phone);
    const gstin = normalizeUpper(formData.gstin);
    const billingAddress = cleanString(formData.billing_address);
    const openingBalance = toNumber(formData.opening_balance);
    const notes = cleanString(formData.notes);
    const status = cleanString(formData.status).toLowerCase();
    if (!vendorName) {
      nextErrors.vendor_name = "Vendor name is required";
    } else if (vendorName.length < 2 || vendorName.length > 100) {
      nextErrors.vendor_name =
        "Vendor name must be between 2 and 100 characters";
    } else if (!NAME_REGEX.test(vendorName)) {
      nextErrors.vendor_name = "Vendor name contains invalid characters";
    }
    if (companyName && companyName.length > 100) {
      nextErrors.company_name = "Company name must be less than 100 characters";
    } else if (companyName && !NAME_REGEX.test(companyName)) {
      nextErrors.company_name = "Company name contains invalid characters";
    }
    if (email && !EMAIL_REGEX.test(email)) {
      nextErrors.email = "Invalid vendor email format";
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone must be a valid 10 digit Indian mobile number";
    }
    if (gstin && !GST_REGEX.test(gstin)) {
      nextErrors.gstin = "Invalid GST number format";
    }
    if (billingAddress && billingAddress.length > 500) {
      nextErrors.billing_address =
        "Billing address must be less than 500 characters";
    }
    if (Number.isNaN(openingBalance)) {
      nextErrors.opening_balance = "Opening balance must be a valid number";
    } else if (openingBalance < 0) {
      nextErrors.opening_balance = "Opening balance cannot be negative";
    }
    if (notes && notes.length > 500) {
      nextErrors.notes = "Notes must be less than 500 characters";
    }
    if (!["active", "inactive"].includes(status)) {
      nextErrors.status = "Status must be active or inactive";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "gstin") {
      nextValue = normalizeUpper(value);
    }
    if (name === "email") {
      nextValue = normalizeEmail(value);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };
  const resetForm = () => {
    setEditingId(null);
    setFormData(initialForm);
    setErrors({});
  };
  const openCreateModal = () => {
    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }
    resetForm();
    setShowFormModal(true);
  };
  const openEditModal = (vendor) => {
    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }
    setEditingId(vendor.id);
    setErrors({});
    setFormData({
      vendor_name: vendor.vendor_name || "",
      company_name: vendor.company_name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      gstin: vendor.gstin || "",
      billing_address: vendor.billing_address || "",
      opening_balance:
        vendor.opening_balance === null || vendor.opening_balance === undefined
          ? ""
          : String(vendor.opening_balance),
      notes: vendor.notes || "",
      status: vendor.status || "active",
    });
    setShowFormModal(true);
  };
  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };
  const buildPayload = () => ({
    vendor_name: cleanString(formData.vendor_name),
    company_name: cleanString(formData.company_name),
    email: normalizeEmail(formData.email),
    phone: cleanString(formData.phone),
    gstin: normalizeUpper(formData.gstin),
    billing_address: cleanString(formData.billing_address),
    opening_balance:
      formData.opening_balance === "" ? 0 : Number(formData.opening_balance),
    notes: cleanString(formData.notes),
    status: cleanString(formData.status).toLowerCase() || "active",
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }
    if (!validateForm()) return;
    try {
      setSaving(true);
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/vendors/${editingId}`, payload);
        toast.success("Vendor updated successfully");
      } else {
        await api.post("/vendors", payload);
        toast.success("Vendor created successfully");
      }
      closeFormModal();
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (vendor) => {
    if (!canDelete) {
      toast.error("Only Company Admin can change vendor status");
      return;
    }

    const isInactive =
      String(vendor.status || "active")
        .trim()
        .toLowerCase() === "inactive";

    const nextStatus = isInactive ? "active" : "inactive";
    const nextLabel = isInactive ? "Active" : "Inactive";

    confirmToast(`Set this vendor to ${nextLabel}?`, async () => {
      try {
        if (nextStatus === "inactive") {
          await api.delete(`/vendors/${vendor.id}`);
        } else {
          // Same update API and fields used by the Edit form.
          await api.put(`/vendors/${vendor.id}`, {
            vendor_name: cleanString(vendor.vendor_name),
            company_name: cleanString(vendor.company_name),
            email: normalizeEmail(vendor.email),
            phone: cleanString(vendor.phone),
            gstin: normalizeUpper(vendor.gstin),
            billing_address: cleanString(vendor.billing_address),
            opening_balance: Number(vendor.opening_balance || 0),
            notes: cleanString(vendor.notes),
            status: "active",
          });
        }

        toast.success(`Vendor status changed to ${nextLabel}`);
        await fetchVendors();
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Vendor status update failed",
        );
      }
    });
  };

  return (
    <div className="vendor-workspace w-full min-w-0 space-y-5 text-[15px] text-slate-700 dark:text-slate-200">
      {!viewVendor ? (
        <>
          <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-sm text-slate-400">Business / Vendors</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Vendors
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Manage suppliers, service providers and vendor GST details.
              </p>
            </div>
            {canManageVendors && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <Plus size={17} /> Add Vendor
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total Vendors", stats.total, Truck, "blue"],
              ["Active Vendors", stats.active, CheckCircle2, "emerald"],
              ["GST Registered", stats.gstRegistered, BadgePercent, "violet"],
              ["Inactive Vendors", stats.inactive, XCircle, "amber"],
            ].map(([title, value, Icon, tone]) => (
              <StatsCard
                key={title}
                title={title}
                value={value}
                icon={<Icon size={20} />}
                tone={tone}
              />
            ))}
          </div>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 pt-3 dark:border-slate-800 sm:px-5">
              <div
                className="flex min-w-0 flex-wrap gap-x-5"
                aria-label="Vendor status"
              >
                {[
                  ["all", "All Vendors"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                    className={`whitespace-nowrap border-b-2 py-2 text-sm font-medium transition ${statusFilter === value ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Refresh vendors"
                onClick={fetchVendors}
                className="mb-2 shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  aria-label="Search vendors"
                  placeholder="Search by name, contact or GSTIN…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input !pl-10"
                />
              </div>
            </div>
            <VendorTable
              vendors={paginatedVendors}
              canManageVendors={canManageVendors}
              canDelete={canDelete}
              onView={setViewVendor}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
            <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:px-5">
              <span>
                Showing{" "}
                {sortedVendors.length
                  ? (currentPage - 1) * itemsPerPage + 1
                  : 0}
                –{Math.min(currentPage * itemsPerPage, sortedVendors.length)} of{" "}
                {sortedVendors.length} vendors
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2">
                  Rows
                  <select
                    aria-label="Rows per page"
                    value={itemsPerPage}
                    onChange={(event) => {
                      setItemsPerPage(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-normal dark:border-slate-700 dark:bg-slate-900"
                  >
                    {[10, 20, 50, 100].map((count) => (
                      <option key={count} value={count}>
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
        <VendorDetail
          vendor={
            vendors.find((item) => String(item.id) === String(viewVendor.id)) ||
            viewVendor
          }
          onClose={() => setViewVendor(null)}
          onEdit={canManageVendors ? openEditModal : undefined}
        />
      )}
      {showFormModal && (
        <FormModal
          title={editingId ? "Update Vendor" : "Create Vendor"}
          description="Add vendor details for expenses, purchases and reports."
          icon={<Truck size={21} />}
          onClose={closeFormModal}
        >
          <VendorForm
            formData={formData}
            errors={errors}
            editingId={editingId}
            saving={saving}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}
      <style>{`
        .vendor-workspace .input {
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
        .vendor-workspace .input::placeholder {
          color: #94a3b8;
        }
        .vendor-workspace .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
        .vendor-workspace .input-error {
          border-color: #f87171 !important;
        }
        .vendor-workspace .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px #fee2e2 !important;
        }
        .dark .vendor-workspace .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }
        .dark .vendor-workspace .input::placeholder {
          color: #64748b;
        }
        .dark .vendor-workspace .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }
        .dark .vendor-workspace .input-error {
          border-color: #f87171 !important;
        }
      `}</style>
    </div>
  );
}
function VendorTable({
  vendors,
  canManageVendors,
  canDelete,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[650px] table-fixed text-left text-sm">
        <colgroup>
          {[25, 22, 20, 12, 21].map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
        <thead className="bg-blue-50 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {["Vendor", "GST / Balance", "Contact", "Status", "Actions"].map(
              (head) => (
                <th
                  key={head}
                  scope="col"
                  className="px-3 py-3 text-left text-sm font-semibold"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr
              key={vendor.id}
              className="border-t border-slate-100 transition hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <td className="px-3 py-3 text-left align-middle">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <Truck size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-slate-900 dark:text-white">
                      {vendor.vendor_name || "-"}
                    </h3>
                    <p className="break-words text-sm text-slate-500 dark:text-slate-400">
                      {vendor.company_name || "No company name"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-left align-middle text-slate-600 dark:text-slate-300">
                <p className="[overflow-wrap:anywhere]">
                  GSTIN: {vendor.gstin || "-"}
                </p>
                <p className="mt-1 font-medium tabular-nums text-slate-900 dark:text-white">
                  Opening:{" "}
                  <span className="whitespace-nowrap">
                    ₹ {Number(vendor.opening_balance || 0).toFixed(2)}
                  </span>
                </p>
              </td>
              <td className="px-3 py-3 text-left align-middle text-slate-600 dark:text-slate-300">
                <p className="[overflow-wrap:anywhere]">
                  {vendor.email || "-"}
                </p>
                <p>{vendor.phone || "-"}</p>
              </td>
              <td className="px-3 py-3 text-left align-middle">
                <StatusBadge status={vendor.status} />
              </td>
              <td className="px-3 py-3 text-left align-middle">
                <div className="inline-flex flex-nowrap items-center gap-1">
                  <IconButton
                    label="View vendor"
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => onView(vendor)}
                  />
                  {canManageVendors && (
                    <IconButton
                      label="Edit vendor"
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                      onClick={() => onEdit(vendor)}
                    />
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(vendor)}
                      className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition ${
                        String(vendor.status || "active")
                          .trim()
                          .toLowerCase() === "inactive"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                      }`}
                    >
                      {String(vendor.status || "active")
                        .trim()
                        .toLowerCase() === "inactive"
                        ? "Active"
                        : "Inactive"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {vendors.length === 0 && (
            <tr>
              <td colSpan={5} className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Truck className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No vendors found
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
function VendorForm({
  formData,
  errors,
  editingId,
  saving,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <section
        aria-label="Vendor form fields"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <h3 className="font-medium text-slate-900 dark:text-white md:col-span-2">
          Vendor &amp; Contact Details
        </h3>
        <Input
          icon={<Truck size={16} />}
          label="Vendor Name"
          name="vendor_name"
          value={formData.vendor_name}
          onChange={handleChange}
          error={errors.vendor_name}
          required
        />
        <Input
          icon={<Building2 size={16} />}
          label="Company Name"
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          error={errors.company_name}
        />
        <Input
          icon={<Mail size={16} />}
          label="Email"
          type="email"
          name="email"
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
        <h3 className="border-t border-slate-100 pt-4 font-medium text-slate-900 dark:border-slate-800 dark:text-white md:col-span-2">
          Tax &amp; Billing Details
        </h3>
        <Input
          icon={<BadgePercent size={16} />}
          label="GSTIN / Tax ID"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          error={errors.gstin}
        />
        <Input
          icon={<Wallet size={16} />}
          label="Opening Balance"
          type="number"
          name="opening_balance"
          value={formData.opening_balance}
          onChange={handleChange}
          error={errors.opening_balance}
        />
        <Field
          icon={<CheckCircle2 size={16} />}
          label="Status"
          error={errors.status}
        >
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
            icon={<CheckCircle2 size={16} />}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>
        <div className="md:col-span-2">
          <Field
            icon={<MapPin size={16} />}
            label="Billing Address"
            error={errors.billing_address}
          >
            <textarea
              name="billing_address"
              value={formData.billing_address}
              onChange={handleChange}
              rows="3"
              className={`input ${errors.billing_address ? "input-error" : ""}`}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Notes" error={errors.notes}>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className={`input ${errors.notes ? "input-error" : ""}`}
            />
          </Field>
        </div>
      </section>
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
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {editingId ? <Save size={16} /> : <Plus size={16} />}
          {saving ? "Saving..." : editingId ? "Update Vendor" : "Create Vendor"}
        </button>
      </div>
    </form>
  );
}
function VendorDetail({ vendor, onClose, onEdit }) {
  const backRef = useRef(null);
  useEffect(() => {
    backRef.current?.focus();
  }, []);
  const card =
    "min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
  return (
    <section aria-label="Vendor details" className="space-y-5">
      <button
        ref={backRef}
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft size={16} /> Back to Vendors
      </button>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-sm text-slate-500">
            Vendors / Vendor Details
          </p>
          <h1 className="break-words text-2xl font-semibold text-slate-900 dark:text-white">
            {vendor.vendor_name || "Vendor Details"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Contact, tax and billing information
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(vendor)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Pencil size={16} /> Edit Vendor
          </button>
        )}
      </header>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className={`${card} p-5`}>
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <Truck size={25} />
          </span>
          <h2 className="break-words text-lg font-semibold text-slate-900 dark:text-white">
            {vendor.vendor_name || "—"}
          </h2>
          <p className="mb-3 mt-1 break-words text-sm text-slate-500">
            {vendor.company_name || "No company name"}
          </p>
          <StatusBadge status={vendor.status} />
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <ViewField label="Email" value={vendor.email} />
            <ViewField label="Phone" value={vendor.phone} />
          </div>
        </aside>
        <div className="min-w-0 space-y-5">
          <section className={card}>
            <h2 className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
              Billing Details
            </h2>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <ViewField label="GSTIN / Tax ID" value={vendor.gstin} />
              <ViewField
                label="Opening Balance"
                value={`₹ ${Number(vendor.opening_balance || 0).toFixed(2)}`}
              />
              <ViewField
                label="Billing Address"
                value={vendor.billing_address}
                full
              />
            </div>
          </section>
          <section className={`${card} p-5`}>
            <ViewField label="Notes" value={vendor.notes} />
          </section>
        </div>
      </div>
    </section>
  );
}
function FormModal({ title, description, icon, onClose, children }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <div className="vendor-workspace fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/40 dark:text-blue-300">
              {icon}
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-400">
                Vendor Workspace
              </p>
              <h2 className="break-words text-xl font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
function StatsCard({ title, value, icon, tone }) {
  const colors = {
    blue: [
      "border-blue-200 from-blue-50 dark:border-blue-900 dark:from-blue-950/40",
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ],
    emerald: [
      "border-emerald-200 from-emerald-50 dark:border-emerald-900 dark:from-emerald-950/40",
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    ],
    violet: [
      "border-violet-200 from-violet-50 dark:border-violet-900 dark:from-violet-950/40",
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    ],
    amber: [
      "border-amber-200 from-amber-50 dark:border-amber-900 dark:from-amber-950/40",
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ],
  };
  const [card, badge] = colors[tone];
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl border bg-gradient-to-br to-white px-4 py-3 shadow-sm dark:to-slate-900 ${card}`}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${badge}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-300">{title}</p>
        <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Current vendor records
        </p>
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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
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
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-normal transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
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
function Input({
  icon,
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
  required = false,
}) {
  return (
    <Field icon={icon} label={label} error={error} required={required}>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        className={`input ${error ? "input-error" : ""}`}
      />
    </Field>
  );
}
function Field({ label, icon, children, error, required = false }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
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
    <div className={full ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}
function IconButton({ icon, label, className, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`shrink-0 rounded-lg p-2 transition ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "active")
    .trim()
    .toLowerCase();

  const styles = {
    active:
      "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    inactive:
      "border-red-100 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-sm font-semibold ${
        styles[value] || "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {value === "active"
        ? "Active"
        : value === "inactive"
          ? "Inactive"
          : value}
    </span>
  );
}

export default Vendors;
