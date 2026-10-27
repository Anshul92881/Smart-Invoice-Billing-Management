import { useCallback, useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  ImagePlus,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
  PartyPopper,
} from "lucide-react";

import api from "../services/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace((/\/api\/?$/, ""))
  : "http://localhost:5000";

const EMPTY_FORM = {
  occasion_name: "",
  email_subject: "",
  email_message: "",
  banner_path: null,
  send_at: "",
  repeat_type: "one_time",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "processing", label: "Processing" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_STYLES = {
  draft:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",

  scheduled:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",

  processing:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",

  sent: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",

  partially_sent:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",

  failed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",

  cancelled:
    "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

// Dashboard jaisa common text/input styles

const LABEL_CLASS =
  "mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-950/50";

const VIEW_LABEL_CLASS =
  "text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const createBulkRow = () => ({
  localId: `${Date.now()}-${Math.random()}`,
  occasion_name: "",
  email_subject: "",
  email_message: "",
  date: "",
  time: "09:00",
  banner_path: null,
});

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const toDateTimeInput = (value) => {
  if (!value) return "";
  return String(value).replace(" ", "T").slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return "Not scheduled";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAssetUrl = (value) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return `${BASE_URL}${value}`;
};

function StatusBadge({ status }) {
  const label = String(status || "draft")
    .replaceAll("\_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        STATUS_STYLES[status] || STATUS_STYLES.draft
      }`}
    >
      {label}
    </span>
  );
}

function Modal({ open, title, description, wide = false, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${
          wide ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {title}
            </h2>

            {description ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const confirmWithToast = ({
  title,
  message,
  confirmLabel,
  confirmColor = "red",
}) => {
  return new Promise((resolve) => {
    toast.custom(
      (toastItem) => {
        const closeToast = (confirmed) => {
          toast.dismiss(toastItem.id);
          resolve(confirmed);
        };

        const confirmButtonClass =
          confirmColor === "amber"
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-red-600 hover:bg-red-700";

        return (
          <div
            className={`w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl transition-all dark:border-slate-700 dark:bg-slate-900 ${
              toastItem.visible
                ? "translate-y-0 opacity-100"
                : "-translate-y-2 opacity-0"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {title}
            </p>

            <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
              {message}
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeToast(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Keep it
              </button>

              <button
                type="button"
                onClick={() => closeToast(true)}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white transition ${confirmButtonClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        );
      },
      {
        duration: Infinity,
        position: "top-center",
      },
    );
  });
};

function SummaryCard({ title, value, icon, color }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function Greetings() {
  const user = useMemo(() => getStoredUser(), []);
  const role = user?.role;
  const isSuperAdmin = role === "superadmin";
  const hasAccess = ["superadmin", "company_admin"].includes(role);
  const [greetings, setGreetings] = useState([]);
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });

  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [viewGreeting, setViewGreeting] = useState(null);
  const [editingGreeting, setEditingGreeting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bulkRows, setBulkRows] = useState([createBulkRow()]);
  const recipientLabel = isSuperAdmin
    ? "all active and inactive Company Admins"
    : "all active and inactive Customers of your company";

  const fetchRecipientCount = useCallback(async () => {
    try {
      const response = await api.get("/greetings/recipient-count");

      setRecipientCount(Number(response.data?.total || 0));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchGreetings = useCallback(
    async (showRefreshLoader = false) => {
      try {
        if (showRefreshLoader) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await api.get("/greetings", {
          params: {
            page,
            limit: 10,
            search: search.trim(),
            status: statusFilter,
          },
        });

        setGreetings(response.data?.greetings || []);
        setPagination({
          total: Number(response.data?.total || 0),
          totalPages: Math.max(Number(response.data?.totalPages || 1), 1),
        });
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Unable to load greetings",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },

    [page, search, statusFilter],
  );

  useEffect(() => {
    if (!hasAccess) return;

    const timer = setTimeout(() => {
      fetchGreetings();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchGreetings, hasAccess]);

  useEffect(() => {
    if (hasAccess) {
      fetchRecipientCount();
    }
  }, [fetchRecipientCount, hasAccess]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const currentPageStats = useMemo(() => {
    return greetings.reduce(
      (result, greeting) => {
        if (greeting.status === "scheduled") result.scheduled += 1;

        if (["sent", "partially_sent"].includes(greeting.status)) {
          result.sent += 1;
        }

        if (greeting.status === "failed") result.failed += 1;

        return result;
      },

      { scheduled: 0, sent: 0, failed: 0 },
    );
  }, [greetings]);

  const summaryCards = [
    {
      title: "Total Greetings",
      value: pagination.total,
      icon: <Mail size={20} />,

      color:
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    },

    {
      title: "Current Recipients",
      value: recipientCount,
      icon: <Users size={20} />,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },

    {
      title: "Scheduled on this page",
      value: currentPageStats.scheduled,
      icon: <Clock3 size={20} />,

      color:
        "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    },

    {
      title: "Sent on this page",
      value: currentPageStats.sent,
      icon: <CheckCircle2 size={20} />,
      color:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
  ];

  const openCreateModal = () => {
    setEditingGreeting(null);
    setForm(EMPTY_FORM);
    setSingleModalOpen(true);
  };

  const openEditModal = (greeting) => {
    setEditingGreeting(greeting);
    setForm({
      occasion_name: greeting.occasion_name || "",
      email_subject: greeting.email_subject || "",
      email_message: greeting.email_message || "",
      banner_path: greeting.banner_path || null,
      send_at: toDateTimeInput(greeting.send_at),
      repeat_type: greeting.repeat_type || "one_time",
    });

    setSingleModalOpen(true);
  };

  const closeSingleModal = () => {
    if (saving || uploadingBanner === "single") return;
    setSingleModalOpen(false);
    setEditingGreeting(null);
    setForm(EMPTY_FORM);
  };

  const uploadBanner = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("banner", file);
    const response = await api.post("/greetings/banner", formData);
    return response.data?.banner_path || null;
  };

  const handleSingleBannerUpload = async (file) => {
    if (!file) return;

    try {
      setUploadingBanner("single");
      const bannerPath = await uploadBanner(file);
      if (!bannerPath) {
        throw new Error("Banner path missing");
      }

      setForm((current) => ({
        ...current,
        banner_path: bannerPath,
      }));

      toast.success("Banner uploaded successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Banner upload failed");
    } finally {
      setUploadingBanner(null);
    }
  };

  const saveSingleGreeting = async (status) => {
    if (saving) return;

    if (!form.occasion_name.trim()) {
      toast.error("Occasion name is required");
      return;
    }

    if (!form.email_subject.trim()) {
      toast.error("Email subject is required");
      return;
    }

    if (!form.email_message.trim()) {
      toast.error("Email message is required");
      return;
    }

    if (status === "scheduled" && !form.send_at) {
      toast.error("Sending date and time are required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        occasion_name: form.occasion_name.trim(),
        email_subject: form.email_subject.trim(),
        email_message: form.email_message.trim(),
        banner_path: form.banner_path,
        send_at: form.send_at || null,
        repeat_type: form.repeat_type,
        status,
      };

      if (editingGreeting) {
        await api.put(`/greetings/${editingGreeting.id}`, payload);
        toast.success("Greeting updated successfully");
      } else {
        await api.post("/greetings", payload);

        toast.success(
          status === "scheduled"
            ? "Greeting scheduled successfully"
            : "Greeting saved as draft",
        );
      }

      setSingleModalOpen(false);
      setEditingGreeting(null);
      setForm(EMPTY_FORM);
      await fetchGreetings(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save greeting");
    } finally {
      setSaving(false);
    }
  };

  const updateBulkRow = (localId, field, value) => {
    setBulkRows((rows) =>
      rows.map((row) =>
        row.localId === localId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addBulkRow = () => {
    setBulkRows((rows) => [...rows, createBulkRow()]);
  };

  const removeBulkRow = (localId) => {
    setBulkRows((rows) => {
      if (rows.length === 1) return rows;

      return rows.filter((row) => row.localId !== localId);
    });
  };

  const handleBulkBannerUpload = async (localId, file) => {
    if (!file) return;

    try {
      setUploadingBanner(localId);

      const bannerPath = await uploadBanner(file);

      if (!bannerPath) {
        throw new Error("Banner path missing");
      }

      updateBulkRow(localId, "banner_path", bannerPath);

      toast.success("Banner uploaded successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Banner upload failed");
    } finally {
      setUploadingBanner(null);
    }
  };

  const saveBulkGreetings = async (status) => {
    if (saving) return;

    const invalidIndex = bulkRows.findIndex(
      (row) =>
        !row.occasion_name.trim() ||
        !row.email_subject.trim() ||
        !row.email_message.trim() ||
        (status === "scheduled" && (!row.date || !row.time)),
    );

    if (invalidIndex !== -1) {
      toast.error(`Complete all required fields.`);

      return;
    }

    try {
      setSaving(true);

      const payload = {
        status,

        greetings: bulkRows.map((row) => ({
          occasion_name: row.occasion_name.trim(),
          email_subject: row.email_subject.trim(),
          email_message: row.email_message.trim(),
          banner_path: row.banner_path,
          send_at: row.date && row.time ? `${row.date}T${row.time}` : null,
          repeat_type: "yearly",
          status,
        })),
      };

      const response = await api.post("/greetings/bulk", payload);

      toast.success(
        response.data?.message ||
          `${bulkRows.length} yearly greetings created successfully`,
      );

      setBulkModalOpen(false);

      setBulkRows([createBulkRow()]);

      await fetchGreetings(true);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create yearly calendar",
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelGreeting = async (greeting) => {
    const confirmed = await confirmWithToast({
      title: "Cancel greeting?",
      message: `Are you sure you want to cancel ${greeting.occasion_name}?`,
      confirmLabel: "Cancel Greeting",
      confirmColor: "amber",
    });

    if (!confirmed) return;

    try {
      await api.patch(`/greetings/${greeting.id}/cancel`);

      toast.success("Greeting cancelled successfully");

      await fetchGreetings(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to cancel greeting");
    }
  };

  const deleteGreeting = async (greeting) => {
    const confirmed = await confirmWithToast({
      title: "Delete greeting permanently?",
      message: `${greeting.occasion_name} will be permanently deleted. This action cannot be undone.`,
      confirmLabel: "Delete Greeting",
      confirmColor: "red",
    });

    if (!confirmed) return;

    try {
      await api.delete(`/greetings/${greeting.id}`);

      toast.success("Greeting deleted successfully");

      if (greetings.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchGreetings(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete greeting");
    }
  };

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        You do not have access to the Greetings module.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* HEADER */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <PartyPopper size={17} />
              Greetings
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Greetings & Occasions
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              System will automatically deliver greetings on the scheduled date
              and time.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                setBulkRows([createBulkRow()]);

                setBulkModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <CalendarDays size={17} /> Yearly Calendar
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={17} /> Create Greeting
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} {...card} />
        ))}
      </div>

      {/* TABLE */}

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search occasion or subject"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-950/50"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => fetchGreetings(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="p-4 text-left text-xs font-bold uppercase tracking-wide">
                  Occasion
                </th>

                <th className="p-4 text-left text-xs font-bold uppercase tracking-wide">
                  Schedule
                </th>

                <th className="p-4 text-left text-xs font-bold uppercase tracking-wide">
                  Repeat
                </th>

                <th className="p-4 text-left text-xs font-bold uppercase tracking-wide">
                  Delivery
                </th>

                <th className="p-4 text-left text-xs font-bold uppercase tracking-wide">
                  Status
                </th>

                <th className="p-4 text-right text-xs font-bold uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <LoaderCircle
                      className="mx-auto animate-spin text-blue-600"
                      size={24}
                    />

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Loading greetings...
                    </p>
                  </td>
                </tr>
              ) : greetings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Mail
                      className="mx-auto text-slate-300 dark:text-slate-600"
                      size={30}
                    />

                    <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      No greetings found
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Create your first greeting or yearly occasion calendar.
                    </p>
                  </td>
                </tr>
              ) : (
                greetings.map((greeting) => {
                  const canEdit = [
                    "draft",
                    "scheduled",
                    "failed",
                    "cancelled",
                    "sent",
                    "partially_sent",
                  ].includes(greeting.status);

                  const canCancel = ["draft", "scheduled"].includes(
                    greeting.status,
                  );

                  const canDelete = ["draft", "failed", "cancelled"].includes(
                    greeting.status,
                  );

                  return (
                    <tr
                      key={greeting.id}
                      className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {greeting.banner_path ? (
                            <img
                              src={getAssetUrl(greeting.banner_path)}
                              alt={greeting.occasion_name}
                              className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                              <Mail size={19} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="max-w-56 truncate font-semibold text-slate-900 dark:text-white">
                              {greeting.occasion_name}
                            </p>

                            <p className="mt-1 max-w-64 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                              {greeting.email_subject}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={16} />

                          {formatDateTime(greeting.send_at)}
                        </div>
                      </td>

                      <td className="p-4 capitalize text-slate-600 dark:text-slate-300">
                        {String(greeting.repeat_type || "one_time").replace(
                          "\_",

                          " ",
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {greeting.sent_count || 0} sent
                          </span>

                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {greeting.failed_count || 0} failed
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <StatusBadge status={greeting.status} />
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewGreeting(greeting)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800"
                            title="View"
                            aria-label="View"
                          >
                            <Eye size={17} />
                          </button>

                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => openEditModal(greeting)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-blue-950/40"
                              title="Edit"
                              aria-label="Edit"
                            >
                              <Edit3 size={17} />
                            </button>
                          ) : null}

                          {canCancel ? (
                            <button
                              type="button"
                              onClick={() => cancelGreeting(greeting)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 dark:text-slate-400 dark:hover:bg-amber-950/40"
                              title="Cancel"
                              aria-label="Cancel"
                            >
                              <XCircle size={17} />
                            </button>
                          ) : null}

                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => deleteGreeting(greeting)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <Trash2 size={17} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Page {page} of {pagination.totalPages} · {pagination.total} total
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}

      <Modal
        open={singleModalOpen}
        title={editingGreeting ? "Edit Greeting" : "Create Greeting"}
        description={`This greeting will be sent to ${recipientLabel}.`}
        onClose={closeSingleModal}
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>
              Occasion name <span className="text-red-500">*</span>
            </label>

            <input
              value={form.occasion_name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,

                  occasion_name: event.target.value,
                }))
              }
              placeholder="Example: Diwali"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>
              Email subject <span className="text-red-500">*</span>
            </label>

            <input
              value={form.email_subject}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,

                  email_subject: event.target.value,
                }))
              }
              placeholder="Example: Wishing you a Happy Diwali"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Greeting message <span className="text-red-500">*</span>
              </label>
            </div>

            <textarea
              rows={6}
              value={form.email_message}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,

                  email_message: event.target.value,
                }))
              }
              placeholder="Write your greeting message..."
              className={`${INPUT_CLASS} resize-y leading-6`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Sending date and time</label>

              <input
                type="datetime-local"
                value={form.send_at}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,

                    send_at: event.target.value,
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Repeat</label>

              <select
                value={form.repeat_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,

                    repeat_type: event.target.value,
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="one_time">One time</option>

                <option value="yearly">Every year</option>
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Greeting banner (optional)</label>

            {form.banner_path ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <img
                  src={getAssetUrl(form.banner_path)}
                  alt="Greeting banner"
                  className="h-44 w-full object-cover"
                />

                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,

                      banner_path: null,
                    }))
                  }
                  className="absolute right-2 top-2 rounded-lg bg-slate-950/70 p-2 text-white"
                  aria-label="Remove banner"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:bg-blue-950/20">
                {uploadingBanner === "single" ? (
                  <LoaderCircle
                    className="animate-spin text-blue-600"
                    size={25}
                  />
                ) : (
                  <ImagePlus className="text-slate-400" size={27} />
                )}

                <span className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Upload banner
                </span>

                <span className="mt-1 text-xs font-medium text-slate-400">
                  JPG, PNG or WEBP up to 3 MB
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingBanner === "single"}
                  onChange={(event) =>
                    handleSingleBannerUpload(event.target.files?.[0])
                  }
                />
              </label>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeSingleModal}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => saveSingleGreeting("draft")}
              disabled={saving || uploadingBanner === "single"}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={() => saveSingleGreeting("scheduled")}
              disabled={saving || uploadingBanner === "single"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Send size={17} />
              )}
              Schedule Greeting
            </button>
          </div>
        </div>
      </Modal>

      {/* BULK MODAL */}

      <Modal
        open={bulkModalOpen}
        title="Create Yearly Occasion Calendar"
        description={`Create multiple yearly greetings for ${recipientLabel} in one go.`}
        wide
        onClose={() => {
          if (!saving && !uploadingBanner) {
            setBulkModalOpen(false);
          }
        }}
      >
        <div className="space-y-4">
          {bulkRows.map((row, index) => (
            <div
              key={row.localId}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Occasion {index + 1}
                </h3>

                <button
                  type="button"
                  onClick={() => removeBulkRow(row.localId)}
                  disabled={bulkRows.length === 1}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30"
                  title="Remove occasion"
                  aria-label="Remove occasion"
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <label className={LABEL_CLASS}>Occasion name</label>

                  <input
                    value={row.occasion_name}
                    onChange={(event) =>
                      updateBulkRow(
                        row.localId,

                        "occasion_name",

                        event.target.value,
                      )
                    }
                    placeholder="Diwali"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-5">
                  <label className={LABEL_CLASS}>Email subject</label>

                  <input
                    value={row.email_subject}
                    onChange={(event) =>
                      updateBulkRow(
                        row.localId,

                        "email_subject",

                        event.target.value,
                      )
                    }
                    placeholder="Wishing you a Happy Diwali"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className={LABEL_CLASS}>Date</label>

                  <input
                    type="date"
                    value={row.date}
                    onChange={(event) =>
                      updateBulkRow(row.localId, "date", event.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className={LABEL_CLASS}>Time</label>

                  <input
                    type="time"
                    value={row.time}
                    onChange={(event) =>
                      updateBulkRow(row.localId, "time", event.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-10">
                  <label className={LABEL_CLASS}>Greeting message</label>

                  <textarea
                    rows={3}
                    value={row.email_message}
                    onChange={(event) =>
                      updateBulkRow(
                        row.localId,

                        "email_message",

                        event.target.value,
                      )
                    }
                    placeholder="Write the greeting message..."
                    className={`${INPUT_CLASS} resize-y`}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className={LABEL_CLASS}>Banner</label>

                  {row.banner_path ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={getAssetUrl(row.banner_path)}
                        alt="Banner"
                        className="h-11 w-14 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          updateBulkRow(row.localId, "banner_path", null)
                        }
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        aria-label="Remove banner"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {uploadingBanner === row.localId ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      Upload
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) =>
                          handleBulkBannerUpload(
                            row.localId,

                            event.target.files?.[0],
                          )
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addBulkRow}
            disabled={bulkRows.length >= 100}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
          >
            <Plus size={17} /> Add Occasion
          </button>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setBulkModalOpen(false)}
              disabled={saving || Boolean(uploadingBanner)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => saveBulkGreetings("draft")}
              disabled={saving || Boolean(uploadingBanner)}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
            >
              Save All as Draft
            </button>

            <button
              type="button"
              onClick={() => saveBulkGreetings("scheduled")}
              disabled={saving || Boolean(uploadingBanner)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <CalendarDays size={17} />
              )}
              Schedule All
            </button>
          </div>
        </div>
      </Modal>

      {/* VIEW MODAL */}

      <Modal
        open={Boolean(viewGreeting)}
        title={viewGreeting?.occasion_name || "Greeting Details"}
        description="Greeting schedule and delivery information"
        onClose={() => setViewGreeting(null)}
      >
        {viewGreeting ? (
          <div className="space-y-4">
            {viewGreeting.banner_path ? (
              <img
                src={getAssetUrl(viewGreeting.banner_path)}
                alt={viewGreeting.occasion_name}
                className="max-h-64 w-full rounded-xl border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : null}

            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
              <div>
                <p className={VIEW_LABEL_CLASS}>Status</p>

                <div className="mt-2">
                  <StatusBadge status={viewGreeting.status} />
                </div>
              </div>

              <div>
                <p className={VIEW_LABEL_CLASS}>Schedule</p>

                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {formatDateTime(viewGreeting.send_at)}
                </p>
              </div>

              <div>
                <p className={VIEW_LABEL_CLASS}>Repeat</p>

                <p className="mt-2 text-sm font-semibold capitalize text-slate-900 dark:text-white">
                  {String(viewGreeting.repeat_type).replace("\_", " ")}
                </p>
              </div>

              <div>
                <p className={VIEW_LABEL_CLASS}>Delivery</p>

                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {viewGreeting.sent_count || 0} sent ·{" "}
                  {viewGreeting.failed_count || 0} failed
                </p>
              </div>
            </div>

            <div>
              <p className={VIEW_LABEL_CLASS}>Email subject</p>

              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {viewGreeting.email_subject}
              </p>
            </div>

            <div>
              <p className={VIEW_LABEL_CLASS}>Message</p>

              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {viewGreeting.email_message}
              </p>
            </div>

            {viewGreeting.last_error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">
                <strong className="font-bold">Last error:</strong>{" "}
                {viewGreeting.last_error}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default Greetings;
