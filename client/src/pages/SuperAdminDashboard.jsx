import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Loader2,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";



function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    total_companies: 0,
    total_admins: 0,
    active_companies: 0,
    total_revenue: 0,
  });
  const [recentCompanies, setRecentCompanies] = useState([]);
  const [modalType, setModalType] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [companyDetailsLoading, setCompanyDetailsLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [payments, setPayments] = useState([]);
  const fetchDashboardData = async () => {
    try {
      const res = await api.get("/superadmin/dashboard");
      setStats(res.data.stats || {});
      setRecentCompanies(res.data.recentCompanies || []);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to fetch dashboard");
    }
  };
  useEffect(() => {
    fetchDashboardData();
  }, []);
  const openModal = async (type) => {
    setModalType(type);
    setSearch("");
    setModalLoading(true);
    try {
      if (type === "companies" || type === "active_companies") {
        const res = await api.get("/companies");
        setCompanies(
          Array.isArray(res.data) ? res.data : res.data.companies || [],
        );
      }
      if (type === "revenue") {
        try {
          const res = await api.get("/subscriptions/payments/all");
          setPayments(res.data || []);
        } catch {
          setPayments([]);
        }
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to load details");
    } finally {
      setModalLoading(false);
    }
  };
  const closeModal = () => {
    setModalType(null);
    setSearch("");
  };
  const openCompanyDetails = async (company) => {
    try {
      setSelectedCompany(company);
      setCompanyDetails(null);
      setCompanyDetailsLoading(true);
      const res = await api.get(`/superadmin/companies/${company.id}/details`);
      console.log("Company Details Response:", res.data);
      setCompanyDetails(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setCompanyDetailsLoading(false);
    }
  };


  const cards = [
    {
      type: "companies",
      title: "Total Companies",
      value: stats.total_companies || 0,
      icon: <Building2 size={20} />,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },
    {
      type: "revenue",
      title: "Platform Revenue",
      value: `₹ ${Number(stats.total_revenue || 0).toFixed(2)}`,
      icon: <IndianRupee size={20} />,
      color:
        "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    },
    {
      type: "active_companies",
      title: "Active Companies",
      value: stats.active_companies || 0,
      icon: <Activity size={20} />,
      color:
        "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    },
  ];
  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden text-slate-900 dark:text-slate-100">
      {/* Page heading matches the other workspace modules. */}
      <div className="px-1">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Activity size={16} />
          <span>Workspace / Dashboard</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          SuperAdmin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Platform overview, tenants, admins and subscription revenue summary.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <SummaryCard key={card.type} {...card} onClick={openModal} />
        ))}
      </div>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Recent Companies
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Current company records and latest onboarded tenants.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal("companies")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            View All
          </button>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <tr>
                <TableHead title="Company" />
                <TableHead title="GST" />
                <TableHead title="Currency" />
                <TableHead title="Status" />
              </tr>
            </thead>
            <tbody>
              {recentCompanies.map((company) => (
                <tr
                  className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  key={company.id}
                  onClick={() => openCompanyDetails(company)}
                >
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">
                    {company.name || company.company_name || "-"}
                  </td>
                  <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                    {company.gst_number || "-"}
                  </td>
                  <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                    {company.currency || "INR"}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={company.status} />
                  </td>
                </tr>
              ))}
              {recentCompanies.length === 0 && (
                <EmptyRow colSpan={4} text="No recent companies found." />
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modalType && (
        <DetailsModal
          type={modalType}
          loading={modalLoading}
          search={search}
          setSearch={setSearch}
          stats={stats}
          companies={companies}
          admins={admins}
          payments={payments}
          onClose={closeModal}
          onCompanyClick={openCompanyDetails}
        />
      )}
      {selectedCompany && (
        <CompanyDetailsModal
          company={selectedCompany}
          details={companyDetails}
          loading={companyDetailsLoading}
          onClose={() => {
            setSelectedCompany(null);
            setCompanyDetails(null);
          }}
        />
      )}
    </div>
  );
}


// Compact cards keep the icon and totals on one line.
function SummaryCard({ type, title, value, icon, color, onClick }) {
  const cardTones = {
    companies:
      "border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900/50 dark:from-blue-950/30 dark:to-slate-900",
    revenue:
      "border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:border-purple-900/50 dark:from-purple-950/30 dark:to-slate-900",
    active_companies:
      "border-orange-200 bg-gradient-to-br from-orange-50 to-white dark:border-orange-900/50 dark:from-orange-950/30 dark:to-slate-900",
  };

  return (
    <button
      type="button"
      onClick={() => onClick(type)}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${cardTones[type] || ""}`}
    >
      <span className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <span className="mt-1 block break-words text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
          {value}
        </span>
      </span>
    </button>
  );
}

function DetailsModal({
  type,
  loading,
  search,
  setSearch,
  stats,
  companies,
  admins,
  payments,
  onClose,
  onCompanyClick,
}) {


  const safeCompanies = Array.isArray(companies)
    ? companies
    : companies?.companies || [];
  const safeAdmins = Array.isArray(admins) ? admins : admins?.admins || [];


  const activeCompanies = useMemo(
    () =>
      safeCompanies.filter(
        (company) =>
          company.status === "active" ||
          company.is_active === 1 ||
          company.is_active === true,
      ),
    [companies],
  );


  const inactiveCompanies = useMemo(
    () =>
      safeCompanies.filter(
        (company) =>
          company.status === "inactive" ||
          company.is_active === 0 ||
          company.is_active === false,
      ),
    [companies],
  );


  const companyRows =
    type === "active_companies" ? activeCompanies : safeCompanies;
  const filteredCompanies = companyRows.filter((company) =>
    `${company.name || ""} ${company.company_name || ""} ${
      company.email || ""
    } ${company.gst_number || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );



  const filteredAdmins = safeAdmins.filter((admin) =>
    `${admin.name || ""} ${admin.email || ""} ${admin.company_name || ""} ${
      admin.role || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );


  const filteredPayments = payments
    .filter((payment) =>
      `${payment.company_name || ""} ${payment.plan_name || ""} ${
        payment.payment_status || ""
      } ${payment.transaction_id || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        new Date(b.payment_date || b.created_at || 0) -
        new Date(a.payment_date || a.created_at || 0),
    );


  const activeAdmins = safeAdmins.filter(
    (admin) => admin.status !== "inactive",
  );


  const inactiveAdmins = safeAdmins.filter(
    (admin) => admin.status === "inactive",
  );


  const successfulPayments = filteredPayments.filter((item) =>
    ["paid", "success", "completed"].includes(
      String(item.payment_status || "paid").toLowerCase(),
    ),
  );


  const failedPayments = filteredPayments.filter((item) =>
    ["failed", "cancelled", "rejected"].includes(
      String(item.payment_status || "").toLowerCase(),
    ),
  );
  

  const totalRevenue =
    filteredPayments.length > 0
      ? filteredPayments.reduce(
          (sum, item) => sum + Number(item.amount || item.paid_amount || 0),
          0,
        )
      : Number(stats.total_revenue || 0);

  const thisMonthRevenue = filteredPayments
    .filter((item) => {
      const date = item.payment_date || item.created_at;
      if (!date) return false;
      const paymentDate = new Date(date);
      const now = new Date();
      return (
        paymentDate.getMonth() === now.getMonth() &&
        paymentDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce(
      (sum, item) => sum + Number(item.amount || item.paid_amount || 0),
      0,
    );

  const activeSubscribers = new Set(
    successfulPayments
      .map((item) => item.company_id || item.company_name)
      .filter(Boolean),
  ).size;



  const modalConfig = {
    companies: {
      title: "Total Companies",
      subtitle: "All registered tenant companies.",
      icon: <Building2 size={22} />,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },
    active_companies: {
      title: "Active Companies",
      subtitle: "Companies currently active on platform.",
      icon: <Activity size={22} />,
      color:
        "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    },
    revenue: {
      title: "Platform Revenue",
      subtitle: "Subscription revenue analytics and payment records.",
      icon: <IndianRupee size={22} />,
      color:
        "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    },
  };

  const config = modalConfig[type];


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.color}`}
            >
              {config.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {config.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {config.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            Loading details...
          </div>
        ) : (
          <div className="overflow-auto">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              {type === "revenue" && (
                <ModalStatsGrid>
                  <ModalStatCard
                    title="Total Revenue"
                    value={`₹ ${totalRevenue.toFixed(2)}`}
                    icon={<IndianRupee size={18} />}
                    className="bg-purple-50 text-purple-700"
                  />
                  <ModalStatCard
                    title="This Month"
                    value={`₹ ${thisMonthRevenue.toFixed(2)}`}
                    icon={<CalendarDays size={18} />}
                    className="bg-blue-50 text-blue-700"
                  />
                  <ModalStatCard
                    title="Payments"
                    value={filteredPayments.length}
                    icon={<CreditCard size={18} />}
                    className="bg-cyan-50 text-cyan-700"
                  />
                  <ModalStatCard
                    title="Successful"
                    value={successfulPayments.length}
                    icon={<CheckCircle2 size={18} />}
                    className="bg-green-50 text-green-700"
                  />
                  <ModalStatCard
                    title="Failed"
                    value={failedPayments.length}
                    icon={<XCircle size={18} />}
                    className="bg-red-50 text-red-700"
                  />
                  <ModalStatCard
                    title="Subscribers"
                    value={activeSubscribers}
                    icon={<Building2 size={18} />}
                    className="bg-orange-50 text-orange-700"
                  />
                </ModalStatsGrid>
              )}
              {(type === "companies" || type === "active_companies") && (
                <ModalStatsGrid>
                  <ModalStatCard
                    title="Total Companies"
                    value={safeCompanies.length}
                    icon={<Building2 size={18} />}
                    className="bg-blue-50 text-blue-700"
                  />
                  <ModalStatCard
                    title="Active Companies"
                    value={activeCompanies.length}
                    icon={<CheckCircle2 size={18} />}
                    className="bg-green-50 text-green-700"
                  />
                  <ModalStatCard
                    title="Inactive Companies"
                    value={inactiveCompanies.length}
                    icon={<XCircle size={18} />}
                    className="bg-red-50 text-red-700"
                  />
                  <ModalStatCard
                    title="Showing Records"
                    value={companyRows.length}
                    icon={<Activity size={18} />}
                    className="bg-orange-50 text-orange-700"
                  />
                </ModalStatsGrid>
              )}
            </div>
            <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inside details..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-950"
                />
              </div>
            </div>
            <div className="space-y-5 p-5">
              {(type === "companies" || type === "active_companies") && (
                <>
                  <SectionTitle
                    title={
                      type === "active_companies"
                        ? "Active Company List"
                        : "Company List"
                    }
                    subtitle="Search and view tenant company details."
                  />
                  <CompaniesTable
                    companies={filteredCompanies}
                    onCompanyClick={onCompanyClick}
                  />
                </>
              )}
              {type === "revenue" && (
                <>
                  <SectionTitle
                    title="Revenue Source / Subscription Payments"
                    subtitle="Payment-wise revenue records across companies."
                  />
                  <RevenueTable payments={filteredPayments} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function CompanyDetailsModal({ company, details, loading, onClose }) {
  const dataCompany = details?.company || company || {};
  const admin = details?.admin || null;
  const subscription = details?.subscription || null;
  const subscriptionHistory = details?.subscriptionHistory || [];
  const branches = details?.branches || {};
  const users = details?.users || {};
  const invoices = details?.invoices || {};
  const revenue = details?.revenue || {};
  const companyName = dataCompany.name || dataCompany.company_name || "-";
  const [drilldownType, setDrilldownType] = useState(null);
  const branchList = details?.lists?.branches || [];
  const userList = details?.lists?.users || [];
  const invoiceList = details?.lists?.invoices || [];
  const paymentList = details?.lists?.payments || [];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 sm:p-5">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 sm:text-sm">
              <Building2 size={15} />
              Tenant Overview
            </div>
            <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
              Company Details
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Billing, users, branches and revenue overview.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close company details"
            className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-20 text-slate-500 dark:text-slate-400">
            <Loader2 size={22} className="animate-spin" />
            Loading company details...
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm sm:h-16 sm:w-16">
                  <Building2 size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="max-w-full truncate text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
                      {companyName}
                    </h3>
                    <StatusBadge status={dataCompany.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {dataCompany.address || "Company address is not available."}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <CompactDetail
                      label="Company ID"
                      value={`#${dataCompany.id || "-"}`}
                    />
                    <CompactDetail
                      label="Email"
                      value={dataCompany.email || "-"}
                    />
                    <CompactDetail
                      label="Phone"
                      value={dataCompany.phone || "-"}
                    />
                    <CompactDetail
                      label="Website"
                      value={dataCompany.website || "-"}
                    />
                    <CompactDetail
                      label="GST"
                      value={dataCompany.gst_number || "-"}
                    />
                    <CompactDetail
                      label="PAN"
                      value={dataCompany.pan_number || "-"}
                    />
                    <CompactDetail
                      label="Currency"
                      value={dataCompany.currency || "INR"}
                    />
                    <CompactDetail
                      label="Created"
                      value={formatDate(dataCompany.created_at)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <InfoCard title="Company Admin" icon={<Users size={18} />}>
                <InfoRow label="Name" value={admin?.name || "N/A"} />
                <InfoRow label="Email" value={admin?.email || "N/A"} />
                <InfoRow label="Status" value={admin?.status || "N/A"} />
                <InfoRow
                  label="Last Login"
                  value={formatDate(admin?.last_login_at)}
                />
              </InfoCard>
              <InfoCard title="Subscription" icon={<CreditCard size={18} />}>
                <InfoRow
                  label="Plan"
                  value={subscription?.plan_name || "N/A"}
                />
                <InfoRow
                  label="Price"
                  value={
                    subscription?.price
                      ? `₹ ${Number(subscription.price).toFixed(2)}`
                      : "N/A"
                  }
                />
                <InfoRow
                  label="Cycle"
                  value={subscription?.billing_cycle || "N/A"}
                />
                <InfoRow label="Status" value={subscription?.status || "N/A"} />
                <InfoRow
                  label="Renewal Date"
                  value={formatDate(subscription?.renewal_date)}
                />
                <InfoRow
                  label="Trial Ends"
                  value={formatDate(subscription?.trial_end_date)}
                />
              </InfoCard>
              <button
                type="button"
                onClick={() => setDrilldownType("branches")}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                    <Building2 size={18} />
                  </span>
                  Branch Summary
                </div>
                <div className="space-y-3">
                  <InfoRow label="Total Branches" value={branches.total ?? 0} />
                  <InfoRow
                    label="Active Branches"
                    value={branches.active ?? 0}
                  />
                  <InfoRow
                    label="Inactive Branches"
                    value={branches.inactive ?? 0}
                  />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-blue-600">
                    Click to view branch list →
                  </p>
                </div>
              </button>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => setDrilldownType("users")}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                    <Users size={18} />
                  </span>
                  User Summary
                </div>
                <div className="space-y-3">
                  <InfoRow label="Total Users" value={users.total ?? 0} />
                  <InfoRow label="Accountants" value={users.accountants ?? 0} />
                  <InfoRow label="Sales Users" value={users.sales_users ?? 0} />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-blue-600">
                    Click to view users →
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDrilldownType("invoices")}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                    <Activity size={18} />
                  </span>
                  Invoice Summary
                </div>
                <div className="space-y-3">
                  <InfoRow label="Total Invoices" value={invoices.total ?? 0} />
                  <InfoRow
                    label="Invoice Value"
                    value={`₹ ${Number(
                      invoices.invoice_value || 0,
                    ).toLocaleString("en-IN")}`}
                  />
                  <InfoRow
                    label="Paid Amount"
                    value={`₹ ${Number(
                      invoices.paid_amount || 0,
                    ).toLocaleString("en-IN")}`}
                  />
                  <InfoRow
                    label="Pending Amount"
                    value={`₹ ${Number(
                      invoices.pending_amount || 0,
                    ).toLocaleString("en-IN")}`}
                  />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-emerald-600">
                    Click to view invoices →
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDrilldownType("subscriptions")}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                    <CreditCard size={18} />
                  </span>
                  Subscription History
                </div>
                <div className="space-y-3">
                  <InfoRow
                    label="Total Plans"
                    value={subscriptionHistory.length}
                  />
                  <InfoRow
                    label="Current Plan"
                    value={subscription?.plan_name || "N/A"}
                  />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-indigo-600">
                    Click to view subscription history →
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
      {drilldownType && (
        <DrilldownModal
          type={drilldownType}
          branches={branchList}
          users={userList}
          invoices={invoiceList}
          payments={paymentList}
          subscriptions={subscriptionHistory}
          onClose={() => setDrilldownType(null)}
        />
      )}
    </div>
  );
}



function CompactDetail({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}




function DrilldownModal({
  type,
  branches,
  users,
  invoices,
  payments,
  subscriptions,
  onClose,
}) {
  const config = {
    branches: {
      title: "Branch List",
      subtitle: "All branches of selected company.",
      headers: ["Branch", "Code", "Email", "Phone", "City", "Status"],
      rows: branches.map((item) => [
        item.branch_name || "-",
        item.branch_code || "-",
        item.email || "-",
        item.phone || "-",
        item.city || "-",
        item.status || "active",
      ]),
    },
    users: {
      title: "User List",
      subtitle: "Company admin, accountants and sales users.",
      headers: ["Name", "Email", "Role", "Branch", "Status", "Last Login"],
      rows: users.map((item) => [
        item.name || "-",
        item.email || "-",
        item.role || "-",
        item.branch_name || "-",
        item.status || "active",
        formatDate(item.last_login_at),
      ]),
    },
    invoices: {
      title: "Invoice List",
      subtitle: "Latest invoices generated by this company.",
      headers: ["Invoice No", "Customer", "Branch", "Total", "Paid", "Status"],
      rows: invoices.map((item) => [
        item.invoice_number || "-",
        item.customer_name || "-",
        item.branch_name || "-",
        `₹ ${Number(item.total_amount || 0).toLocaleString("en-IN")}`,
        `₹ ${Number(item.paid_amount || 0).toLocaleString("en-IN")}`,
        item.status || "-",
      ]),
    },
    payments: {
      title: "Payment History",
      subtitle: "Subscription payment history of selected company.",
      headers: ["Amount", "Status", "Method", "Transaction ID", "Payment Date"],
      rows: payments.map((item) => [
        `₹ ${Number(item.amount || 0).toLocaleString("en-IN")}`,
        item.payment_status || "-",
        item.payment_method || "-",
        item.transaction_id || "-",
        formatDate(item.payment_date || item.created_at),
      ]),
    },
    subscriptions: {
      title: "Subscription History",
      subtitle: "All plans assigned to this company.",
      headers: [
        "Plan",
        "Price",
        "Cycle",
        "Status",
        "Auto Renewal",
        "Start Date",
        "Renewal Date",
      ],
      rows: subscriptions.map((item) => [
        item.plan_name || "-",
        `₹ ${Number(item.price || 0).toLocaleString("en-IN")}`,
        item.billing_cycle || "-",
        item.status || "-",
        item.auto_renewal ? "Yes" : "No",
        formatDate(item.start_date),
        formatDate(item.renewal_date),
      ]),
    },
  };
  const current = config[type];
  const [listSearch, setListSearch] = useState("");
  const filteredRows = current.rows.filter((row) =>
    row.join(" ").toLowerCase().includes(listSearch.toLowerCase()),
  );
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 dark:border-slate-800 dark:from-slate-800 dark:to-slate-900">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {current.rows.length} Records
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {current.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {current.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder={`Search ${current.title.toLowerCase()}...`}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-10 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-blue-950/50"
                />
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  <tr>
                    {current.headers.map((header) => (
                      <TableHead key={header} title={header} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-t border-slate-100 transition hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="p-4 font-medium text-slate-700 dark:text-slate-200"
                          >
                            {current.headers[cellIndex] === "Status" ? (
                              <StatusBadge status={cell} />
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <EmptyRow
                      colSpan={current.headers.length}
                      text="No records found."
                    />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



function MiniInfo({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}



function InfoCard({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</span>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}



function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}


function ModalStatsGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}



function ModalStatCard({ title, value, icon, className }) {
  return (
    <div
      className={`min-h-[84px] rounded-xl border border-slate-200 p-4 dark:border-slate-800 ${className}`}
    >
      <div className="flex h-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <h3 className="mt-2 truncate text-lg font-semibold">{value}</h3>
        </div>
        <div className="shrink-0 rounded-xl bg-white/70 p-2.5 dark:bg-slate-900/70">
          {icon}
        </div>
      </div>
    </div>
  );
}



function CompaniesTable({ companies, onCompanyClick }) {
  return (
    <ResponsiveTable
      headers={["Company", "Email", "GST", "Currency", "Status"]}
      emptyText="No companies found."
      colSpan={5}
      rows={companies.map((company) => (
        <tr
          key={company.id}
          onClick={() => onCompanyClick?.(company)}
          className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <td className="p-4 font-semibold text-slate-900 dark:text-white">
            {company.name || company.company_name || "-"}
          </td>
          <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
            {company.email || "-"}
          </td>
          <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
            {company.gst_number || "-"}
          </td>
          <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
            {company.currency || "INR"}
          </td>
          <td className="p-4">
            <StatusBadge status={company.status} />
          </td>
        </tr>
      ))}
    />
  );
}



function RevenueTable({ payments }) {
  return (
    <ResponsiveTable
      headers={["Company", "Plan", "Amount", "Status", "Date"]}
      emptyText="No revenue records found."
      colSpan={5}
      rows={payments.map((payment) => (
        <tr
          key={payment.id}
          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <td className="p-4 font-semibold text-slate-900 dark:text-white">
            {payment.company_name || "-"}
          </td>
          <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
            {payment.plan_name || "-"}
          </td>
          <td className="p-4 font-semibold text-emerald-600 dark:text-emerald-300">
            ₹ {Number(payment.amount || payment.paid_amount || 0).toFixed(2)}
          </td>
          <td className="p-4">
            <StatusBadge status={payment.payment_status || "paid"} />
          </td>
          <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
            {formatDate(payment.payment_date || payment.created_at)}
          </td>
        </tr>
      ))}
    />
  );
}


function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}


function ResponsiveTable({ headers, rows, emptyText, colSpan }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm text-left [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
          <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            <tr>
              {headers.map((header) => (
                <TableHead key={header} title={header} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows
            ) : (
              <EmptyRow colSpan={colSpan} text={emptyText} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



function TableHead({ title }) {
  return (
    <th className="p-4 text-left text-sm font-normal text-blue-800 dark:text-blue-200">
      {title}
    </th>
  );
}



function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-10 text-center">
        <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {text}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Try another search...
          </p>
        </div>
      </td>
    </tr>
  );
}



function StatusBadge({ status }) {
  const value = String(status || "active").toLowerCase();
  const goodStatuses = ["active", "paid", "success", "completed"];
  const warningStatuses = ["trial", "pending", "generated"];
  const badStatuses = [
    "inactive",
    "expired",
    "failed",
    "cancelled",
    "rejected",
  ];
  let className =
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  if (goodStatuses.includes(value)) {
    className =
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (warningStatuses.includes(value)) {
    className =
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (badStatuses.includes(value)) {
    className =
      "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300";
  }
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold capitalize shadow-sm ${className}`}
    >
      {status || "active"}
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



export default SuperAdminDashboard;
