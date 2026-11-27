import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Pencil,
  X,
  UserPlus,
  Mail,
  Lock,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  GitBranch,
  Save,
  Hash,
  Phone,
  BadgePercent,
  MapPin,
  Globe,
  Search,
  Filter,
  Eye,
  Plus,
  ChevronDown,
  EyeOff,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowUpDown,
} from "lucide-react";
function SalesUsers() {
  const initialForm = {
    name: "",
    email: "",
    password: "",
    branch_id: "",
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
  const [salesUsers, setSalesUsers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const requestRef = useRef(0),
    saveLock = useRef(false),
    branchLock = useRef(false);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [editId, setEditId] = useState(null);
  const [viewSalesUser, setViewSalesUser] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");
  const stats = {
    total: salesUsers.length,
    active: salesUsers.filter((u) => (u.status || "active") === "active")
      .length,
    inactive: salesUsers.filter((u) => (u.status || "active") !== "active")
      .length,
  };
  const isActiveBranch = (branch) =>
    branch.status === "active" || branch.status === 1 || branch.status === true;
  const formatBranchLabel = (item) => {
    if (!item?.branch_name) return "-";
    return item.branch_code
      ? `${item.branch_name} (${item.branch_code})`
      : item.branch_name;
  };
  const getDefaultBranchId = () => {
    const hqBranch = branches.find(
      (branch) => branch.is_main === 1 || branch.is_main === true,
    );
    return hqBranch?.id ? String(hqBranch.id) : "";
  };
  const fetchData = async () => {
    const requestId = ++requestRef.current;
    setListLoading(true);
    setListError("");
    try {
      const [salesResult, branchResult] = await Promise.allSettled([
        api.get("/users/sales-users"),
        api.get("/branches"),
      ]);
      if (requestId !== requestRef.current) return;
      if (salesResult.status === "fulfilled") {
        const salesData = Array.isArray(salesResult.value.data)
          ? salesResult.value.data
          : salesResult.value.data?.salesUsers || [];
        setSalesUsers(Array.isArray(salesData) ? salesData : []);
      } else {
        const salesError = salesResult.reason;
        setListError(
          salesError.response?.data?.message || "Failed to fetch sales users",
        );
        console.error(
          "Sales users API failed:",
          salesError.response?.status,
          salesError.response?.data,
        );
        toast.error(
          salesError.response?.data?.message || "Failed to fetch sales users",
        );
      }
      if (branchResult.status === "fulfilled") {
        const branchData = Array.isArray(branchResult.value.data)
          ? branchResult.value.data
          : branchResult.value.data?.branches || [];
        setBranches(
          (Array.isArray(branchData) ? branchData : []).filter(isActiveBranch),
        );
      } else {
        const branchError = branchResult.reason;
        console.error(
          "Branches API failed:",
          branchError.response?.status,
          branchError.response?.data,
        );
        toast.error(
          branchError.response?.data?.message || "Failed to fetch branches",
        );
      }
    } catch (error) {
      console.error("Sales users page fetch error:", error);
      if (requestId === requestRef.current)
        setListError(
          error.response?.data?.message || "Failed to load sales users page",
        );
      toast.error(
        error.response?.data?.message || "Failed to load sales users page",
      );
    } finally {
      if (requestId === requestRef.current) setListLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  const filteredSalesUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return salesUsers.filter((item) => {
      const status = item.status || "active";
      const matchesSearch =
        !keyword ||
        (item.name || "").toLowerCase().includes(keyword) ||
        (item.email || "").toLowerCase().includes(keyword) ||
        (item.branch_name || "").toLowerCase().includes(keyword) ||
        (item.branch_code || "").toLowerCase().includes(keyword) ||
        (item.role || "").toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesBranch =
        branchFilter === "all" ||
        String(item.branch_id || "") === String(branchFilter);
      const matchesCard =
        cardFilter === "all" ||
        (cardFilter === "active" && status === "active") ||
        (cardFilter === "inactive" && status !== "active") ||
        (cardFilter === "assigned" && Boolean(item.branch_id));
      return matchesSearch && matchesStatus && matchesBranch && matchesCard;
    });
  }, [salesUsers, search, statusFilter, branchFilter, cardFilter]);
  const pages = Math.max(1, Math.ceil(filteredSalesUsers.length / pageSize));
  const sortedSalesUsers = useMemo(
    () =>
      [...filteredSalesUsers].sort((a, b) => {
        const comparison = String(a[sortBy] || "").localeCompare(
          String(b[sortBy] || ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );
        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [filteredSalesUsers, sortBy, sortDirection],
  );
  const visibleSalesUsers = sortedSalesUsers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const changeSort = (key) => {
    setSortDirection(
      sortBy === key && sortDirection === "asc" ? "desc" : "asc",
    );
    setSortBy(key);
    setPage(1);
  };
  useEffect(
    () => setPage(1),
    [search, statusFilter, branchFilter, cardFilter, pageSize],
  );
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);
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
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
      setShowBranchModal(true);
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleBranchChange = (e) => {
    setBranchForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const resetForm = () => {
    setFormData({
      ...initialForm,
      branch_id: getDefaultBranchId(),
    });
    setEditId(null);
  };
  const resetBranchForm = () => {
    setBranchForm(initialBranchForm);
  };
  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };
  const openEditModal = (salesUser) => {
    setEditId(salesUser.id);
    setFormData({
      name: salesUser.name || "",
      email: salesUser.email || "",
      password: "",
      branch_id: salesUser.branch_id ? String(salesUser.branch_id) : "",
    });
    setShowFormModal(true);
  };
  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };
  const handleCreateBranch = async () => {
    if (branchLock.current) return;
    if (!branchForm.branch_name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    try {
      branchLock.current = true;
      setBranchLoading(true);
      const payload = {
        ...branchForm,
        branch_name: branchForm.branch_name.trim(),
      };
      const res = await api.post("/branches", payload);
      const newBranch = res.data?.branch || res.data;
      const branchRes = await api.get("/branches");
      const branchList = Array.isArray(branchRes.data)
        ? branchRes.data
        : branchRes.data?.branches || [];
      const updatedBranches = branchList.filter(isActiveBranch);
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
      branchLock.current = false;
      setBranchLoading(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saveLock.current) return;
    if (!formData.branch_id) {
      toast.error("Please select branch");
      return;
    }
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!editId && !formData.password) {
      toast.error("Password is required");
      return;
    }
    try {
      saveLock.current = true;
      setLoading(true);
      if (editId) {
        await api.put(`/users/team/${editId}`, formData);
        toast.success("Sales user updated successfully");
      } else {
        await api.post("/users/sales-user", formData);
        toast.success("Sales user created successfully");
      }
      closeFormModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save sales user");
    } finally {
      saveLock.current = false;
      setLoading(false);
    }
  };
  const handleToggleStatus = (salesUser) => {
    const currentStatus = String(salesUser.status || "active").toLowerCase();
    const nextStatus = currentStatus === "inactive" ? "active" : "inactive";
    confirmToast(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} this sales user?`,
      async () => {
        try {
          await api.patch(`/users/team/${salesUser.id}/status`, {
            status: nextStatus,
          });
          toast.success(`Sales user ${nextStatus} successfully`);
          fetchData();
        } catch (error) {
          toast.error(error.response?.data?.message || "Status update failed");
        }
      },
    );
  };
  return (
    <div className="salesUsers-workspace w-full min-w-0 space-y-5">
      <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm text-slate-500">Team / Sales Users</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Sales Users
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage your sales team and branch assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={17} />
          New Sales User
        </button>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Sales Users"
          value={stats.total}
          icon={<Users size={20} />}
          color="bg-blue-50 text-blue-600"
          onClick={() => {
            setCardFilter("all");
            setStatusFilter("all");
            setBranchFilter("all");
          }}
        />
        <SummaryCard
          title="Active Members"
          value={stats.active}
          icon={<CheckCircle2 size={20} />}
          color="bg-emerald-50 text-emerald-600"
          onClick={() => {
            setCardFilter("active");
            setStatusFilter("all");
            setBranchFilter("all");
          }}
        />
        <SummaryCard
          title="Inactive Members"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-amber-50 text-amber-600"
          onClick={() => {
            setCardFilter("inactive");
            setStatusFilter("all");
            setBranchFilter("all");
          }}
        />
        <SummaryCard
          title="Active Branches"
          value={branches.length}
          icon={<GitBranch size={20} />}
          color="bg-violet-50 text-violet-600"
        />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pt-4 dark:border-slate-800">
          <div
            className="flex gap-5 overflow-x-auto"
            role="tablist"
            aria-label="Sales User status"
          >
            {[
              ["all", "All Sales Users"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={statusFilter === value}
                onClick={() => {
                  setCardFilter("all");
                  setStatusFilter(value);
                }}
                className={`whitespace-nowrap border-b-2 pb-4 text-sm font-medium ${statusFilter === value ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={listLoading}
            aria-label="Refresh sales users"
            className="mb-3 rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 dark:hover:bg-slate-800"
          >
            <RefreshCw
              size={16}
              className={listLoading ? "animate-spin" : ""}
            />
          </button>
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="search"
              aria-label="Search sales users"
              placeholder="Search by name, email or branch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input !pl-10"
            />
          </div>
          <div className="sm:w-60">
            <CustomDropdown
              value={branchFilter}
              onChange={setBranchFilter}
              icon={<GitBranch size={15} />}
              options={[
                { value: "all", label: "All Branches" },
                ...branches.map((branch) => ({
                  value: String(branch.id),
                  label: formatBranchLabel(branch),
                })),
              ]}
            />
          </div>
        </div>
        {listError ? (
          <div role="alert" className="p-10 text-center">
            <p className="text-sm text-red-500">{listError}</p>
            <button
              type="button"
              onClick={fetchData}
              className="mt-3 text-sm text-blue-600"
            >
              Try again
            </button>
          </div>
        ) : listLoading ? (
          <div
            role="status"
            aria-label="Loading sales users"
            className="space-y-4 p-6"
          >
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : (
          <SalesUserTable
            salesUsers={visibleSalesUsers}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={changeSort}
            onView={setViewSalesUser}
            onEdit={openEditModal}
            onToggleStatus={handleToggleStatus}
            formatBranchLabel={formatBranchLabel}
          />
        )}
        <footer className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center">
          <span>
            Showing {filteredSalesUsers.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filteredSalesUsers.length)} of{" "}
            {filteredSalesUsers.length} sales users
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Rows
              <CustomDropdown
                value={String(pageSize)}
                onChange={(value) => setPageSize(Number(value))}
                options={[10, 20, 50].map((count) => ({
                  value: String(count),
                  label: String(count),
                }))}
                label="Rows per page"
                searchable={false}
              />
            </label>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-700"
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-700"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </section>
      {showFormModal && (
        <FormModal
          title={editId ? "Update Sales User" : "Create Sales User"}
          description={
            editId
              ? "Update salesUser details. Fill password only if you want to reset it."
              : "Select existing branch or create a new branch from same page."
          }
          icon={<ShieldCheck size={22} />}
          onClose={closeFormModal}
        >
          <SalesUserForm
            formData={formData}
            branches={branches}
            editId={editId}
            formatBranchLabel={formatBranchLabel}
            loading={loading}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}
      {viewSalesUser && (
        <SalesUserViewModal
          salesUser={viewSalesUser}
          formatBranchLabel={formatBranchLabel}
          onClose={() => setViewSalesUser(null)}
        />
      )}
      {showBranchModal && (
        <FormModal
          title="Add New Branch"
          description="Create a branch without leaving the sales user page."
          icon={<GitBranch size={22} />}
          onClose={() => setShowBranchModal(false)}
        >
          <BranchMiniForm
            branchForm={branchForm}
            handleBranchChange={handleBranchChange}
            handleCreateBranch={handleCreateBranch}
            branchLoading={branchLoading}
            onCancel={() => setShowBranchModal(false)}
          />
        </FormModal>
      )}
      <style>{`
        .salesUsers-workspace .input {
          width: 100%;
          border: 1px solid #e2e8f0;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          background: #ffffff;
          color: #334155;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }
        .salesUsers-workspace .input::placeholder {
          color: #94a3b8;
        }
        .salesUsers-workspace .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
        .dark .salesUsers-workspace .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }
        .dark .salesUsers-workspace .input::placeholder {
          color: #64748b;
        }
        .dark .salesUsers-workspace .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }
      `}</style>
    </div>
  );
}
function SalesUserTable({
  sortBy,
  sortDirection,
  onSort,
  salesUsers,
  onView,
  onEdit,
  onToggleStatus,
  formatBranchLabel,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-[15px]">
        <thead className="bg-blue-50 text-sm tracking-wide text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {[
              ["Team Member", "name"],
              ["Branch", "branch_name"],
              ["Role", "role"],
              ["Status", "status"],
              ["Actions", null],
            ].map(([label, key]) => (
              <th
                key={label}
                scope="col"
                aria-sort={
                  key === sortBy
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className="px-5 py-4 text-left text-sm font-semibold"
              >
                {key && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className="inline-flex items-center gap-2"
                  >
                    {label}
                    <ArrowUpDown
                      size={14}
                      className={
                        sortBy === key ? "text-blue-600" : "text-blue-300"
                      }
                    />
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {salesUsers.map((item) => (
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
                    {String(item.name || "A")
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[200px] truncate text-base font-semibold text-slate-800 hover:text-blue-600 dark:text-slate-100">
                      {item.name || "—"}
                    </span>
                    <span
                      className="mt-1 block max-w-[210px] truncate text-sm text-slate-500"
                      title={item.email}
                    >
                      {item.email || "—"}
                    </span>
                  </span>
                </button>
              </td>
              <td className="px-5 py-4">
                <span
                  className="block max-w-[170px] truncate text-sm text-slate-600 dark:text-slate-300"
                  title={formatBranchLabel(item)}
                >
                  {formatBranchLabel(item)}
                </span>
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-sm font-medium capitalize text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  <ShieldCheck size={13} />
                  {(item.role || "sales_user").replaceAll("_", " ")}
                </span>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="View profile"
                    aria-label={`View ${item.name}`}
                    onClick={() => onView(item)}
                    className="rounded-lg bg-blue-50 p-2.5 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    title="Edit sales user"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => onEdit(item)}
                    className="rounded-lg bg-amber-50 p-2.5 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStatus(item)}
                    className={`ml-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-sm font-medium ${item.status === "inactive" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"}`}
                  >
                    {item.status === "inactive" ? "Activate" : "Deactivate"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!salesUsers.length && (
            <tr>
              <td colSpan={5} className="p-12 text-center">
                <Users size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No sales users found
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Add a team member or adjust your filters.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SalesUserForm({
  formData,
  branches,
  editId,
  formatBranchLabel,
  loading,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Sales team access
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Assign a branch and enter the sales user’s login details.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field icon={<Building2 size={16} />} label="Branch">
          <BranchSelect
            branches={branches}
            value={formData.branch_id}
            formatBranchLabel={formatBranchLabel}
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
          icon={<Users size={16} />}
          label="Sales User Name"
          type="text"
          name="name"
          placeholder="Enter sales user name"
          value={formData.name}
          onChange={handleChange}
        />
        <Input
          icon={<Mail size={16} />}
          label="Sales User Email"
          type="email"
          name="email"
          placeholder="Enter sales user email"
          value={formData.email}
          onChange={handleChange}
        />
        <Field
          icon={<Lock size={16} />}
          label={editId ? "New Password Optional" : "Password"}
        >
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder={
                editId ? "Leave blank to keep old password" : "Create password"
              }
              value={formData.password || ""}
              onChange={handleChange}
              autoComplete="new-password"
              className="input !pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
              title={showPassword ? "Hide Password" : "Show Password"}
              aria-label={showPassword ? "Hide Password" : "Show Password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
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
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0 disabled:bg-blue-400"
        >
          <UserPlus size={16} />
          {loading
            ? "Saving..."
            : editId
              ? "Save Changes"
              : "Create Sales User"}
        </button>
      </div>
    </form>
  );
}
function BranchMiniForm({
  branchForm,
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
          required
        />
        <ModalInput
          icon={<Hash size={16} />}
          label="Branch Code"
          name="branch_code"
          value={branchForm.branch_code}
          onChange={handleBranchChange}
        />
        <ModalInput
          icon={<Mail size={16} />}
          label="Email"
          name="email"
          type="email"
          value={branchForm.email}
          onChange={handleBranchChange}
        />
        <ModalInput
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={branchForm.phone}
          onChange={handleBranchChange}
        />
        <ModalInput
          icon={<BadgePercent size={16} />}
          label="GST Number"
          name="gst_number"
          value={branchForm.gst_number}
          onChange={handleBranchChange}
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
        />
        <ModalInput
          icon={<Hash size={16} />}
          label="ZIP Code"
          name="zip_code"
          value={branchForm.zip_code}
          onChange={handleBranchChange}
        />
        <Field icon={<CheckCircle2 size={16} />} label="Status">
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
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
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
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={16} />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreateBranch}
          disabled={branchLoading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0 disabled:bg-blue-400"
        >
          <Save size={16} />
          {branchLoading ? "Saving..." : "Save Branch"}
        </button>
      </div>
    </>
  );
}
function SalesUserViewModal({ salesUser, formatBranchLabel, onClose }) {
  return (
    <FormModal
      title="Sales User Profile"
      description="Team member information and branch assignment."
      icon={<ShieldCheck size={22} />}
      onClose={onClose}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="h-20 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-blue-50 text-lg font-semibold text-blue-600 dark:border-slate-900">
            {String(salesUser.name || "A")
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                {salesUser.name || "—"}
              </h3>
              <p className="mt-1 break-all text-sm text-slate-500">
                {salesUser.email || "—"}
              </p>
            </div>
            <StatusBadge status={salesUser.status} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid-cols-2">
            <ViewField
              label="Role"
              value={(salesUser.role || "sales_user").replaceAll("_", " ")}
            />
            <ViewField
              label="Assigned Branch"
              value={formatBranchLabel(salesUser)}
            />
            <ViewField label="Email Address" value={salesUser.email} />
            <ViewField
              label="Account Status"
              value={<StatusBadge status={salesUser.status} />}
            />
          </div>
        </div>
      </div>
    </FormModal>
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event) => {
      if (event.key === "Escape") {
        const dialogs = document.querySelectorAll("[data-sales-user-dialog]");
        if (dialogs[dialogs.length - 1]?.getAttribute("aria-label") === title)
          onClose();
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
    };
  }, [onClose, title]);
  return createPortal(
    <div className="salesUsers-workspace">
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
        <section
          data-sales-user-dialog
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:px-7">
            <div className="flex gap-3">
              <span className="hidden h-fit rounded-xl bg-blue-50 p-2.5 text-blue-600 sm:block">
                {icon}
              </span>
              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-widest text-slate-500">
                  Sales Team
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
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
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

function SummaryCard({ title, value, icon, color, onClick }) {
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
      {...(onClick ? { type: "button", onClick } : {})}
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm ${tone} ${
        onClick ? "transition hover:border-blue-300" : ""
      }`}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${color}`}>{icon}</span>

      <span className="min-w-0">
        <span className="block text-sm text-slate-500">{title}</span>

        <span className="mt-1 block text-2xl font-semibold leading-tight text-slate-900 dark:text-white">
          {value}
        </span>

        <span className="mt-0.5 block text-sm text-slate-500">
          {onClick ? "View team members" : "Company branches"}
        </span>
      </span>
    </Tag>
  );
}

function ViewField({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="mb-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </p>
      <div className="break-words text-sm text-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
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
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <input
        aria-label={label}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="input"
      />
    </div>
  );
}
function Input({ icon, label, type, name, placeholder, value, onChange }) {
  return (
    <Field icon={icon} label={label}>
      <input
        aria-label={label}
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="input"
      />
    </Field>
  );
}
function Field({ icon, label, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        {icon}
        {label}
      </label>
      {children}
    </div>
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
        className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm transition focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-slate-900 dark:text-slate-200 ${open ? "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-950" : "border-slate-200 hover:border-blue-300 dark:border-slate-700"}`}
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
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${option.value === "__add_branch__" ? "mt-1 border-t border-blue-100 font-medium text-blue-600 dark:border-blue-900" : ""} ${String(value) === String(option.value) ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : index === active ? "bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}
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
                <p className="px-3 py-5 text-center text-sm text-slate-500">
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
function BranchSelect({ branches, value, onChange, formatBranchLabel }) {
  return (
    <CustomDropdown
      value={value}
      onChange={onChange}
      label="Select Branch"
      icon={<GitBranch size={16} />}
      options={[
        ...branches.map((branch) => ({
          value: String(branch.id),
          label:
            formatBranchLabel(branch) +
            (branch.is_main === 1 || branch.is_main === true ? " · HQ" : ""),
        })),
        { value: "__add_branch__", label: "+ Add New Branch" },
      ]}
    />
  );
}
function IconButton({ icon, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-2 ${className}`}
    >
      {icon}
    </button>
  );
}
function StatusBadge({ status }) {
  const value = String(status || "active").toLowerCase();
  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    inactive:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium capitalize shadow-sm ${
        styles[value] || styles.active
      }`}
    >
      {value}
    </span>
  );
}
export default SalesUsers;
