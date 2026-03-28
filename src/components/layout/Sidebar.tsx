import { NavLink, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, FolderOpen, ListChecks, ShoppingCart, Package,
    Truck, Activity, FileText, BarChart3, Bell,
    Users, Warehouse, Construction, LogOut, ChevronDown, ChevronRight,
    ClipboardList, DollarSign, Building2
} from 'lucide-react'
import { useState } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useAlertStore } from '@/stores/alertStore'
import { cn } from '@/lib/utils'

type NavGroup = {
    label: string
    items: NavItem[]
}
type NavItem = {
    to: string
    icon: React.ElementType
    label: string
}

const navGroups: NavGroup[] = [
    {
        label: 'Overview',
        items: [
            { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        ],
    },
    {
        label: 'Construction ERP',
        items: [
            { to: '/construction/dashboard', icon: LayoutDashboard, label: 'ERP Dashboard' },
            { to: '/construction/masters', icon: Building2, label: 'Masters' },
            { to: '/construction/procurement', icon: ShoppingCart, label: 'Procurement' },
            { to: '/construction/execution', icon: Construction, label: 'Execution' },
            { to: '/construction/finance', icon: DollarSign, label: 'Finance' },
            { to: '/construction/documents', icon: FileText, label: 'Documents' },
        ],
    },
    {
        label: 'CRM & Pre-Sales',
        items: [
            { to: '/crm/customers', icon: Users, label: 'Customers' },
            { to: '/crm/enquiries', icon: FolderOpen, label: 'Enquiries' },
            { to: '/crm/interactions', icon: FileText, label: 'Interaction Log' },
        ],
    },
    {
        label: 'Estimation & Design',
        items: [
            { to: '/estimation/designs', icon: ClipboardList, label: 'Design Versions' },
            { to: '/estimation/boq-builder', icon: ListChecks, label: 'BOQ Builder' },
            { to: '/estimation/quotations', icon: FileText, label: 'Quotations' },
            { to: '/estimation/negotiations', icon: DollarSign, label: 'Negotiations' },
        ],
    },
    {
        label: 'Project Setup (Execution)',
        items: [
            { to: '/execution/active-projects', icon: FolderOpen, label: 'Active Projects' },
            { to: '/execution/boq-contract', icon: ListChecks, label: 'BOQ Contract' },
            { to: '/execution/sap-breakup', icon: ClipboardList, label: 'SAP Breakup' },
            { to: '/execution/milestones', icon: Activity, label: 'Milestones' },
            { to: '/execution/contracts', icon: Building2, label: 'Vendor Contracts' },
            { to: '/execution/logs', icon: ClipboardList, label: 'Daily Logs' },
        ],
    },
    {
        label: 'Procurement',
        items: [
            { to: '/procurement/warehouse-planning', icon: Warehouse, label: 'WH Planning' },
            { to: '/procurement/purchase-requests', icon: ShoppingCart, label: 'Purchase Requests' },
            { to: '/procurement/purchase-orders', icon: Package, label: 'Purchase Orders' },
            { to: '/procurement/grn', icon: Truck, label: 'GRN' },
        ],
    },
    {
        label: 'Site Operations',
        items: [
            { to: '/operations/stock', icon: Warehouse, label: 'Stock View' },
            { to: '/operations/transfers', icon: Truck, label: 'DC / Inter-Site Transfers' },
            { to: '/operations/installation', icon: Construction, label: 'Installation' },
            { to: '/operations/labor-asset-cost', icon: Users, label: 'Labor / Asset Cost' },
        ],
    },
    {
        label: 'Billing',
        items: [
            { to: '/billing/ra-bills', icon: FileText, label: 'RA Bills / Invoices' },
            { to: '/billing/payments', icon: DollarSign, label: 'Payments' },
            { to: '/billing/change-orders', icon: ClipboardList, label: 'Change Orders' },
        ],
    },
    {
        label: 'Reports',
        items: [
            { to: '/reports/boq-tracker', icon: BarChart3, label: 'BOQ Tracker' },
            { to: '/reports/budget-actual', icon: BarChart3, label: 'Budget vs Actual' },
            { to: '/reports/profitability', icon: BarChart3, label: 'Profitability' },
        ],
    },
    {
        label: 'Master Data',
        items: [
            { to: '/master/materials', icon: Package, label: 'Materials' },
            { to: '/master/vendors', icon: Building2, label: 'Vendors' },
            { to: '/master/vendor-pricing', icon: DollarSign, label: 'Vendor Pricing' },
            { to: '/master/assets', icon: Construction, label: 'Assets' },
            { to: '/master/labor-rates', icon: Users, label: 'Labor Rates' },
            { to: '/master/users', icon: Users, label: 'Users' },
        ],
    },
]

export default function Sidebar() {
    const { signOut, user } = useUserStore()
    const { unreadCount } = useAlertStore()
    const navigate = useNavigate()
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

    const toggleGroup = (label: string) => {
        setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
    }

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <aside className="flex flex-col h-screen w-64 shrink-0" style={{ background: 'var(--color-surface-800)', borderRight: '1px solid rgba(51,65,85,0.5)' }}>
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))' }}>
                    <Construction size={18} className="text-white" />
                </div>
                <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--color-surface-50)' }}>IrrigTrack</p>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>CRM and Execution ERP</p>
                </div>
            </div>

            {/* Nav scroll */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {navGroups.map((group) => (
                    <div key={group.label} className="mb-2">
                        <button
                            onClick={() => toggleGroup(group.label)}
                            className="flex items-center justify-between w-full px-2 py-1.5 mb-1 rounded text-xs font-semibold uppercase tracking-wider cursor-pointer"
                            style={{ color: 'var(--color-surface-400)' }}
                        >
                            {group.label}
                            {collapsed[group.label] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {!collapsed[group.label] && (
                            <div className="space-y-0.5">
                                {group.items.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}
                                    >
                                        <item.icon size={15} />
                                        <span>{item.label}</span>
                                        {item.label === 'Dashboard' && unreadCount > 0 && (
                                            <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-danger)', color: 'white' }}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Alerts Link */}
            <div className="px-3 pb-2">
                <NavLink to="/alerts" className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}>
                    <Bell size={15} />
                    <span>Alerts</span>
                    {unreadCount > 0 && (
                        <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse-glow" style={{ background: 'var(--color-danger)', color: 'white' }}>
                            {unreadCount}
                        </span>
                    )}
                </NavLink>
            </div>

            {/* User footer */}
            <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--color-brand-700)', color: 'var(--color-brand-200)' }}>
                        {user?.email?.charAt(0).toUpperCase() ?? 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-surface-100)' }}>{user?.email ?? 'User'}</p>
                        <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Administrator</p>
                    </div>
                </div>
                <button onClick={handleSignOut} className="nav-item w-full" style={{ color: '#f87171' }}>
                    <LogOut size={15} />
                    Sign Out
                </button>
            </div>
        </aside>
    )
}
