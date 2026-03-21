import Sidebar from './Sidebar'
import Header from './Header'
import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'

const pageMeta: Record<string, { title: string; subtitle?: string }> = {
    '/dashboard': { title: 'Dashboard', subtitle: 'Real-time project KPIs and insights' },
    '/projects': { title: 'Projects', subtitle: 'Manage irrigation project records' },
    '/boq': { title: 'BOQ Contract', subtitle: 'Bill of Quantities — Contract register' },
    '/sap-breakup': { title: 'SAP Breakup', subtitle: 'SAP BOQ material-level breakup' },
    '/milestones': { title: 'Schedule Milestones', subtitle: 'Project timeline and progress tracking' },
    '/warehouse-planning': { title: 'Warehouse Planning', subtitle: 'Material availability and procurement planning' },
    '/purchase-requests': { title: 'Purchase Requests', subtitle: 'PR workflow — Draft to Approval' },
    '/purchase-orders': { title: 'Purchase Orders', subtitle: 'PO register and status tracking' },
    '/grn': { title: 'GRN Register', subtitle: 'Goods receipt and inspection log' },
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
    '/reports/variance': { title: 'Variance Report', subtitle: 'Budget deviation analysis' },
    '/reports/schedule': { title: 'Schedule Report', subtitle: 'Milestone tracking and delay analysis' },
    '/admin/materials': { title: 'Material Master', subtitle: 'Material catalogue management' },
    '/admin/vendors': { title: 'Vendor Master', subtitle: 'Vendor database management' },
    '/admin/users': { title: 'User Management', subtitle: 'System user accounts and roles' },
}

export default function DashboardLayout() {
    const location = useLocation()
    const currentPath = Object.keys(pageMeta).find((p) => location.pathname.startsWith(p)) ?? '/dashboard'
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
