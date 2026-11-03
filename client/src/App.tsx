import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AgentLayout } from '@/layouts/AgentLayout';
import { useAuth } from '@/hooks/useAuth';

import { LoginPage } from '@/pages/auth/LoginPage';
import { AgentDashboardPage } from '@/pages/agent/AgentDashboardPage';
import { MyLeadsPage } from '@/pages/agent/MyLeadsPage';
import { LeadWizardPage } from '@/pages/agent/LeadWizardPage';
import { AgentLeadDetailPage } from '@/pages/agent/AgentLeadDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Admin is a desktop-first surface that field agents never load - splitting it
// into its own chunk keeps the agent-facing mobile bundle (the bandwidth- and
// device-constrained surface) as small as possible.
const AdminLayout = lazy(() => import('@/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const LeadsTablePage = lazy(() =>
  import('@/pages/admin/LeadsTablePage').then((m) => ({ default: m.LeadsTablePage })),
);
const AdminLeadDetailPage = lazy(() =>
  import('@/pages/admin/AdminLeadDetailPage').then((m) => ({ default: m.AdminLeadDetailPage })),
);
const AgentsPage = lazy(() => import('@/pages/admin/AgentsPage').then((m) => ({ default: m.AgentsPage })));
const AuditLogPage = lazy(() =>
  import('@/pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/agent'} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute allowedRoles={['AGENT']} />}>
          <Route element={<AgentLayout />}>
            <Route path="/agent" element={<AgentDashboardPage />} />
            <Route path="/agent/leads" element={<MyLeadsPage />} />
            <Route path="/agent/leads/:id" element={<AgentLeadDetailPage />} />
          </Route>
          {/* Wizard is rendered without the tab-bar chrome so it can use full-height steps */}
          <Route path="/agent/leads/new" element={<LeadWizardPage />} />
          <Route path="/agent/leads/:id/edit" element={<LeadWizardPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/leads" element={<LeadsTablePage />} />
            <Route path="/admin/leads/:id" element={<AdminLeadDetailPage />} />
            <Route path="/admin/agents" element={<AgentsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
