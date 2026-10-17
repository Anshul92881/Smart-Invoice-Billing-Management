import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  IndianRupee,
  Users,
  Package,
  FileText,
  Wallet,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Receipt,
  BadgePercent,
  Download,
  Building2,
  X,
  Eye,
  BarChart3,
  ChevronDown,
  Search,
  Filter,
  Crown,
  Boxes,
  Landmark,
  CalendarDays,
  Check,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const getList = (value) => (Array.isArray(value) ? value : []);

const toSafeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

function Reports() {
  const [report, setReport] = useState(null);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [allInvoiceModal, setAllInvoiceModal] = useState(false);
  const [allPaymentModal, setAllPaymentModal] = useState(false);

  const fetchReports = async (selectedBranchId = branchId) => {
    try {
      setLoading(true);
      const params = selectedBranchId ? { branch_id: selectedBranchId } : {};
      const res = await api.get("/reports", { params });
      setReport(res.data || {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports("");
  }, []);

  const downloadCSV = (filename, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      toast.error("No data available to export");
      return;
    }

    const list = getList(rows);
    const headers = Object.keys(list[0] || {});
    const csvRows = [
      headers.join(","),
      ...list.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  };

  const handleBranchChange = (value) => {
    setBranchId(value);
    fetchReports(value);
  };

  if (!report) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <BarChart3 className="mx-auto mb-3 text-blue-600" size={34} />
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          Loading Reports...
        </h2>
      </div>
    );
  }

  const summary = report.summary || {};
  const branches = getList(report.branches);
  const recentInvoices = getList(report.recentInvoices);
  const recentPayments = getList(report.recentPayments);
  const topCustomers = getList(report.topCustomers);
  const topProducts = getList(report.topProducts);
  const branchPerformance = getList(report.branchPerformance);
  const outstandingCollections = getList(report.outstandingCollections);
  const taxReport = getList(report.taxReport);

  const monthlySales = getList(report.monthlySales);
  const monthlyExpenses = getList(report.monthlyExpenses);
  const monthlyInvoices = getList(report.monthlyInvoices);

  const monthlyProfit = monthlySales.map((sale) => {
    const expense = monthlyExpenses.find(
      (item) => item.month === sale.month,
    );

    return {
      month: sale.month,
      profit: Number(sale.sales || 0) - Number(expense?.expenses || 0),
    };
  });

  const bestMonth = [...monthlySales].sort(
    (a, b) => Number(b.sales || 0) - Number(a.sales || 0),
  )[0];

  const bestCustomer = topCustomers[0];

  const highestBranch = [...branchPerformance].sort(
    (a, b) =>
      Number(b.revenue || b.total_sales || 0) -
      Number(a.revenue || a.total_sales || 0),
  )[0];

  const cards = [
    {
      type: "revenue",
      title: "Total Revenue",
      value: formatAmount(summary.total_sales),
      subtitle: "Total invoice sales",
      icon: <IndianRupee size={20} />,
      color:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    {
      type: "received",
      title: "Received",
      value: formatAmount(summary.total_received),
      subtitle: "Customer payments",
      icon: <Wallet size={20} />,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },
    {
      type: "pending",
      title: "Outstanding",
      value: formatAmount(summary.pending_amount),
      subtitle: "Pending collection",
      icon: <AlertCircle size={20} />,
      color: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:bg-red-950/40 dark:text-red-300",
    },
    {
      type: "expenses",
      title: "Expenses",
      value: formatAmount(summary.total_expense),
      subtitle: "Total business expense",
      icon: <TrendingDown size={20} />,
      color:
        "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
    },
    {
      type: "profit",
      title: "Net Profit",
      value: formatAmount(summary.net_profit),
      subtitle: "Sales minus expenses",
      icon:
        Number(summary.net_profit || 0) >= 0 ? (
          <TrendingUp size={20} />
        ) : (
          <TrendingDown size={20} />
        ),
      color:
        Number(summary.net_profit || 0) >= 0
          ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
          : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    },
    {
      type: "tax",
      title: "Tax Collected",
      value: formatAmount(summary.total_tax),
      subtitle: "GST/tax from invoices",
      icon: <BadgePercent size={20} />,
      color:
        "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    },
    {
      type: "customers",
      title: "Customers",
      value: summary.total_customers || 0,
      subtitle: "Total customers",
      icon: <Users size={20} />,
      color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    },
    {
      type: "products",
      title: "Products",
      value: summary.total_products || 0,
      subtitle: "Total products",
      icon: <Package size={20} />,
      color:
        "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300",
    },
    {
      type: "invoices",
      title: "Invoices",
      value: summary.total_invoices || 0,
      subtitle: "Total invoices",
      icon: <FileText size={20} />,
      color:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
              <BarChart3 size={17} />
              Reports & Analytics
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Company Reports
            </h1>

            <p className="mt-1 max-w-3xl text-sm font-medium leading-5 text-slate-500 dark:text-slate-400">
              Revenue, invoices, payments, customers, products, branch
              performance and tax insights.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <BranchSelect
                branches={branches}
                value={branchId}
                onChange={handleBranchChange}
              />
            </div>

            <button
              onClick={() => fetchReports(branchId)}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => downloadCSV("recent-invoices.csv", recentInvoices)}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>
      </div>

      <QuickInsights
        bestMonth={bestMonth}
        bestCustomer={bestCustomer}
        highestBranch={highestBranch}
        summary={summary}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SummaryCard
            key={card.type}
            {...card}
            onClick={() => setSelectedCard(card.type)}
          />
        ))}
      </div>

      <InvoiceStatusAnalytics summary={summary} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <ChartCard
          title="Monthly Revenue"
          subtitle="Invoice amount month-wise"
          data={monthlySales}
          dataKey="sales"
        />

        <ChartCard
          title="Monthly Expenses"
          subtitle="Expense amount month-wise"
          data={monthlyExpenses}
          dataKey="expenses"
        />

        <ChartCard
          title="Monthly Profit"
          subtitle="Sales minus expenses"
          data={monthlyProfit}
          dataKey="profit"
        />

        <ChartCard
          title="Invoice Trend"
          subtitle="Monthly invoice count"
          data={monthlyInvoices}
          dataKey="invoice_count"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TopCustomers customers={topCustomers} />
        <TopProducts products={topProducts} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <BranchPerformance branches={branchPerformance} />
        <OutstandingCollection collections={outstandingCollections} />
      </div>

      <TaxReport taxReport={taxReport} summary={summary} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RecentInvoices
          invoices={recentInvoices}
          onView={setSelectedInvoice}
          onViewAll={() => setAllInvoiceModal(true)}
        />

        <RecentPayments
          payments={recentPayments}
          onViewAll={() => setAllPaymentModal(true)}
        />
      </div>

      <ExportCenter report={report} downloadCSV={downloadCSV} />

      {selectedCard && (
        <CardDetailsModal
          type={selectedCard}
          summary={summary}
          report={report}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {allInvoiceModal && (
        <AllInvoicesModal
          invoices={recentInvoices}
          onClose={() => setAllInvoiceModal(false)}
          onView={setSelectedInvoice}
        />
      )}

      {allPaymentModal && (
        <AllPaymentsModal
          payments={recentPayments}
          onClose={() => setAllPaymentModal(false)}
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
          color: #0f172a;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
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
      `}</style>
    </div>
  );
}

function BranchSelect({ branches, value, onChange }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const branchList = getList(branches);

  const formatBranchLabel = (branch) => {
    if (!branch?.branch_name) return "Selected Branch";

    return branch.branch_code
      ? `${branch.branch_name} (${branch.branch_code})`
      : branch.branch_name;
  };

  const selectedBranch = branchList.find(
    (branch) => String(branch.id) === String(value)
  );

  return (
    <div
      ref={dropdownRef}
      className="relative w-full min-w-0 sm:min-w-[220px]"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Select branch"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600"
      >
        <span className="min-w-0 truncate">
          {value === ""
            ? "All Branches"
            : formatBranchLabel(selectedBranch)}
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>All Branches</span>

              {value === "" && (
                <Check
                  size={15}
                  className="shrink-0 text-green-600"
                />
              )}
            </button>

            {branchList.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => {
                  onChange(String(branch.id));
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="min-w-0 truncate">
                  {formatBranchLabel(branch)}
                  {(branch.is_main === true ||
                    branch.is_main === 1) &&
                    " • HQ"}
                </span>

                {String(value) === String(branch.id) && (
                  <Check
                    size={15}
                    className="shrink-0 text-green-600"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function QuickInsights({ bestMonth, bestCustomer, highestBranch, summary }) {
  const insights = [
    {
      title: "Best Month",
      value: bestMonth?.month || "-",
      sub: formatAmount(bestMonth?.sales || 0),
      icon: <CalendarDays size={18} />,
    },
    {
      title: "Top Customer",
      value: bestCustomer?.customer_name || "-",
      sub: formatAmount(bestCustomer?.total_sales || 0),
      icon: <Crown size={18} />,
    },
    {
      title: "Best Branch",
      value: highestBranch?.branch_name || "-",
      sub: formatAmount(
        highestBranch?.revenue || highestBranch?.total_sales || 0,
      ),
      icon: <Building2 size={18} />,
    },
    {
      title: "Collection Due",
      value: formatAmount(summary.pending_amount),
      sub: `${summary.pending_invoices || 0} Pending Invoices`,
      icon: <AlertCircle size={18} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {insights.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <div className="inline-flex shrink-0 rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {item.icon}
            </div>

            <p className="truncate text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item.title}
            </p>
          </div>

          <h3 className="mt-3 truncate text-lg font-bold text-slate-900 dark:text-white">
            {item.value}
          </h3>

          <p className="mt-1 truncate text-sm text-slate-700 dark:text-slate-200">
            {item.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
          <p className="mt-1 truncate text-xs font-semibold text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
          <p className="mt-2 text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100">
            Click to view details
          </p>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </button>
  );
}

function InvoiceStatusAnalytics({ summary }) {
  const rows = [
    {
      label: "Paid",
      count: summary.paid_invoices || 0,
      amount: summary.paid_amount || summary.total_received || 0,
      className: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    },
    {
      label: "Partial",
      count: summary.partial_invoices || 0,
      amount: summary.partial_amount || 0,
      className: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
    },
    {
      label: "Pending",
      count: summary.pending_invoices || 0,
      amount: summary.pending_amount || 0,
      className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    },
    {
      label: "Overdue",
      count: summary.overdue_invoices || 0,
      amount: summary.overdue_amount || 0,
      className: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="text-blue-600" size={20} />
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Invoice Status Analytics
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Status-wise invoice count and amount overview.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className={`rounded-2xl p-4 ${row.className}`}>
            <p className="text-sm font-semibold">{row.label} Invoices</p>
            <h3 className="mt-1 text-2xl font-bold">{row.count}</h3>
            <p className="mt-1 text-sm font-semibold">
              {formatAmount(row.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, data, dataKey }) {
  const chartData = getList(data);

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-1">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <div className="h-[250px] w-full min-w-0 overflow-hidden">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey={dataKey} fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyBox text="No chart data available." />
        )}
      </div>
    </div>
  );
}

function TopCustomers({ customers }) {
  const list = getList(customers);

  return (
    <DataCard
      title="Top Customers"
      subtitle="Customers ranked by invoice sales."
      icon={<Users size={20} />}
    >
      <div className="space-y-3">
        {list.slice(0, 5).map((customer, index) => (
          <RankRow
            key={index}
            rank={index + 1}
            title={customer.customer_name || "Unknown Customer"}
            subtitle={customer.branch_name || "Main Company"}
            value={formatAmount(customer.total_sales)}
          />
        ))}

        {list.length === 0 && <EmptyBox text="No customer sales found." />}
      </div>
    </DataCard>
  );
}

function TopProducts({ products }) {
  const list = getList(products);

  return (
    <DataCard
      title="Top Products"
      subtitle="Products ranked by sold quantity and revenue."
      icon={<Boxes size={20} />}
    >
      <div className="space-y-3">
        {list.slice(0, 5).map((product, index) => (
          <RankRow
            key={index}
            rank={index + 1}
            title={product.product_name || product.name || "Unknown Product"}
            subtitle={`Qty Sold: ${product.qty_sold || product.quantity_sold || 0}`}
            value={formatAmount(product.total_sales || product.revenue || 0)}
          />
        ))}

        {list.length === 0 && (
          <EmptyBox text="Top product data not available yet." />
        )}
      </div>
    </DataCard>
  );
}

function BranchPerformance({ branches }) {
  const list = getList(branches);

  return (
    <DataCard
      title="Branch Performance"
      subtitle="Branch-wise revenue, expenses and profit."
      icon={<Building2 size={20} />}
    >
      <ResponsiveTable
        heads={["Branch", "Revenue", "Expense", "Profit"]}
        rows={list
          .slice(0, 5)
          .map((branch) => [
            branch.branch_name || "-",
            formatAmount(branch.revenue || branch.total_sales),
            formatAmount(branch.expense || branch.total_expense),
            formatAmount(
              branch.profit ||
                Number(branch.revenue || branch.total_sales || 0) -
                  Number(branch.expense || branch.total_expense || 0),
            ),
          ])}
        emptyText="Branch performance data not available yet."
      />
    </DataCard>
  );
}

function OutstandingCollection({ collections }) {
  const list = getList(collections);

  return (
    <DataCard
      title="Outstanding Collection"
      subtitle="Customers with pending payment."
      icon={<AlertCircle size={20} />}
    >
      <ResponsiveTable
        heads={["Customer", "Pending", "Branch"]}
        rows={list
          .slice(0, 5)
          .map((item) => [
            item.customer_name || "-",
            formatAmount(item.pending_amount || item.balance_due),
            item.branch_name || "Main Company",
          ])}
        emptyText="Outstanding collection data not available yet."
      />
    </DataCard>
  );
}

function TaxReport({ taxReport, summary }) {
  const list = getList(taxReport);
  const fallbackRows = [
    ["CGST", formatAmount(summary.total_cgst || 0)],
    ["SGST", formatAmount(summary.total_sgst || 0)],
    ["IGST", formatAmount(summary.total_igst || 0)],
    ["Total Tax", formatAmount(summary.total_tax || 0)],
  ];

  const rows =
    list.length > 0
      ? list.map((tax) => [
          tax.tax_name || tax.name || "-",
          formatAmount(tax.amount || tax.total_tax || 0),
        ])
      : fallbackRows;

  return (
    <DataCard
      title="Tax Report"
      subtitle="GST/tax collection summary."
      icon={<Landmark size={20} />}
    >
      <ResponsiveTable
        heads={["Tax Type", "Amount"]}
        rows={rows}
        emptyText="No tax data found."
      />
    </DataCard>
  );
}

function RecentInvoices({ invoices, onView, onViewAll }) {
  const list = getList(invoices);
  const latestInvoices = [...list]
    .sort(
      (a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0),
    )
    .slice(0, 5);

  return (
    <DataCard
      title="Recent Invoices"
      subtitle="Latest generated invoices."
      icon={<Receipt size={20} />}
      action={
        list.length > 5 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            View All
          </button>
        ) : null
      }
    >
      <InvoiceTable invoices={latestInvoices} onView={onView} />
    </DataCard>
  );
}

function RecentPayments({ payments, onViewAll }) {
  const list = getList(payments);

  return (
    <DataCard
      title="Recent Payments"
      subtitle="Latest customer payment records."
      icon={<Wallet size={20} />}
      action={
        list.length > 5 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            View All
          </button>
        ) : null
      }
    >
      <PaymentTable payments={list.slice(0, 5)} />
    </DataCard>
  );
}

function ExportCenter({ report, downloadCSV }) {
  const exports = [
    ["Invoice CSV", "invoices.csv", report.recentInvoices || []],
    ["Payment CSV", "payments.csv", report.recentPayments || []],
    ["Top Customers CSV", "top-customers.csv", report.topCustomers || []],
    ["Top Products CSV", "top-products.csv", report.topProducts || []],
    [
      "Branch Report CSV",
      "branch-performance.csv",
      report.branchPerformance || [],
    ],
    ["Tax Report CSV", "tax-report.csv", report.taxReport || []],
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <Download className="text-blue-600" size={20} />
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Export Center
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Download report data as CSV.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {exports.map(([label, filename, rows]) => (
          <button
            key={filename}
            type="button"
            onClick={() => downloadCSV(filename, rows)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download size={16} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardDetailsModal({ type, summary, report, onClose }) {
  const topCustomer = report.topCustomers?.[0];
  const topProduct = report.topProducts?.[0];

  const dataMap = {
    revenue: {
      title: "Revenue Details",
      subtitle: "Sales and collection overview.",
      rows: [
        ["Total Revenue", formatAmount(summary.total_sales)],
        ["Received", formatAmount(summary.total_received)],
        ["Outstanding", formatAmount(summary.pending_amount)],
        [
          "Average Invoice Value",
          formatAmount(avg(summary.total_sales, summary.total_invoices)),
        ],
      ],
    },
    received: {
      title: "Payment Collection Details",
      subtitle: "Customer payment summary.",
      rows: [
        ["Received Amount", formatAmount(summary.total_received)],
        ["Recent Payments", report.recentPayments?.length || 0],
        ["Paid Invoices", summary.paid_invoices || 0],
        ["Partial Invoices", summary.partial_invoices || 0],
      ],
    },
    pending: {
      title: "Outstanding Collection Details",
      subtitle: "Pending and overdue collection summary.",
      rows: [
        ["Pending Amount", formatAmount(summary.pending_amount)],
        ["Pending Invoices", summary.pending_invoices || 0],
        ["Overdue Invoices", summary.overdue_invoices || 0],
        [
          "Collection Risk",
          Number(summary.pending_amount || 0) > 0 ? "Needs Follow-up" : "Clear",
        ],
      ],
    },
    expenses: {
      title: "Expense Details",
      subtitle: "Business expense summary.",
      rows: [
        ["Total Expenses", formatAmount(summary.total_expense)],
        ["Revenue", formatAmount(summary.total_sales)],
        ["Net Profit", formatAmount(summary.net_profit)],
        ["Expense Ratio", percent(summary.total_expense, summary.total_sales)],
      ],
    },
    profit: {
      title: "Profit Details",
      subtitle: "Net profit calculation.",
      rows: [
        ["Revenue", formatAmount(summary.total_sales)],
        ["Expenses", formatAmount(summary.total_expense)],
        ["Net Profit", formatAmount(summary.net_profit)],
        ["Profit Margin", percent(summary.net_profit, summary.total_sales)],
      ],
    },
    tax: {
      title: "Tax Details",
      subtitle: "GST/tax collection summary.",
      rows: [
        ["Total Tax", formatAmount(summary.total_tax)],
        ["CGST", formatAmount(summary.total_cgst)],
        ["SGST", formatAmount(summary.total_sgst)],
        ["IGST", formatAmount(summary.total_igst)],
      ],
    },
    customers: {
      title: "Customer Details",
      subtitle: "Customer and sales contribution.",
      rows: [
        ["Total Customers", summary.total_customers || 0],
        ["Top Customer", topCustomer?.customer_name || "-"],
        ["Top Customer Sales", formatAmount(topCustomer?.total_sales)],
        ["Customer Records", report.topCustomers?.length || 0],
      ],
    },
    products: {
      title: "Product Details",
      subtitle: "Product performance overview.",
      rows: [
        ["Total Products", summary.total_products || 0],
        ["Top Product", topProduct?.product_name || topProduct?.name || "-"],
        [
          "Top Product Sales",
          formatAmount(topProduct?.total_sales || topProduct?.revenue),
        ],
        ["Product Records", report.topProducts?.length || 0],
      ],
    },
    invoices: {
      title: "Invoice Details",
      subtitle: "Invoice status overview.",
      rows: [
        ["Total Invoices", summary.total_invoices || 0],
        ["Paid", summary.paid_invoices || 0],
        ["Partial", summary.partial_invoices || 0],
        ["Pending", summary.pending_invoices || 0],
      ],
    },
  };

  const data = dataMap[type] || dataMap.revenue;

  return (
    <BaseModal title={data.title} subtitle={data.subtitle} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        {data.rows.map(([label, value]) => (
          <InfoBox key={label} label={label} value={value} />
        ))}
      </div>
    </BaseModal>
  );
}

function AllInvoicesModal({ invoices, onClose, onView }) {
  const list = getList(invoices);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const perPage = 8;

  const filtered = useMemo(() => {
    return list.filter((invoice) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        (invoice.invoice_number || "").toLowerCase().includes(keyword) ||
        (invoice.customer_name || "").toLowerCase().includes(keyword) ||
        (invoice.branch_name || "").toLowerCase().includes(keyword);

      const invoiceStatus = invoice.status || invoice.invoice_status;
      const matchesStatus = status ? invoiceStatus === status : true;

      return matchesSearch && matchesStatus;
    });
  }, [list, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  return (
    <BaseModal
      title="All Invoices"
      subtitle="Search, filter and view invoices."
      onClose={onClose}
      size="max-w-6xl"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer or branch..."
            className="input pl-10"
          />
        </div>

        <div className="relative w-full md:w-56">
          <Filter
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input appearance-none pl-10"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="max-h-[58vh] overflow-y-auto">
        <InvoiceTable invoices={paginated} onView={onView} />
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalRecords={filtered.length}
        onPageChange={setPage}
      />
    </BaseModal>
  );
}

function AllPaymentsModal({ payments, onClose }) {
  const list = getList(payments);
  const [page, setPage] = useState(1);
  const perPage = 8;

  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const paginated = list.slice((page - 1) * perPage, page * perPage);

  return (
    <BaseModal
      title="All Payments"
      subtitle="Complete payment list with pagination."
      onClose={onClose}
      size="max-w-5xl"
    >
      <div className="max-h-[60vh] overflow-y-auto">
        <PaymentTable payments={paginated} />
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalRecords={list.length}
        onPageChange={setPage}
      />
    </BaseModal>
  );
}

function InvoiceModal({ invoice, onClose }) {
  return (
    <BaseModal
      title={invoice.invoice_number || "Invoice Details"}
      subtitle="Quick invoice preview."
      onClose={onClose}
      size="max-w-3xl"
      zIndex="z-[70]"
    >
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        <InfoBox label="Customer" value={invoice.customer_name} />
        <InfoBox label="Branch" value={invoice.branch_name || "Main Company"} />
        <InfoBox label="Amount" value={formatAmount(invoice.total_amount)} />
        <InfoBox
          label="Status"
          value={
            <StatusBadge status={invoice.status || invoice.invoice_status} />
          }
        />
        <InfoBox
          label="Invoice Date"
          value={formatDate(invoice.invoice_date)}
        />
        <InfoBox label="Due Date" value={formatDate(invoice.due_date)} />
      </div>
    </BaseModal>
  );
}

function InvoiceTable({ invoices, onView }) {
  const list = getList(invoices);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {[
              "Invoice",
              "Branch",
              "Customer",
              "Amount",
              "Status",
              "Date",
              "Action",
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
          {list.map((invoice) => (
            <tr
              key={invoice.id || invoice.invoice_number}
              className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              <td className="p-4 font-semibold text-slate-900 dark:text-white">
                {invoice.invoice_number || "-"}
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {invoice.branch_name || "Main Company"}
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {invoice.customer_name || "-"}
              </td>
              <td className="p-4 font-bold text-slate-900 dark:text-white">
                {formatAmount(invoice.total_amount)}
              </td>
              <td className="p-4">
                <StatusBadge
                  status={invoice.status || invoice.invoice_status}
                />
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {formatDate(invoice.invoice_date)}
              </td>
              <td className="p-4">
                <button
                  type="button"
                  onClick={() => onView(invoice)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Eye size={14} />
                  View
                </button>
              </td>
            </tr>
          ))}

          {list.length === 0 && (
            <tr>
              <td colSpan="7" className="p-8">
                <EmptyBox text="No invoices found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTable({ payments }) {
  const list = getList(payments);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {["Invoice", "Branch", "Customer", "Amount"].map((head) => (
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
          {list.map((payment) => (
            <tr
              key={payment.id}
              className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              <td className="p-4 font-semibold text-slate-900 dark:text-white">
                {payment.invoice_number || "-"}
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {payment.branch_name || "Main Company"}
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-300">
                {payment.customer_name || "-"}
              </td>
              <td className="p-4 font-bold text-emerald-600">
                {formatAmount(payment.amount)}
              </td>
            </tr>
          ))}

          {list.length === 0 && (
            <tr>
              <td colSpan="4" className="p-8">
                <EmptyBox text="No payments found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DataCard({ title, subtitle, icon, action, children }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{icon}</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>
        {action}
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}

function RankRow({ rank, title, subtitle, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 dark:bg-slate-800">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {rank}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="shrink-0 text-sm font-bold text-emerald-600">{value}</p>
    </div>
  );
}

function ResponsiveTable({ heads, rows, emptyText }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {heads.map((head) => (
              <th
                key={head}
                className="p-3 text-left text-xs font-bold uppercase tracking-wide"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-t border-slate-100 dark:border-slate-800"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`p-3 ${
                    cellIndex === 0
                      ? "font-semibold text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={heads.length} className="p-6">
                <EmptyBox text={emptyText} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, totalRecords, onPageChange }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Total Records:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {totalRecords}
        </span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 disabled:opacity-50"
        >
          Prev
        </button>

        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function BaseModal({
  title,
  subtitle,
  children,
  onClose,
  size = "max-w-3xl",
  zIndex = "z-50",
}) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm`}
    >
      <div
        className={`max-h-[92vh] w-full ${size} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 dark:bg-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
        {value || "-"}
      </div>
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:bg-slate-950 p-6 dark:border-slate-700 dark:bg-slate-950 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:text-slate-500">
      {text}
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "draft").toLowerCase();

  const styles = {
    draft:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    sent:
      "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    viewed:
      "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
    partial:
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    paid:
      "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    overdue:
      "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
    pending:
      "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
    cancelled:
      "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize shadow-sm ${
        styles[value] || styles.draft
      }`}
    >
      {value}
    </span>
  );
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value) {
  return `₹ ${toSafeNumber(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;
}

function percent(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);
  if (!t) return "0%";
  return `${((v / t) * 100).toFixed(2)}%`;
}

function avg(value, count) {
  const v = Number(value || 0);
  const c = Number(count || 0);
  if (!c) return 0;
  return v / c;
}

export default Reports;
