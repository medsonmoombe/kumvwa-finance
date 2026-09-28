import type { ReactNode } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { Shell } from './components/layout';
import { CenteredSpinner } from './components/ui';
import { useAuth } from './lib/auth';
import { AdminQueuePage } from './features/admin/AdminQueuePage';
import { AdminOverviewPage } from './features/admin/AdminOverviewPage';
import { AdminClientsPage } from './features/admin/AdminClientsPage';
import { AdminTenantDetailPage } from './features/admin/AdminTenantDetailPage';
import { AuthPage } from './features/auth/AuthPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { PendingPage } from './features/auth/PendingPage';
import { ClientsPage } from './features/clients/ClientsPage';
import { ClientDetailPage } from './features/clients/ClientDetailPage';
import { InvitesPage } from './features/clients/InvitesPage';
import { InviteDetailPage } from './features/clients/InviteDetailPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LoanDetailPage } from './features/loans/LoanDetailPage';
import { LoansPage } from './features/loans/LoansPage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { ProductsPage } from './features/products/ProductsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { RequestReviewPage } from './features/requests/RequestReviewPage';
import { RequestsPage } from './features/requests/RequestsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { StaffPage } from './features/staff/StaffPage';

/** Sends each role to the landing screen it actually has. */
function Home() {
  const { user } = useAuth();
  if (user?.role === 'platform_admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'client') return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}

/** Pending tenants may only reach the verification screen. */
function RequireTenant({ children }: { children: ReactNode }) {
  const { user, tenant } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'platform_admin') return <Navigate to="/admin" replace />;
  if (tenant && tenant.status !== 'active') {
    return <Navigate to="/verify" replace />;
  }
  return <>{children}</>;
}

function Guard({ children }: { children: ReactNode }) {
  return (
    <RequireTenant>
      <>{children}</>
    </RequireTenant>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <CenteredSpinner />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Home /> : <AuthPage />} />
        <Route path="/register" element={user ? <Home /> : <RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          element={user ? <Shell /> : <Navigate to="/login" replace />}
        >
          <Route
            path="/dashboard"
            element={
              <Guard>
                <DashboardPage />
              </Guard>
            }
          />
          <Route
            path="/clients"
            element={
              <Guard>
                <ClientsPage />
              </Guard>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <Guard>
                <ClientDetailPage />
              </Guard>
            }
          />
          <Route path="/invites" element={<Guard><InvitesPage /></Guard>} />
          <Route path="/invites/:id" element={<Guard><InviteDetailPage /></Guard>} />
          <Route path="/notifications" element={<Guard><NotificationsPage /></Guard>} />
          <Route
            path="/requests"
            element={
              <Guard>
                <RequestsPage />
              </Guard>
            }
          />
          <Route
            path="/requests/:id"
            element={
              <Guard>
                <RequestReviewPage />
              </Guard>
            }
          />
          <Route
            path="/loans"
            element={
              <Guard>
                <LoansPage />
              </Guard>
            }
          />
          <Route
            path="/loans/:id"
            element={
              <Guard>
                <LoanDetailPage />
              </Guard>
            }
          />
          <Route
            path="/reports"
            element={
              <Guard>
                <ReportsPage />
              </Guard>
            }
          />
          <Route
            path="/products"
            element={
              <Guard>
                <ProductsPage />
              </Guard>
            }
          />
          <Route
            path="/products/new"
            element={
              <Guard>
                <ProductFormPage />
              </Guard>
            }
          />
          <Route
            path="/products/:id"
            element={
              <Guard>
                <ProductFormPage />
              </Guard>
            }
          />
          <Route
            path="/staff"
            element={
              <Guard>
                <StaffPage />
              </Guard>
            }
          />
          <Route
            path="/settings"
            element={
              <Guard>
                <SettingsPage />
              </Guard>
            }
          />
          <Route path="/verify" element={<PendingPage />} />
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="/admin/queue" element={<AdminQueuePage />} />
          <Route path="/admin/tenants/:id" element={<AdminTenantDetailPage />} />
          <Route path="/admin/borrowers" element={<AdminClientsPage />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </Router>
  );
}
