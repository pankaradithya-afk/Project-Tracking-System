import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUserStore } from '@/stores/userStore'

// Layout
import DashboardLayout from '@/components/layout/DashboardLayout'

// Pages
import LoginPage from '@/pages/LoginPage'
const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const ProjectCreatePage = lazy(() => import('@/pages/ProjectCreatePage'))
const ProjectDetailsPage = lazy(() => import('@/pages/ProjectDetailsPage'))
const TaskCreatePage = lazy(() => import('@/pages/TaskCreatePage'))
import ProjectsPage from '@/pages/ProjectsPage'
import BOQPage from '@/pages/BOQPage'
import SAPBreakupPage from '@/pages/SAPBreakupPage'
import WarehousePlanningPage from '@/pages/WarehousePlanningPage'
import PurchaseRequestsPage from '@/pages/PurchaseRequestsPage'
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage'
import GRNPage from '@/pages/GRNPage'
import StockPage from '@/pages/StockPage'
import DCPage from '@/pages/DCPage'
import InstallationPage from '@/pages/InstallationPage'
import LaborCostPage from '@/pages/LaborCostPage'
import InvoicesPage from '@/pages/InvoicesPage'
import PaymentsPage from '@/pages/PaymentsPage'
import ChangeOrdersPage from '@/pages/ChangeOrdersPage'
import AlertsPage from '@/pages/AlertsPage'
import DocumentsPage from '@/pages/DocumentsPage'
import MilestonesPage from '@/pages/MilestonesPage'
import MaterialMasterPage from '@/pages/admin/MaterialMasterPage'
import VendorMasterPage from '@/pages/admin/VendorMasterPage'
import UserManagementPage from '@/pages/admin/UserManagementPage'
import BOQTrackerReport from '@/pages/reports/BOQTrackerReport'
import BudgetActualReport from '@/pages/reports/BudgetActualReport'
import VarianceReport from '@/pages/reports/VarianceReport'
import ScheduleReport from '@/pages/reports/ScheduleReport'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUserStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-900)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { setUser, setLoading } = useUserStore()

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <DashboardLayout />
              </AuthGuard>
            }
          >
            <Route
              index
              element={
                <Navigate to="/dashboard" replace />
              }
            />
            <Route
              path="dashboard"
              element={
                <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading dashboard...</div>}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="projects"
              element={<ProjectsPage />}
            />
            <Route
              path="projects/new"
              element={
                <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading form...</div>}>
                  <ProjectCreatePage />
                </Suspense>
              }
            />
            <Route
              path="projects/:id"
              element={
                <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading project...</div>}>
                  <ProjectDetailsPage />
                </Suspense>
              }
            />
            <Route
              path="projects/:id/tasks/new"
              element={
                <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading task form...</div>}>
                  <TaskCreatePage />
                </Suspense>
              }
            />
            <Route path="boq" element={<BOQPage />} />
            <Route path="sap-breakup" element={<SAPBreakupPage />} />
            <Route path="milestones" element={<MilestonesPage />} />
            <Route path="warehouse-planning" element={<WarehousePlanningPage />} />
            <Route path="purchase-requests" element={<PurchaseRequestsPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="grn" element={<GRNPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="delivery-challans" element={<DCPage />} />
            <Route path="installation" element={<InstallationPage />} />
            <Route path="labor-cost" element={<LaborCostPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="change-orders" element={<ChangeOrdersPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="reports/boq-tracker" element={<BOQTrackerReport />} />
            <Route path="reports/budget-actual" element={<BudgetActualReport />} />
            <Route path="reports/variance" element={<VarianceReport />} />
            <Route path="reports/schedule" element={<ScheduleReport />} />
            <Route path="admin/materials" element={<MaterialMasterPage />} />
            <Route path="admin/vendors" element={<VendorMasterPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
