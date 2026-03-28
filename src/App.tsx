import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUserStore } from '@/stores/userStore'

// Layout
import DashboardLayout from '@/components/layout/DashboardLayout'

// Pages
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
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
import ContractsPage from '@/pages/ContractsPage'
import LogsPage from '@/pages/LogsPage'
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
import ModuleWorkspacePage from '@/pages/ModuleWorkspacePage'
import ConstructionDashboardPage from '@/pages/ConstructionDashboardPage'
import ConstructionMastersPage from '@/pages/ConstructionMastersPage'
import ConstructionProcurementPage from '@/pages/ConstructionProcurementPage'
import ConstructionExecutionPage from '@/pages/ConstructionExecutionPage'
import ConstructionFinancePage from '@/pages/ConstructionFinancePage'
import ConstructionDocumentsPage from '@/pages/ConstructionDocumentsPage'
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
              element={<DashboardPage />}
            />
            <Route path="construction/dashboard" element={<ConstructionDashboardPage />} />
            <Route path="construction/masters" element={<ConstructionMastersPage />} />
            <Route path="construction/procurement" element={<ConstructionProcurementPage />} />
            <Route path="construction/execution" element={<ConstructionExecutionPage />} />
            <Route path="construction/finance" element={<ConstructionFinancePage />} />
            <Route path="construction/documents" element={<ConstructionDocumentsPage />} />
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
            <Route path="crm/customers" element={<ModuleWorkspacePage title="Customers" description="Maintain customer master records, contact details, GST data, and credit terms for the CRM lifecycle." />} />
            <Route path="crm/enquiries" element={<ProjectsPage />} />
            <Route path="crm/interactions" element={<ModuleWorkspacePage title="Interaction Log" description="Capture calls, meetings, emails, and follow-up actions against each enquiry and project." />} />
            <Route path="estimation/designs" element={<ModuleWorkspacePage title="Design Versions" description="Track concept, detailed, and IFC design versions with approval status and designer ownership." />} />
            <Route path="estimation/boq-builder" element={<ModuleWorkspacePage title="BOQ Builder" description="Prepare estimation BOQs from approved design versions before the contract BOQ is locked for execution." />} />
            <Route path="estimation/quotations" element={<ModuleWorkspacePage title="Quotations" description="Manage submitted and revised quotations, validity dates, and approval-driven project conversion." />} />
            <Route path="estimation/negotiations" element={<ModuleWorkspacePage title="Negotiations" description="Track commercial discussions, agreed values, and revision impacts across quotation rounds." />} />
            <Route path="execution/active-projects" element={<ProjectsPage />} />
            <Route path="execution/boq-contract" element={<BOQPage />} />
            <Route path="execution/sap-breakup" element={<SAPBreakupPage />} />
            <Route path="execution/milestones" element={<MilestonesPage />} />
            <Route path="procurement/warehouse-planning" element={<WarehousePlanningPage />} />
            <Route path="procurement/purchase-requests" element={<PurchaseRequestsPage />} />
            <Route path="procurement/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="procurement/grn" element={<GRNPage />} />
            <Route path="execution/contracts" element={<ContractsPage />} />
            <Route path="execution/logs" element={<LogsPage />} />
            <Route path="operations/stock" element={<StockPage />} />
            <Route path="operations/transfers" element={<DCPage />} />
            <Route path="operations/installation" element={<InstallationPage />} />
            <Route path="operations/labor-asset-cost" element={<LaborCostPage />} />
            <Route path="billing/ra-bills" element={<InvoicesPage />} />
            <Route path="billing/payments" element={<PaymentsPage />} />
            <Route path="billing/change-orders" element={<ChangeOrdersPage />} />
            <Route path="boq" element={<BOQPage />} />
            <Route path="sap-breakup" element={<SAPBreakupPage />} />
            <Route path="milestones" element={<MilestonesPage />} />
            <Route path="warehouse-planning" element={<WarehousePlanningPage />} />
            <Route path="purchase-requests" element={<PurchaseRequestsPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="grn" element={<GRNPage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="logs" element={<LogsPage />} />
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
            <Route path="reports/profitability" element={<ModuleWorkspacePage title="Profitability" description="This report space is reserved for project-level margin, cash realization, and commercial health analytics." helper="Run live billing and costing cycles first, then we can connect a profitability view without carrying placeholder records." />} />
            <Route path="reports/variance" element={<VarianceReport />} />
            <Route path="reports/schedule" element={<ScheduleReport />} />
            <Route path="master/materials" element={<MaterialMasterPage />} />
            <Route path="master/vendors" element={<VendorMasterPage />} />
            <Route path="master/vendor-pricing" element={<ModuleWorkspacePage title="Vendor Pricing" description="Maintain brand-wise vendor rate cards, discounts, territories, and landed net pricing." />} />
            <Route path="master/assets" element={<ModuleWorkspacePage title="Assets" description="Register owned and hired tools or equipment, and track their current project allocation." />} />
            <Route path="master/labor-rates" element={<ModuleWorkspacePage title="Labor Rates" description="Manage skill-based labor rate cards used in estimating and execution costing." />} />
            <Route path="master/users" element={<UserManagementPage />} />
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
