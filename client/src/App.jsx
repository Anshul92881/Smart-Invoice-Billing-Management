import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import api from "./services/api";
import { Toaster } from "react-hot-toast";

import Login from "./pages/Login";
import RegisterCompany from "./pages/RegisterCompany";
import KycVerification from "./pages/KycVerification";
import ResetPassword from "./pages/ResetPassword";

import DashboardLayout from "./layouts/DashboardLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import PrivateRoute from "./routes/PrivateRoute";

import Dashboard from "./pages/Dashboard";
import Company from "./pages/Company";
import Admin from "./pages/Admin";
import Taxes from "./pages/Taxes";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Subscriptions from "./pages/Subscription";
import Profile from "./pages/Profile";
import Accountants from "./pages/Accountants";
import Quotations from "./pages/Quotations";
import CreateQuotation from "./pages/CreateQuotation";
import ViewQuotation from "./pages/ViewQuotation";
import ViewInvoice from "./pages/ViewInvoice";
import SalesUsers from "./pages/SalesUsers";
import CompanySettings from "./pages/CompanySettings";
import BillingTemplate from "./pages/BillingTemplate";
import Vendors from "./pages/Vendors";
import BillingSubscription from "./pages/BillingSubscription";
import AuditLogs from "./pages/AuditLogs";
import Branches from "./pages/Branches";
import InactiveCompanies from "./pages/InactiveCompanies";
import Notifications from "./pages/Notifications";
import RolePermissions from "./pages/RolePermissions";
import CompanyKyc from "./pages/CompanyKyc";
import ForgotPassword from "./pages/ForgotPassword";

function App() {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const syncLoggedInUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setAuthChecked(true);
        return;
      }

      try {
        const res = await api.get("/auth/me");

        if (res.data?.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
          window.dispatchEvent(new Event("userPermissionsUpdated"));
        }
      } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        setAuthChecked(true);
      }
    };

    syncLoggedInUser();
  }, []);

  if (!authChecked) {
    return null;
  }

  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        containerStyle={{
          zIndex: 200000,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            zIndex: 200000,
          },
          error: {
            duration: 5000,
          },
        }}
      />

      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/register-company" element={<RegisterCompany />} />
        <Route
          path="/kyc-verification/:companyId"
          element={<KycVerification />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Company Admin / Accountant / Sales User Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute
              allowedRoles={["company_admin", "accountant", "sales_user"]}
            >
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route
            path="company"
            element={
              <PrivateRoute allowedRoles={["company_admin"]}>
                <Company />
              </PrivateRoute>
            }
          />

          <Route
            path="role-permissions"
            element={
              <PrivateRoute allowedRoles={["company_admin"]}>
                <RolePermissions />
              </PrivateRoute>
            }
          />

          <Route
            path="branches"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="branches"
              >
                <Branches />
              </PrivateRoute>
            }
          />

          <Route
            path="accountants"
            element={
              <PrivateRoute allowedRoles={["company_admin"]}>
                <Accountants />
              </PrivateRoute>
            }
          />

          <Route
            path="sales-users"
            element={
              <PrivateRoute allowedRoles={["company_admin"]}>
                <SalesUsers />
              </PrivateRoute>
            }
          />

          <Route
            path="company-settings"
            element={
              <PrivateRoute allowedRoles={["company_admin"]}>
                <CompanySettings />
              </PrivateRoute>
            }
          />

          <Route
            path="billing-template"
            element={
              <PrivateRoute allowedRoles={["company_admin"]}>
                <BillingTemplate />
              </PrivateRoute>
            }
          />

          <Route
            path="customers"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "sales_user", "accountant"]}
              >
                <Customers />
              </PrivateRoute>
            }
          />

          <Route
            path="products"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
              >
                <Products />
              </PrivateRoute>
            }
          />

          <Route
            path="invoices"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
              >
                <Invoices />
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard/invoices/:id"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
              >
                <ViewInvoice />
              </PrivateRoute>
            }
          />

          <Route
            path="expenses"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="expenses"
              >
                <Expenses />
              </PrivateRoute>
            }
          />

          <Route
            path="taxes"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="taxes"
              >
                <Taxes />
              </PrivateRoute>
            }
          />

          <Route
            path="vendors"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="vendors"
              >
                <Vendors />
              </PrivateRoute>
            }
          />

          <Route
            path="payments"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="payments"
              >
                <Payments />
              </PrivateRoute>
            }
          />

          <Route
            path="billing"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="billing"
              >
                <BillingSubscription />
              </PrivateRoute>
            }
          />

          <Route
            path="reports"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="reports"
              >
                <Reports />
              </PrivateRoute>
            }
          />

          <Route
            path="quotations"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="quotations"
              >
                <Quotations />
              </PrivateRoute>
            }
          />

          <Route
            path="quotations/create"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="quotations"
              >
                <CreateQuotation />
              </PrivateRoute>
            }
          />

          <Route
            path="quotations/:id/edit"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="quotations"
              >
                <CreateQuotation />
              </PrivateRoute>
            }
          />

          <Route
            path="quotations/:id"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="quotations"
              >
                <ViewQuotation />
              </PrivateRoute>
            }
          />

          <Route
            path="audit-logs"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
                requiredPermission="audit_logs"
              >
                <AuditLogs />
              </PrivateRoute>
            }
          />

          <Route
            path="notifications"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
              >
                <Notifications />
              </PrivateRoute>
            }
          />

          <Route
            path="profile"
            element={
              <PrivateRoute
                allowedRoles={["company_admin", "accountant", "sales_user"]}
              >
                <Profile />
              </PrivateRoute>
            }
          />
        </Route>

        {/* Super Admin Routes */}
        <Route
          path="/superadmin"
          element={
            <PrivateRoute allowedRoles={["superadmin"]}>
              <SuperAdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="companies" element={<Company />} />
          <Route path="admins" element={<Admin />} />
          <Route path="company-kyc" element={<CompanyKyc />} />
          <Route path="kyc/:companyId/manual" element={<KycVerification />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="inactive-companies" element={<InactiveCompanies />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
