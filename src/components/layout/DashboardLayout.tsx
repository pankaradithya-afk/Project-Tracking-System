import Sidebar from './Sidebar'
import Header from './Header'
import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'

const pageMeta: Record<string, { title: string; subtitle?: string }> = {
    '/dashboard': { title: 'Dashboard', subtitle: 'Real-time project KPIs and insights' },
    '/construction/dashboard': { title: 'Construction ERP Dashboard', subtitle: 'Project-wise cost, procurement, DPR, and payment control' },
    '/construction/masters': { title: 'Construction Masters', subtitle: 'Clients, cost codes, items, users, and budget masters' },
    '/construction/procurement': { title: 'Construction Procurement', subtitle: 'Sales order to PR, PO, GRN, and inventory-linked procurement flow' },
    '/construction/execution': { title: 'Construction Execution', subtitle: 'DPR, contracts, machinery logs, and fuel tracking' },
    '/construction/finance': { title: 'Construction Finance', subtitle: 'Expenses, invoice validation, payments, and RA bills' },
    '/construction/documents': { title: 'Construction Documents', subtitle: 'Module-linked documents stored in Supabase Storage' },
    '/projects': { title: 'Projects', subtitle: 'Manage irrigation project records' },
    '/projects/new': { title: 'Create Project', subtitle: 'Add a new project to the tracker' },
    '/projects/:id': { title: 'Project Details', subtitle: 'Track tasks, progress, and team activity' },
    '/projects/:id/tasks/new': { title: 'Create Task', subtitle: 'Add a new task to this project' },
    '/crm/customers': { title: 'Customers', subtitle: 'Client, consultant, and account master records' },
    '/crm/enquiries': { title: 'Enquiries', subtitle: 'Pre-sales opportunities moving through the lifecycle' },
    '/crm/interactions': { title: 'Interaction Log', subtitle: 'Follow-ups, meetings, emails, and actions' },
    '/estimation/designs': { title: 'Design Versions', subtitle: 'Concept, detailed, and IFC design control' },
    '/estimation/boq-builder': { title: 'BOQ Builder', subtitle: 'Estimation BOQ preparation before contract lock-in' },
    '/estimation/quotations': { title: 'Quotations', subtitle: 'Commercial submissions, revisions, and approvals' },
    '/estimation/negotiations': { title: 'Negotiations', subtitle: 'Commercial discussions and agreed values' },
    '/execution/active-projects': { title: 'Active Projects', subtitle: 'Projects set up for execution control' },
    '/execution/boq-contract': { title: 'BOQ Contract', subtitle: 'Execution BOQ locked from approved quotations' },
    '/execution/sap-breakup': { title: 'SAP Breakup', subtitle: 'Execution material breakup and planning keys' },
    '/execution/milestones': { title: 'Milestones', subtitle: 'Execution schedule and delivery checkpoints' },
    '/execution/contracts': { title: 'Vendor Contracts', subtitle: 'Machinery, fuel, and service contracts with project cost code linkage' },
    '/execution/logs': { title: 'Daily Logs', subtitle: 'DPR, machinery usage, and fuel logs used for invoice validation' },
    '/procurement/warehouse-planning': { title: 'Warehouse Planning', subtitle: 'Material availability and procurement planning' },
    '/procurement/purchase-requests': { title: 'Purchase Requests', subtitle: 'PR workflow from requirement to approval' },
    '/procurement/purchase-orders': { title: 'Purchase Orders', subtitle: 'PO register and delivery commitments' },
    '/procurement/grn': { title: 'GRN', subtitle: 'Receipt, inspection, and inward stock confirmation' },
    '/operations/stock': { title: 'Stock View', subtitle: 'Live site and warehouse stock visibility' },
    '/operations/transfers': { title: 'DC / Inter-Site Transfers', subtitle: 'Cross-project material and equipment movement' },
    '/operations/installation': { title: 'Installation', subtitle: 'Executed quantity logging at site level' },
    '/operations/labor-asset-cost': { title: 'Labor / Asset Cost', subtitle: 'Daily resource and equipment cost capture' },
    '/billing/ra-bills': { title: 'RA Bills / Invoices', subtitle: 'Running bills, invoices, and billing progress' },
    '/billing/payments': { title: 'Payments', subtitle: 'Collections and payment follow-up tracking' },
    '/billing/change-orders': { title: 'Change Orders', subtitle: 'Commercial variations and approved scope changes' },
    '/boq': { title: 'BOQ Contract', subtitle: 'Bill of Quantities — Contract register' },
    '/sap-breakup': { title: 'SAP Breakup', subtitle: 'SAP BOQ material-level breakup' },
    '/milestones': { title: 'Schedule Milestones', subtitle: 'Project timeline and progress tracking' },
    '/warehouse-planning': { title: 'Warehouse Planning', subtitle: 'Material availability and procurement planning' },
    '/purchase-requests': { title: 'Purchase Requests', subtitle: 'PR workflow — Draft to Approval' },
    '/purchase-orders': { title: 'Purchase Orders', subtitle: 'PO register and status tracking' },
    '/grn': { title: 'GRN Register', subtitle: 'Goods receipt and inspection log' },
    '/contracts': { title: 'Vendor Contracts', subtitle: 'Vendor contract register for machinery, fuel, and services' },
    '/logs': { title: 'Daily Logs', subtitle: 'Project DPR and contract-linked daily logs' },
    '/stock': { title: 'Warehouse Stock', subtitle: 'Real-time inventory levels by location' },
    '/delivery-challans': { title: 'Delivery Challans', subtitle: 'Site material transfer transactions' },
    '/installation': { title: 'Installation Execution', subtitle: 'Executed quantity log against contract' },
    '/labor-cost': { title: 'Labor & Equipment Cost', subtitle: 'Resource cost entries' },
    '/invoices': { title: 'Invoice Register', subtitle: 'Material and service invoice tracking' },
    '/payments': { title: 'Payment Tracker', subtitle: 'Payment records against invoices' },
    '/change-orders': { title: 'Change Orders', subtitle: 'Contract variation management' },
    '/alerts': { title: 'Alert Center', subtitle: 'System-generated notifications and warnings' },
    '/documents': { title: 'Document Register', subtitle: 'Drawings, certificates, and project documents' },
    '/reports/boq-tracker': { title: 'BOQ Tracker Report', subtitle: 'End-to-end quantity chain status' },
    '/reports/budget-actual': { title: 'Budget vs Actual', subtitle: 'Cost performance report' },
    '/reports/profitability': { title: 'Profitability', subtitle: 'Project margin and commercial health workspace' },
    '/reports/variance': { title: 'Variance Report', subtitle: 'Budget deviation analysis' },
    '/reports/schedule': { title: 'Schedule Report', subtitle: 'Milestone tracking and delay analysis' },
    '/master/materials': { title: 'Materials', subtitle: 'ERP material master and costing base' },
    '/master/vendors': { title: 'Vendors', subtitle: 'Supplier and channel partner records' },
    '/master/vendor-pricing': { title: 'Vendor Pricing', subtitle: 'Brand and territory-based rate cards' },
    '/master/assets': { title: 'Assets', subtitle: 'Equipment and tool deployment register' },
    '/master/labor-rates': { title: 'Labor Rates', subtitle: 'Skill-based labor rate card management' },
    '/master/users': { title: 'Users', subtitle: 'System user accounts and roles' },
    '/admin/materials': { title: 'Material Master', subtitle: 'Material catalogue management' },
    '/admin/vendors': { title: 'Vendor Master', subtitle: 'Vendor database management' },
    '/admin/users': { title: 'User Management', subtitle: 'System user accounts and roles' },
}

export default function DashboardLayout() {
    const location = useLocation()
    const isTaskCreateRoute = location.pathname.startsWith('/projects/') && location.pathname.endsWith('/tasks/new')
    const isProjectCreateRoute = location.pathname === '/projects/new'
    const isProjectDetailRoute = location.pathname.startsWith('/projects/') && !isTaskCreateRoute && location.pathname !== '/projects/new'
    const currentPath =
        isTaskCreateRoute
            ? '/projects/:id/tasks/new'
            : isProjectCreateRoute
                ? '/projects/new'
            : isProjectDetailRoute
                ? '/projects/:id'
                : Object.keys(pageMeta).find((p) => location.pathname.startsWith(p)) ?? '/dashboard'
    const meta = pageMeta[currentPath] ?? { title: 'IrrigTrack', subtitle: '' }

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-surface-900)' }}>
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Header title={meta.title} subtitle={meta.subtitle} />
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
