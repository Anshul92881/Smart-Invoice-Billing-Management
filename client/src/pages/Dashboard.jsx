import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import {
  IndianRupee,
  Users,
  Package,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Building2,
  X,
  Search,
  Loader2,
  ChevronDown,
  Check,
  RefreshCw,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from "recharts";
const getList = (data, key) => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
};
const safeArray = (value) => (Array.isArray(value) ? value : []);
function Dashboard() {
  const [report, setReport] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const dashboardRequest = useRef(0);
  const [modalType, setModalType] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [chartFilter, setChartFilter] = useState({ from: "", to: "" });
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();
  const isSalesUser = user?.role === "sales_user";
  const isAdmin = user?.role === "company_admin";
  const isActiveBranch = (branch) =>
    branch.status === "active" || branch.status === 1 || branch.status === true;
  const formatBranchLabel = (item) => {
    if (!item?.branch_name) return "-";
    return item.branch_code
      ? `${item.branch_name} (${item.branch_code})`
      : item.branch_name;
  };
  const getBranchLabel = () => {
    if (selectedBranch === "all") return "All Branches";
    const branch = safeArray(branches).find(
      (item) => String(item.id) === String(selectedBranch),
    );
    return formatBranchLabel(branch) || "Selected Branch";
  };
  const filterRecordsByBranch = useCallback(
    (records = []) => {
      const list = safeArray(records);
      if (selectedBranch === "all") return list;
      return list.filter(
        (item) => String(item.branch_id || "") === String(selectedBranch),
      );
    },
    [selectedBranch],
  );
  const fetchBranches = useCallback(async () => {
    try {
      let res;
      try {
        res = await api.get("/branches/dropdown");
      } catch {
        res = await api.get("/branches");
      }
      setBranches(getList(res.data, "branches").filter(isActiveBranch));
    } catch {
      setBranches([]);
    }
  }, []);
  const fetchDashboardData = useCallback(async () => {
    const requestId = ++dashboardRequest.current;
    setRefreshing(true);
    setDashboardError("");
    try {
      if (isSalesUser) {
        const [customerRes, productRes, quotationRes, invoiceRes] =
          await Promise.all([
            api.get("/customers"),
            api.get("/products"),
            api.get("/quotations"),
            api.get("/invoices"),
          ]);
        if (requestId !== dashboardRequest.current) return;
        const customersData = filterRecordsByBranch(
          getList(customerRes.data, "customers"),
        );
        const productsData = filterRecordsByBranch(
          getList(productRes.data, "products"),
        );
        const quotationsData = filterRecordsByBranch(
          getList(quotationRes.data, "quotations"),
        );
        const invoicesData = filterRecordsByBranch(
          getList(invoiceRes.data, "invoices"),
        );
        setCustomers(customersData);
        setProducts(productsData);
        setQuotations(quotationsData);
        setInvoices(invoicesData);
        const totalQuotationValue = quotationsData.reduce(
          (sum, item) => sum + Number(item.total_amount || 0),
          0,
        );
        const convertedQuotations = quotationsData.filter(
          (item) => item.status === "converted",
        ).length;
        const pendingQuotations = quotationsData.filter(
          (item) => item.status === "draft" || item.status === "sent",
        ).length;
        setReport({
          summary: {
            total_received: totalQuotationValue,
            total_expense: 0,
            net_profit: totalQuotationValue,
            pending_amount: 0,
            total_customers: customersData.length,
            total_products: productsData.length,
            total_invoices: invoicesData.length,
            paid_invoices: convertedQuotations,
            partial_invoices: 0,
            pending_invoices: pendingQuotations,
          },
          monthlySales: [],
          monthlyExpenses: [],
          recentInvoices: invoicesData.slice(0, 5),
          recentPayments: [],
          topCustomers: customersData.slice(0, 5).map((customer) => ({
            customer_name: customer.customer_name,
            branch_name: customer.branch_name,
            branch_code: customer.branch_code,
            total_sales: 0,
          })),
        });
        return;
      }
      const query =
        selectedBranch === "all"
          ? "/reports"
          : `/reports?branch_id=${selectedBranch}`;
      const res = await api.get(query);
      if (requestId !== dashboardRequest.current) return;
      setReport(res.data || { summary: {} });
      if (isAdmin) {
        try {
          const quotationRes = await api.get("/quotations");
          if (requestId !== dashboardRequest.current) return;
          setQuotations(
            filterRecordsByBranch(getList(quotationRes.data, "quotations")),
          );
        } catch (error) {
          if (requestId !== dashboardRequest.current) return;
          setQuotations(safeArray(res.data?.recentQuotations));
          setDashboardError(
            error.response?.data?.message || "Failed to load recent quotations",
          );
        }
      }
    } catch (error) {
      if (requestId === dashboardRequest.current)
        setDashboardError(
          error.response?.data?.message || "Failed to fetch dashboard",
        );
    } finally {
      if (requestId === dashboardRequest.current) setRefreshing(false);
    }
  }, [filterRecordsByBranch, isSalesUser, isAdmin, selectedBranch]);
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  useEffect(() => {
    if (user) {
      socket.emit("join_rooms", {
        id: user.id,
        role: user.role,
        company_id: user.company_id,
      });
    }
    const handleDashboardUpdate = () => {
      fetchDashboardData();
    };
    socket.on("dashboard_updated", handleDashboardUpdate);
    return () => {
      socket.off("dashboard_updated", handleDashboardUpdate);
    };
  }, [fetchDashboardData, user?.id, user?.role, user?.company_id]);
  const openModal = async (type) => {
    if (
      isSalesUser &&
      ![
        "customers",
        "products",
        "quotations",
        "pending_quotations",
        "converted_quotations",
        "invoices",
      ].includes(type)
    )
      return;
    setModalType(type);
    setModalSearch("");
    setModalLoading(true);
    try {
      if (type === "customers") {
        const res = await api.get("/customers");
        setCustomers(filterRecordsByBranch(getList(res.data, "customers")));
      }
      if (type === "products") {
        const res = await api.get("/products");
        setProducts(filterRecordsByBranch(getList(res.data, "products")));
      }
      if (
        [
          "invoices",
          "paid_invoices",
          "partial_invoices",
          "pending_invoices",
          "pending_amount",
          "revenue",
          "profit",
        ].includes(type)
      ) {
        const res = await api.get("/invoices");
        setInvoices(filterRecordsByBranch(getList(res.data, "invoices")));
      }
      if (["payments", "revenue", "profit"].includes(type)) {
        try {
          const res = await api.get("/payments");
          setPayments(filterRecordsByBranch(getList(res.data, "payments")));
        } catch {
          setPayments(report?.recentPayments || []);
        }
      }
      if (["expenses", "profit"].includes(type)) {
        try {
          const res = await api.get("/expenses");
          setExpenses(filterRecordsByBranch(getList(res.data, "expenses")));
        } catch {
          setExpenses([]);
        }
      }
      if (
        ["quotations", "pending_quotations", "converted_quotations"].includes(
          type,
        )
      ) {
        const res = await api.get("/quotations");
        setQuotations(filterRecordsByBranch(getList(res.data, "quotations")));
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to load details");
    } finally {
      setModalLoading(false);
    }
  };
  if (!report && dashboardError)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-white p-8 text-center dark:bg-slate-900"
      >
        <AlertCircle className="mx-auto mb-3 text-red-500" />
        <p className="text-sm text-red-600">{dashboardError}</p>
        <button
          type="button"
          onClick={fetchDashboardData}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  if (!report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 size={20} className="animate-spin text-blue-600" />
          Loading Dashboard...
        </div>
      </div>
    );
  }
  const summary = report.summary || {};
  const cards = isSalesUser
    ? [
        {
          type: "quotations",
          title: "Quotation Value",
          value: dashboardMoney(summary.total_received),
          icon: <IndianRupee size={20} />,
          color:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        },
        {
          type: "pending_quotations",
          title: "Pending Quotations",
          value: summary.pending_invoices || 0,
          icon: <AlertCircle size={20} />,
          color:
            "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
        },
        {
          type: "converted_quotations",
          title: "Converted Quotations",
          value: summary.paid_invoices || 0,
          icon: <TrendingUp size={20} />,
          color:
            "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
        },
        {
          type: "invoices",
          title: "Invoices",
          value: summary.total_invoices || 0,
          icon: <FileText size={20} />,
          color:
            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        },
        {
          type: "customers",
          title: "Customers",
          value: summary.total_customers || 0,
          icon: <Users size={20} />,
          color:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        },
        {
          type: "products",
          title: "Products",
          value: summary.total_products || 0,
          icon: <Package size={20} />,
          color:
            "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
        },
      ]
    : [
        {
          type: "revenue",
          title: "Total Revenue",
          value: dashboardMoney(summary.total_received),
          icon: <IndianRupee size={20} />,
          color:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        },
        {
          type: "expenses",
          title: "Total Expenses",
          value: dashboardMoney(summary.total_expense),
          icon: <TrendingDown size={20} />,
          color: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
        },
        {
          type: "profit",
          title: "Net Profit",
          value: dashboardMoney(summary.net_profit),
          icon: <TrendingUp size={20} />,
          color:
            "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
        },
        {
          type: "pending_amount",
          title: "Pending Amount",
          value: dashboardMoney(summary.pending_amount),
          icon: <FileText size={20} />,
          color:
            "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
        },
        {
          type: "customers",
          title: "Customers",
          value: summary.total_customers || 0,
          icon: <Users size={20} />,
          color:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        },
        {
          type: "products",
          title: "Products",
          value: summary.total_products || 0,
          icon: <Package size={20} />,
          color:
            "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
        },
        {
          type: "invoices",
          title: "Invoices",
          value: summary.total_invoices || 0,
          icon: <FileText size={20} />,
          color:
            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        },
        {
          type: "paid_invoices",
          title: "Paid Invoices",
          value: summary.paid_invoices || 0,
          icon: <Wallet size={20} />,
          color:
            "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
        },
      ];
  return (
    <div
      className={`dashboard-workspace w-full min-w-0 space-y-5 ${isAdmin ? "admin-dashboard" : ""}`}
    >
      <style>{`
        .transaction-text table,
        .transaction-text table th,
        .transaction-text table td,
        .transaction-text table td span,
        .transaction-text button,
        .transaction-text input,
        .transaction-text p {
          font-size: 14px;
          line-height: 20px;
        }
        .transaction-text table th,
        .transaction-text table td.font-semibold,
        .transaction-text button { font-weight: 500; }
        .transaction-text h2 { font-size: 16px; line-height: 24px; }
        .dashboard-workspace [class~="text-xs"],
        .dashboard-workspace [class~="text-[10px]"],
        .dashboard-workspace [class~="text-[11px]"] {
          font-size: 14px;
          line-height: 1.5;
        }
        .dashboard-workspace button:focus-visible,
        .dashboard-workspace input:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      `}</style>
      {isAdmin && (
        <style>{`
        .admin-dashboard [class~="text-xs"],
        .admin-dashboard [class~="text-[10px]"],
        .admin-dashboard [class~="text-[11px]"] {
          font-size: 14px;
          line-height: 1.5;
        }
        .admin-dashboard table th,
        .admin-dashboard table td { font-size: 14px; line-height: 1.5; }
      `}</style>
      )}
      <header className="flex flex-col justify-between gap-4 py-1 lg:flex-row lg:items-center">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Business workspace<span className="text-slate-300">/</span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              {isSalesUser
                ? "Sales Dashboard"
                : user?.role === "accountant"
                  ? "Accountant Dashboard"
                  : "Admin Dashboard"}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BranchFilter
            branches={branches}
            selectedBranch={selectedBranch}
            setSelectedBranch={(value) => {
              setReport(null);
              setModalType(null);
              setSelectedBranch(value);
            }}
            formatBranchLabel={formatBranchLabel}
          />
          <button
            type="button"
            disabled={refreshing}
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>
      {dashboardError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {dashboardError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.slice(0, 4).map((card) => (
          <SummaryCard key={card.type} {...card} onClick={openModal} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        {cards.slice(4).map((card) => (
          <button
            key={card.type}
            type="button"
            onClick={() => openModal(card.type)}
            className="flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600"
          >
            <span className="text-slate-400">{card.icon}</span>
            {card.title}
            <span className="ml-1 font-semibold text-slate-800 dark:text-slate-100">
              {card.value}
            </span>
          </button>
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-5">
          <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_215px]">
            <DashboardTrend
              isSalesUser={isSalesUser}
              salesData={safeArray(report.monthlySales)}
              expenseData={safeArray(report.monthlyExpenses)}
              invoices={invoices}
              quotations={quotations}
              chartFilter={chartFilter}
              setChartFilter={setChartFilter}
            />
            {isSalesUser ? (
              <QuotationOverview quotations={quotations} onOpen={openModal} />
            ) : (
              <InvoiceOverview summary={summary} onOpen={openModal} />
            )}
          </div>
          <RecentInvoices
            invoices={safeArray(report.recentInvoices).slice(0, 5)}
            formatBranchLabel={formatBranchLabel}
            onViewAll={() => openModal("invoices")}
          />
          {(isSalesUser || isAdmin) && (
            <RecentQuotations
              quotations={quotations}
              onViewAll={() => openModal("quotations")}
            />
          )}
          {!isSalesUser && (
            <RecentPayments
              payments={safeArray(report.recentPayments).slice(0, 5)}
              formatBranchLabel={formatBranchLabel}
              onViewAll={() => openModal("payments")}
            />
          )}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
              Quick Access
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(isSalesUser
                ? [
                    ["quotations", "Quotations", FileText],
                    ["invoices", "Invoices", FileText],
                    ["customers", "Customers", Users],
                  ]
                : [
                    ["invoices", "Invoices", FileText],
                    ["payments", "Payments", Wallet],
                    ["expenses", "Expenses", TrendingDown],
                  ]
              ).map(([type, label, Icon]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => openModal(type)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950">
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </span>
                  <ArrowUpRight size={15} className="text-slate-400" />
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="min-w-0 space-y-5">
          <RecordActivity
            invoices={safeArray(report.recentInvoices)}
            payments={isSalesUser ? [] : safeArray(report.recentPayments)}
            quotations={isSalesUser ? quotations : []}
          />
          <CustomerRanking
            customers={isSalesUser ? customers : safeArray(report.topCustomers)}
            isSalesUser={isSalesUser}
            onViewAll={() => openModal("customers")}
          />
        </aside>
      </div>
      {modalType && (
        <DashboardDetailsModal
          type={modalType}
          search={modalSearch}
          setSearch={setModalSearch}
          loading={modalLoading}
          summary={summary}
          customers={customers}
          products={products}
          invoices={invoices}
          payments={payments}
          expenses={expenses}
          quotations={quotations}
          formatBranchLabel={formatBranchLabel}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
}
function BranchFilter({
  branches,
  selectedBranch,
  setSelectedBranch,
  formatBranchLabel,
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const branchList = safeArray(branches);
  const selected =
    selectedBranch === "all"
      ? { branch_name: "All Branches" }
      : branchList.find((b) => String(b.id) === String(selectedBranch));
  return (
    <div ref={dropdownRef} className="relative min-w-[220px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
      >
        <span className="truncate">
          {selectedBranch === "all"
            ? "All Branches"
            : formatBranchLabel(selected)}
        </span>
        <ChevronDown
          size={16}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setSelectedBranch("all");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            All Branches
            {selectedBranch === "all" && (
              <Check size={15} className="text-green-600" />
            )}
          </button>
          {branchList.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                setSelectedBranch(String(branch.id));
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="truncate">
                {formatBranchLabel(branch)}
                {(branch.is_main === true || branch.is_main === 1) && " • HQ"}
              </span>
              {String(selectedBranch) === String(branch.id) && (
                <Check size={15} className="shrink-0 text-green-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function DashboardDetailsModal({
  type,
  search,
  setSearch,
  loading,
  summary,
  customers,
  products,
  invoices,
  payments,
  expenses,
  quotations,
  formatBranchLabel,
  onClose,
}) {
  const titleMap = {
    revenue: "Total Revenue",
    expenses: "Total Expenses",
    profit: "Net Profit",
    pending_amount: "Pending Amount",
    customers: "Customers",
    products: "Products",
    invoices: "Invoices",
    paid_invoices: "Paid Invoices",
    partial_invoices: "Partial Invoices",
    pending_invoices: "Pending Invoices",
    quotations: "Quotations",
    pending_quotations: "Pending Quotations",
    converted_quotations: "Converted Quotations",
    payments: "Payments",
  };
  const isFinancial = ["revenue", "expenses", "profit"].includes(type);
  const filteredInvoices = safeArray(invoices)
    .filter((item) => {
      if (type === "paid_invoices") return item.status === "paid";
      if (type === "partial_invoices") return item.status === "partial";
      if (type === "pending_invoices") {
        return item.status !== "paid" && item.status !== "cancelled";
      }
      if (type === "pending_amount") {
        return item.status !== "paid";
      }
      return true;
    })
    .filter((item) =>
      `${item.invoice_number || ""} ${item.customer_name || ""} ${
        item.branch_name || ""
      } ${item.status || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const filteredCustomers = safeArray(customers).filter((item) =>
    `${item.customer_name || ""} ${item.company_name || ""} ${
      item.email || ""
    } ${item.phone || ""} ${item.branch_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredProducts = safeArray(products).filter((item) =>
    `${item.product_name || ""} ${item.name || ""} ${item.sku || ""} ${
      item.category || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredPayments = safeArray(payments).filter((item) =>
    `${item.invoice_number || ""} ${item.customer_name || ""} ${
      item.branch_name || ""
    } ${item.payment_method || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredExpenses = safeArray(expenses).filter((item) =>
    `${item.category || ""} ${item.vendor_name || ""} ${item.notes || ""} ${
      item.branch_name || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredQuotations = safeArray(quotations)
    .filter((item) => {
      if (type === "pending_quotations") {
        return item.status === "draft" || item.status === "sent";
      }
      if (type === "converted_quotations") {
        return item.status === "converted";
      }
      return true;
    })
    .filter((item) =>
      `${item.quotation_number || ""} ${item.customer_name || ""} ${
        item.branch_name || ""
      } ${item.status || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const count =
    type === "customers"
      ? filteredCustomers.length
      : type === "products"
        ? filteredProducts.length
        : type === "expenses"
          ? filteredExpenses.length
          : [
                "quotations",
                "pending_quotations",
                "converted_quotations",
              ].includes(type)
            ? filteredQuotations.length
            : [
                  "pending_amount",
                  "invoices",
                  "paid_invoices",
                  "partial_invoices",
                  "pending_invoices",
                ].includes(type)
              ? filteredInvoices.length
              : filteredPayments.length;
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm ${["invoices", "quotations", "payments"].includes(type) ? "transaction-text" : ""}`}
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Dashboard Details
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {titleMap[type] || "Details"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isFinancial
                ? "Detailed financial summary with breakdown and records."
                : `${count} record(s) found`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        {!isFinancial && (
          <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-950/50"
              />
            </div>
          </div>
        )}
        <div className="overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              Loading details...
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {type === "revenue" ? (
                <RevenueDetails
                  summary={summary}
                  payments={filteredPayments}
                  invoices={filteredInvoices}
                  formatBranchLabel={formatBranchLabel}
                />
              ) : type === "expenses" ? (
                <ExpenseDetails
                  summary={summary}
                  expenses={filteredExpenses}
                  formatBranchLabel={formatBranchLabel}
                />
              ) : type === "profit" ? (
                <ProfitDetails
                  summary={summary}
                  payments={filteredPayments}
                  expenses={filteredExpenses}
                  invoices={filteredInvoices}
                  formatBranchLabel={formatBranchLabel}
                />
              ) : (
                <>
                  {type === "pending_amount" && (
                    <InvoicesTable
                      invoices={filteredInvoices}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                  {type === "customers" && (
                    <CustomersTable
                      customers={filteredCustomers}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                  {type === "payments" && (
                    <PaymentsTable
                      payments={filteredPayments}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                  {type === "products" && (
                    <ProductsTable
                      products={filteredProducts}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                  {type === "expenses" && (
                    <ExpensesTable
                      expenses={filteredExpenses}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                  {[
                    "invoices",
                    "paid_invoices",
                    "partial_invoices",
                    "pending_invoices",
                  ].includes(type) && (
                    <InvoicesTable
                      invoices={filteredInvoices}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                  {[
                    "quotations",
                    "pending_quotations",
                    "converted_quotations",
                  ].includes(type) && (
                    <QuotationsTable
                      quotations={filteredQuotations}
                      formatBranchLabel={formatBranchLabel}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueDetails({ summary, payments, invoices, formatBranchLabel }) {
  const totalRevenue = Number(summary.total_received || 0);
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const partialInvoices = invoices.filter((i) => i.status === "partial");
  const pendingInvoices = invoices.filter(
    (i) => i.status !== "paid" && i.status !== "cancelled",
  );
  const paidInvoiceAmount = paidInvoices.reduce(
    (sum, i) => sum + Number(i.total_amount || 0),
    0,
  );
  const receivedPaymentAmount = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0,
  );
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/25">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Total Revenue
        </p>
        <h3 className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">
          ₹ {totalRevenue.toFixed(2)}
        </h3>
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          Revenue has been calculated based on received payment / paid invoice
          amount.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <InfoBox
          title="Received Payments"
          value={`₹ ${receivedPaymentAmount.toFixed(2)}`}
        />
        <InfoBox
          title="Paid Invoice Value"
          value={`₹ ${paidInvoiceAmount.toFixed(2)}`}
        />
        <InfoBox title="Paid Invoices" value={paidInvoices.length} />
        <InfoBox
          title="Partial / Pending"
          value={`${partialInvoices.length} / ${pendingInvoices.length}`}
        />
      </div>
      <SectionTitle title="Revenue Source - Payments" />
      <PaymentsTable
        payments={payments}
        formatBranchLabel={formatBranchLabel}
      />
      <SectionTitle title="Paid Invoice Breakdown" />
      <InvoicesTable
        invoices={paidInvoices}
        formatBranchLabel={formatBranchLabel}
      />
    </div>
  );
}
function ExpenseDetails({ summary, expenses, formatBranchLabel }) {
  const totalExpenses = Number(summary.total_expense || 0);
  const expenseCount = expenses.length;
  const highestExpense = expenses.reduce(
    (max, item) => Math.max(max, Number(item.amount || 0)),
    0,
  );
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/25">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          Total Expenses
        </p>
        <h3 className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">
          ₹ {totalExpenses.toFixed(2)}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoBox title="Expense Records" value={expenseCount} />
        <InfoBox
          title="Highest Expense"
          value={`₹ ${highestExpense.toFixed(2)}`}
        />
        <InfoBox
          title="Average Expense"
          value={`₹ ${
            expenseCount ? (totalExpenses / expenseCount).toFixed(2) : "0.00"
          }`}
        />
      </div>
      <SectionTitle title="Expense List" />
      <ExpensesTable
        expenses={expenses}
        formatBranchLabel={formatBranchLabel}
      />
    </div>
  );
}
function ProfitDetails({
  summary,
  payments,
  expenses,
  invoices,
  formatBranchLabel,
}) {
  const totalRevenue = Number(summary.total_received || 0);
  const totalExpenses = Number(summary.total_expense || 0);
  const netProfit = Number(summary.net_profit ?? totalRevenue - totalExpenses);
  const pendingAmount = Number(summary.pending_amount || 0);
  const paidInvoices = invoices.filter((i) => i.status === "paid").length;
  const expenseCount = expenses.length;
  const paymentCount = payments.length;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-green-100 bg-green-50 p-5 dark:border-green-900/50 dark:bg-green-950/25">
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">
          Net Profit
        </p>
        <h3 className="mt-1 text-3xl font-semibold text-slate-950 dark:text-white">
          ₹ {netProfit.toFixed(2)}
        </h3>
        <p className="mt-2 text-sm text-green-700 dark:text-green-300">
          Net Profit = Total Revenue - Total Expenses
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <AmountBox
          title="Revenue"
          value={totalRevenue}
          className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/25 dark:text-emerald-300"
        />
        <AmountBox
          title="Expenses"
          value={totalExpenses}
          className="bg-red-50 text-red-700 dark:bg-red-950/25 dark:text-red-300"
        />
        <AmountBox
          title="Pending Amount"
          value={pendingAmount}
          className="bg-orange-50 text-orange-700 dark:bg-orange-950/25 dark:text-orange-300"
        />
        <AmountBox
          title="Net Profit"
          value={netProfit}
          className="bg-green-50 text-green-700 dark:bg-green-950/25 dark:text-green-300"
        />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Profit Calculation
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          System calculation clear form me:
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          ₹ {totalRevenue.toFixed(2)} - ₹ {totalExpenses.toFixed(2)} = ₹{" "}
          {netProfit.toFixed(2)}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoBox title="Payment Records" value={paymentCount} />
          <InfoBox title="Expense Records" value={expenseCount} />
          <InfoBox title="Paid Invoices" value={paidInvoices} />
        </div>
      </div>
      <SectionTitle title="Revenue Records" />
      <PaymentsTable
        payments={payments}
        formatBranchLabel={formatBranchLabel}
      />
      <SectionTitle title="Expense Records" />
      <ExpensesTable
        expenses={expenses}
        formatBranchLabel={formatBranchLabel}
      />
    </div>
  );
}
function SectionTitle({ title }) {
  return (
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
      {title}
    </h3>
  );
}
function InfoBox({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
        {value}
      </h3>
    </div>
  );
}
function AmountBox({ title, value, className }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 p-4 dark:border-slate-800 ${className}`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
        ₹ {Number(value || 0).toFixed(2)}
      </h3>
    </div>
  );
}
function SummaryCard({ type, title, value, icon, color, onClick }) {
  const tone =
    color.includes("emerald") || color.includes("green")
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-950/30 dark:to-slate-900"
      : color.includes("red")
        ? "border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:border-rose-900 dark:from-rose-950/30 dark:to-slate-900"
        : color.includes("orange")
          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900 dark:from-amber-950/30 dark:to-slate-900"
          : "border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900 dark:from-blue-950/30 dark:to-slate-900";
  return (
    <button
      type="button"
      onClick={() => onClick(type)}
      className={`group flex min-w-0 items-start gap-4 rounded-xl border p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${tone}`}
    >
      <span className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <span className="mt-2 block break-words text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {value}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-blue-600">
          View details <ArrowUpRight size={12} />
        </span>
      </span>
    </button>
  );
}
function parseChartDate(item) {
  const rawDate = item.date || item.month_date || item.created_at || item.month;
  if (!rawDate) return null;
  if (/^\d{4}-\d{2}$/.test(String(rawDate))) {
    return new Date(`${rawDate}-01`);
  }
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function filterChartDataByDate(data, chartFilter) {
  return safeArray(data).filter((item) => {
    const parsed = parseChartDate(item);
    if (!parsed) return !chartFilter.from && !chartFilter.to;
    const month = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    return (
      (!chartFilter.from || month >= chartFilter.from.slice(0, 7)) &&
      (!chartFilter.to || month <= chartFilter.to.slice(0, 7))
    );
  });
}
function ChartSection({ chartFilter, setChartFilter, salesData, expenseData }) {
  const filteredSales = filterChartDataByDate(salesData, chartFilter);
  const filteredExpenses = filterChartDataByDate(expenseData, chartFilter);
  const handleChange = (e) => {
    setChartFilter((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };
  const resetFilter = () => {
    setChartFilter({ from: "", to: "" });
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Business Performance
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monthly invoice sales and expenses · date filter applies to charts
            only.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <DateInput
            label="From Date"
            name="from"
            value={chartFilter.from}
            onChange={handleChange}
          />
          <DateInput
            label="To Date"
            name="to"
            value={chartFilter.to}
            onChange={handleChange}
          />
          <button
            type="button"
            onClick={resetFilter}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SingleChart
          title="Monthly Sales"
          subtitle="Invoice sales based on selected date range"
          data={filteredSales}
          dataKey="sales"
          barColor="#2563eb"
          labelColor="text-blue-700 dark:text-blue-300"
        />
        <SingleChart
          title="Monthly Expenses"
          subtitle="Company expenses based on selected date range"
          data={filteredExpenses}
          dataKey="expenses"
          barColor="#ef4444"
          labelColor="text-red-600 dark:text-red-300"
        />
      </div>
    </div>
  );
}
function DateInput({ label, name, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-950/50"
      />
    </div>
  );
}
function SingleChart({ title, subtitle, data, dataKey, barColor, labelColor }) {
  const total = (data || []).reduce(
    (sum, item) => sum + Number(item[dataKey] || 0),
    0,
  );
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${labelColor}`}>{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-right dark:bg-slate-800">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            ₹ {Number(total || 0).toFixed(2)}
          </p>
        </div>
      </div>
      <div className="h-[280px] w-full">
        {safeArray(data).length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeArray(data)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value) => [
                  `₹ ${Number(value || 0).toFixed(2)}`,
                  "Amount",
                ]}
              />
              <Bar dataKey={dataKey} fill={barColor} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            No chart data available for selected date range.
          </div>
        )}
      </div>
    </div>
  );
}
function CustomersTable({ customers, formatBranchLabel }) {
  return (
    <SimpleTable
      headers={["Customer", "Company", "Email", "Phone", "Branch"]}
      empty="No customers found."
    >
      {safeArray(customers).map((item) => (
        <tr
          key={item.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <TableStrong>{item.customer_name || "-"}</TableStrong>
          <TableCell>{item.company_name || "-"}</TableCell>
          <TableCell>{item.email || "-"}</TableCell>
          <TableCell>{item.phone || "-"}</TableCell>
          <TableCell>{formatBranchLabel(item)}</TableCell>
        </tr>
      ))}
    </SimpleTable>
  );
}
function ProductsTable({ products, formatBranchLabel }) {
  return (
    <SimpleTable
      headers={["Product", "Branch", "SKU", "Category", "Price", "Stock"]}
      empty="No products found."
    >
      {safeArray(products).map((item) => (
        <tr
          key={item.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <TableStrong>{item.product_name || item.name || "-"}</TableStrong>
          <TableCell>{formatBranchLabel(item)}</TableCell>
          <TableCell>{item.sku || "-"}</TableCell>
          <TableCell>{item.category || "-"}</TableCell>
          <TableStrong>
            ₹ {Number(item.unit_price || item.price || 0).toFixed(2)}
          </TableStrong>
          <TableCell>
            {Number(item.variant_count || 0) > 0
              ? Number(item.variant_stock || 0)
              : Number(item.quantity || 0)}
          </TableCell>
        </tr>
      ))}
    </SimpleTable>
  );
}
// Used inside the View All modal.
function InvoicesTable({ invoices, formatBranchLabel }) {
  return (
    <SimpleTable
      headers={["Invoice", "Customer", "Branch", "Date", "Amount", "Status"]}
      empty="No invoices found."
    >
      {safeArray(invoices).map((invoice) => (
        <tr
          key={invoice.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <TableStrong>{invoice.invoice_number || "—"}</TableStrong>
          <TableCell>{invoice.customer_name || "—"}</TableCell>
          <TableCell>{formatBranchLabel(invoice)}</TableCell>

          <TableCell>
            {String(invoice.invoice_date || "—").slice(0, 10)}
          </TableCell>

          <TableStrong>{dashboardMoney(invoice.total_amount)}</TableStrong>

          <td className="p-4">
            <StatusBadge status={invoice.status} />
          </td>
        </tr>
      ))}
    </SimpleTable>
  );
}

function PaymentsTable({ payments, formatBranchLabel }) {
  return (
    <SimpleTable
      headers={["Invoice", "Customer", "Branch", "Amount", "Method"]}
      empty="No payments found."
    >
      {safeArray(payments).map((item) => (
        <tr
          key={item.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <TableStrong>{item.invoice_number || "-"}</TableStrong>

          <TableCell>{item.customer_name || "-"}</TableCell>

          <TableCell>{formatBranchLabel(item)}</TableCell>

          <td className="p-4 font-semibold text-emerald-600 dark:text-emerald-400">
            ₹ {Number(item.amount || 0).toFixed(2)}
          </td>

          <TableCell>{item.payment_method || "-"}</TableCell>
        </tr>
      ))}
    </SimpleTable>
  );
}

function ExpensesTable({ expenses, formatBranchLabel }) {
  return (
    <SimpleTable
      headers={["Category", "Vendor", "Branch", "Amount", "Date"]}
      empty="No expenses found."
    >
      {safeArray(expenses).map((item) => (
        <tr
          key={item.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <TableStrong>{item.category || "-"}</TableStrong>
          <TableCell>{item.vendor_name || "-"}</TableCell>
          <TableCell>{formatBranchLabel(item)}</TableCell>
          <TableStrong>₹ {Number(item.amount || 0).toFixed(2)}</TableStrong>
          <TableCell>
            {item.expense_date ? String(item.expense_date).slice(0, 10) : "-"}
          </TableCell>
        </tr>
      ))}
    </SimpleTable>
  );
}
// Used inside the View All modal.
function QuotationsTable({ quotations, formatBranchLabel }) {
  return (
    <SimpleTable
      headers={["Quotation", "Customer", "Branch", "Date", "Amount", "Status"]}
      empty="No quotations found."
    >
      {safeArray(quotations).map((quotation) => (
        <tr
          key={quotation.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <TableStrong>{quotation.quotation_number || "—"}</TableStrong>

          <TableCell>{quotation.customer_name || "—"}</TableCell>

          <TableCell>{formatBranchLabel(quotation)}</TableCell>

          <TableCell>
            {String(quotation.quotation_date || "—").slice(0, 10)}
          </TableCell>

          <TableStrong>{dashboardMoney(quotation.total_amount)}</TableStrong>

          <td className="p-4">
            <StatusBadge status={quotation.status} />
          </td>
        </tr>
      ))}
    </SimpleTable>
  );
}
function TableCell({ children }) {
  return <td className="p-4 text-slate-600 dark:text-slate-300">{children}</td>;
}
function TableStrong({ children }) {
  return (
    <td className="p-4 font-semibold text-slate-900 dark:text-white">
      {children}
    </td>
  );
}
function SimpleTable({ headers, children, empty }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {headers.map((head) => (
                <th
                  key={head}
                  className="p-4 text-left text-xs font-semibold uppercase tracking-wide"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {rows.length > 0 ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="p-8 text-center text-slate-500 dark:text-slate-400"
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function DataCard({ icon, iconClass, title, buttonText, onViewAll, children }) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${["Recent Invoices", "Recent Quotations", "Recent Payments"].includes(title) ? "transaction-text" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}
          >
            {icon}
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
        >
          {buttonText}
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
function EmptyTableRow({ colSpan, text }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="p-8 text-center text-slate-500 dark:text-slate-400"
      >
        {text}
      </td>
    </tr>
  );
}
function RecentInvoices({ invoices, onViewAll }) {
  return (
    <DataCard
      icon={<FileText size={18} />}
      iconClass="bg-blue-50 text-blue-600"
      title="Recent Invoices"
      buttonText="View All"
      onViewAll={onViewAll}
    >
      <table className="w-full min-w-[560px] text-sm">
        <TableHead
          headers={["Invoice", "Customer", "Date", "Amount", "Status"]}
        />

        <tbody>
          {safeArray(invoices)
            .slice(0, 5)
            .map((invoice) => (
              <tr
                key={invoice.id}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <TableStrong>{invoice.invoice_number || "—"}</TableStrong>
                <TableCell>{invoice.customer_name || "—"}</TableCell>

                <TableCell>
                  {String(invoice.invoice_date || "—").slice(0, 10)}
                </TableCell>

                <TableStrong>
                  {dashboardMoney(invoice.total_amount)}
                </TableStrong>

                <td className="p-4">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}

          {!safeArray(invoices).length && (
            <EmptyTableRow colSpan={5} text="No invoices found." />
          )}
        </tbody>
      </table>
    </DataCard>
  );
}

function RecentPayments({ payments, formatBranchLabel, onViewAll }) {
  return (
    <DataCard
      icon={<Wallet size={18} />}
      iconClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      title="Recent Payments"
      buttonText="View All"
      onViewAll={onViewAll}
    >
      <table className="w-full min-w-[760px] text-sm">
        <TableHead
          headers={["Invoice No.", "Customer", "Branch", "Amount", "Date"]}
        />
        <tbody>
          {safeArray(payments).map((payment) => (
            <tr
              key={payment.id}
              className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <TableStrong>{payment.invoice_number || "-"}</TableStrong>
              <TableCell>{payment.customer_name || "-"}</TableCell>
              <TableCell>{formatBranchLabel(payment)}</TableCell>
              <TableStrong>
                ₹ {Number(payment.amount || 0).toFixed(2)}
              </TableStrong>
              <TableCell>
                {payment.payment_date
                  ? String(payment.payment_date).slice(0, 10)
                  : "-"}
              </TableCell>
            </tr>
          ))}
          {safeArray(payments).length === 0 && (
            <EmptyTableRow colSpan={6} text="No payments found." />
          )}
        </tbody>
      </table>
    </DataCard>
  );
}
function TopCustomers({ customers, formatBranchLabel, onViewAll }) {
  return (
    <DataCard
      icon={<Users size={18} />}
      iconClass="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
      title="Top Customers"
      buttonText="View All"
      onViewAll={onViewAll}
    >
      <table className="w-full min-w-[680px] text-sm">
        <TableHead headers={["Rank", "Customer", "Branch", "Total Sales"]} />
        <tbody>
          {safeArray(customers).map((customer, index) => (
            <tr
              key={index}
              className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <TableStrong>{index + 1}</TableStrong>
              <TableCell>{customer.customer_name || "Unknown"}</TableCell>
              <TableCell>{formatBranchLabel(customer)}</TableCell>
              <TableStrong>
                ₹ {Number(customer.total_sales || 0).toFixed(2)}
              </TableStrong>
            </tr>
          ))}
          {safeArray(customers).length === 0 && (
            <EmptyTableRow colSpan={4} text="No customer sales found." />
          )}
        </tbody>
      </table>
    </DataCard>
  );
}
function TableHead({ headers }) {
  return (
    <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <tr>
        {headers.map((head) => (
          <th
            key={head}
            className="p-3 text-left text-xs font-semibold uppercase tracking-wide"
          >
            {head}
          </th>
        ))}
      </tr>
    </thead>
  );
}
function StatusBadge({ status }) {
  const styles = {
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    unpaid:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    partially_paid:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300",
    "partially paid":
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300",
    expired:
      "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    viewed:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    partial:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300",
    paid: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    overdue: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    cancelled:
      "bg-red-200 text-slate-700 dark:bg-red-800 dark:text-slate-300",
    converted:
      "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    accepted:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        styles[String(status || "").toLowerCase()] ||
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {status || "draft"}
    </span>
  );
}

const dashboardMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
function InvoiceOverview({ summary, onOpen }) {
  const paid = Math.max(0, Number(summary.paid_invoices) || 0);
  const partial = Math.max(0, Number(summary.partial_invoices) || 0);
  const pending = Math.max(0, Number(summary.pending_invoices) || 0);
  const cancelled = Math.max(0, Number(summary.cancelled_invoices) || 0);
  const total = paid + partial + pending + cancelled;
  const segments = [
    ["Paid", paid, "#10b981", "paid_invoices"],
    ["Partial", partial, "#3b82f6", "partial_invoices"],
    ["Pending", pending, "#f59e0b", "pending_invoices"],
    ["Cancelled", cancelled, "#64748b", "cancelled_invoices"],
  ];
  let offset = 0;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Invoice Overview
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Invoice count by payment status
      </p>
      <div className="relative left-1/2 my-5 h-48 w-48 -translate-x-1/2">
        <svg
          viewBox="0 0 160 160"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`Paid ${paid}, partial ${partial}, pending ${pending}, cancelled ${cancelled}`}
        >
          <circle
            cx="80"
            cy="80"
            r="62"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="19"
          />
          {segments.map(([label, count, color]) => {
            const length = total ? (count / total) * 389.56 : 0;
            const start = offset;
            offset += length;
            return (
              <circle
                key={label}
                cx="80"
                cy="80"
                r="62"
                fill="none"
                stroke={color}
                strokeWidth="19"
                strokeDasharray={`${length} ${389.56 - length}`}
                strokeDashoffset={-start}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Tracked invoices</span>
          <span className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {total}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {segments.map(([label, count, color, type]) => (
          <button
            key={type}
            type="button"
            onClick={() => onOpen(type)}
            className="flex w-full items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="flex-1 text-left">{label}</span>
            <span className="font-medium">{count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
function RecordActivity({ invoices, payments, quotations }) {
  const records = [
    ...invoices.map((item) => ({
      key: `invoice-${item.id}`,
      title: "Invoice dated",
      text: item.invoice_number,
      customer: item.customer_name,
      date: item.invoice_date,
      amount: item.total_amount,
      color: "bg-blue-50 text-blue-600",
      icon: FileText,
    })),
    ...payments.map((item) => ({
      key: `payment-${item.id}`,
      title: "Payment recorded",
      text: item.invoice_number,
      customer: item.customer_name,
      date: item.payment_date,
      amount: item.amount,
      color: "bg-emerald-50 text-emerald-600",
      icon: Wallet,
    })),
    ...quotations.map((item) => ({
      key: `quotation-${item.id}`,
      title: "Quotation dated",
      text: item.quotation_number,
      customer: item.customer_name,
      date: item.quotation_date,
      amount: item.total_amount,
      color: "bg-violet-50 text-violet-600",
      icon: FileText,
    })),
  ]
    .filter((item) => item.date && Number.isFinite(Date.parse(item.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 6);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Activity size={17} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Recent Activity
        </h2>
      </div>
      <p className="mb-5 mt-1 text-xs text-slate-500">
        Based on available transaction dates
      </p>
      {records.length ? (
        <ol>
          {records.map((item, index) => (
            <li
              key={item.key}
              className={`relative ml-4 pl-7 ${index < records.length - 1 ? "border-l border-slate-200 pb-6 dark:border-slate-700" : ""}`}
            >
              <span
                className={`absolute -left-4 top-0 rounded-full p-2 ${item.color}`}
              >
                <item.icon size={14} />
              </span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {item.title}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                {item.text || "Transaction"} · {item.customer || "Customer"}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                {dashboardMoney(item.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(item.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">
          No recent records available.
        </p>
      )}
    </section>
  );
}


function CustomerRanking({ customers, isSalesUser, onViewAll }) {
  const list = safeArray(customers).slice(0, 5);
  const maximum = Math.max(
    1,
    ...list.map((item) => Number(item.total_sales) || 0),
  );
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {isSalesUser ? "Customers" : "Top Customers"}
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-blue-600"
        >
          View All
        </button>
      </div>
      <div className="space-y-5">
        {list.map((item, index) => (
          <div key={item.id || index} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs text-blue-600 dark:bg-blue-950">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                {item.customer_name || "Customer"}
              </p>
              {isSalesUser ? (
                <p className="mt-1 truncate text-xs text-slate-400">
                  {item.company_name || item.email || "Customer account"}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {dashboardMoney(item.total_sales)}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, ((Number(item.total_sales) || 0) / maximum) * 100))}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {!list.length && (
        <p className="py-6 text-center text-sm text-slate-400">
          No customer data available.
        </p>
      )}
    </section>
  );
}

function monthlyRecords(records, dateKey) {
  const totals = new Map();
  safeArray(records)
    .filter((item) => item.status !== "cancelled")
    .forEach((item) => {
      const raw = item[dateKey];
      if (!raw) return;
      const parsed = new Date(raw);
      if (!Number.isFinite(parsed.getTime())) return;
      const month = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      totals.set(
        month,
        (totals.get(month) || 0) + (Number(item.total_amount) || 0),
      );
    });
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));
}
function DashboardTrend({
  isSalesUser,
  salesData,
  expenseData,
  invoices,
  quotations,
  chartFilter,
  setChartFilter,
}) {
  const primary = isSalesUser
    ? monthlyRecords(invoices, "invoice_date").map((row) => ({
        month: row.month,
        sales: row.value,
      }))
    : salesData;
  const secondary = isSalesUser
    ? monthlyRecords(quotations, "quotation_date").map((row) => ({
        month: row.month,
        expenses: row.value,
      }))
    : expenseData;
  const merged = new Map();
  const keyFor = (row) => {
    const parsed = parseChartDate(row);
    return parsed
      ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`
      : String(row.month || "");
  };
  filterChartDataByDate(primary, chartFilter).forEach((row) => {
    const key = keyFor(row);
    const item = merged.get(key) || { month: key, sales: null, expenses: null };
    item.sales = (item.sales || 0) + (Number(row.sales) || 0);
    merged.set(key, item);
  });
  filterChartDataByDate(secondary, chartFilter).forEach((row) => {
    const key = keyFor(row);
    const item = merged.get(key) || { month: key, sales: null, expenses: null };
    item.expenses = (item.expenses || 0) + (Number(row.expenses) || 0);
    merged.set(key, item);
  });
  const data = [...merged.values()].sort((a, b) => {
    const left = Date.parse(`${a.month}-01`),
      right = Date.parse(`${b.month}-01`);
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
  });
  const invalidRange = Boolean(
    chartFilter.from && chartFilter.to && chartFilter.from > chartFilter.to,
  );
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {isSalesUser ? "Billing & Quotations" : "Billing & Expenses"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {isSalesUser
              ? "Monthly totals from available sales records"
              : "Monthly invoice sales and expenses"}
          </p>
        </div>
        <span className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 dark:border-slate-700">
          Monthly
        </span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          From
          <input
            type="date"
            aria-label="Chart from date"
            value={chartFilter.from}
            max={chartFilter.to || undefined}
            onChange={(e) =>
              setChartFilter((prev) => ({ ...prev, from: e.target.value }))
            }
            className="min-w-0 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          To
          <input
            type="date"
            aria-label="Chart to date"
            min={chartFilter.from || undefined}
            value={chartFilter.to}
            onChange={(e) =>
              setChartFilter((prev) => ({ ...prev, to: e.target.value }))
            }
            className="min-w-0 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700"
          />
        </label>
        <button
          type="button"
          onClick={() => setChartFilter({ from: "", to: "" })}
          className="text-xs text-blue-600"
        >
          Reset
        </button>
      </div>
      <div className="h-[270px] min-w-0">
        {invalidRange ? (
          <div
            role="alert"
            className="flex h-full items-center justify-center text-sm text-red-500"
          >
            Choose a valid date range.
          </div>
        ) : data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="dashboardBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="dashboardTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(value) =>
                  /^\d{4}-\d{2}$/.test(value)
                    ? new Date(`${value}-01`).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "2-digit",
                      })
                    : value
                }
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={55}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-IN", {
                    notation: "compact",
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value, name) => [dashboardMoney(value), name]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 11, paddingTop: 14 }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                name="Invoiced"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#dashboardBlue)"
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name={isSalesUser ? "Quotations" : "Expenses"}
                stroke="#14b8a6"
                strokeWidth={2.5}
                fill="url(#dashboardTeal)"
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl bg-slate-50 text-center dark:bg-slate-950">
            <TrendingUp size={30} className="mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No monthly data available</p>
            <p className="mt-1 text-xs text-slate-400">
              Try a different chart date range.
            </p>
          </div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        Date range applies to this chart. Summary cards show all-time totals.
      </p>
    </section>
  );
}
function QuotationOverview({ quotations, onOpen }) {
  const converted = safeArray(quotations).filter(
    (item) => item.status === "converted",
  ).length;
  const pending = safeArray(quotations).filter((item) =>
    ["draft", "sent"].includes(item.status),
  ).length;
  const other = quotations.length - converted - pending;
  const total = quotations.length;
  const percent = total ? (converted / total) * 100 : 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Quotation Overview
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Conversion and pipeline status
      </p>
      <div
        className="relative mx-auto my-6 h-36 w-36 rounded-full"
        style={{
          background: total
            ? `conic-gradient(#2563eb ${percent}%, #e2e8f0 0)`
            : "#e2e8f0",
        }}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-400">Conversion</span>
          <strong className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {percent.toFixed(0)}%
          </strong>
        </div>
      </div>
      <div className="space-y-3">
        {[
          ["Converted", converted, "converted_quotations"],
          ["Pending", pending, "pending_quotations"],
          ["All Quotations", total, "quotations"],
        ].map(([label, count, type]) => (
          <button
            key={type}
            type="button"
            onClick={() => onOpen(type)}
            className="flex w-full justify-between text-sm text-slate-500"
          >
            <span>{label}</span>
            <span className="font-medium text-slate-800 dark:text-white">
              {count}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">Other statuses: {other}</p>
    </section>
  );
}
function RecentQuotations({ quotations, onViewAll }) {
  const list = safeArray(quotations)
    .slice()
    .sort(
      (a, b) =>
        (Date.parse(b.quotation_date) || 0) -
        (Date.parse(a.quotation_date) || 0),
    )
    .slice(0, 5);

  return (
    <DataCard
      icon={<FileText size={18} />}
      iconClass="bg-violet-50 text-violet-600"
      title="Recent Quotations"
      buttonText="View All"
      onViewAll={onViewAll}
    >
      <table className="w-full min-w-[560px] text-sm">
        <TableHead
          headers={["Quotation", "Customer", "Date", "Amount", "Status"]}
        />

        <tbody>
          {list.map((quotation) => (
            <tr
              key={quotation.id}
              className="border-t border-slate-100 dark:border-slate-800"
            >
              <TableStrong>{quotation.quotation_number || "—"}</TableStrong>

              <TableCell>{quotation.customer_name || "—"}</TableCell>

              <TableCell>
                {String(quotation.quotation_date || "—").slice(0, 10)}
              </TableCell>

              <TableStrong>
                {dashboardMoney(quotation.total_amount)}
              </TableStrong>

              <td className="p-4">
                <StatusBadge status={quotation.status} />
              </td>
            </tr>
          ))}

          {!list.length && (
            <EmptyTableRow colSpan={5} text="No quotations found." />
          )}
        </tbody>
      </table>
    </DataCard>
  );
}

export default Dashboard;
