import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useProjectStore } from '@/stores/projectStore'
import { useAlertStore } from '@/stores/alertStore'
import { KpiCard } from '@/components/common/KpiCard'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import {
    DollarSign, TrendingUp, AlertTriangle, Package, Activity,
    Bell, CheckCircle
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'

const TEAL = 'var(--color-brand-500)'
const BLUE = '#3b82f6'
const GREEN = '#10b981'
const AMBER = '#f59e0b'
const RED = '#ef4444'

type BudgetChartDatum = {
    name: string
    budget: number
    actual: number
}

type AlertChartDatum = {
    name: string
    value: number
}

type RecentAlert = {
    id: string
    message: string
    severity: string
    category: string
    created_at: string
    resolved: boolean
}

type RecentMilestone = {
    milestone_name: string
    completion_percent: number
    status: string
    planned_finish: string
}

export default function DashboardPage() {
    const { activeProject } = useProjectStore()
    const { setAlerts } = useAlertStore()

    const [kpis, setKpis] = useState({
        contractValue: 0,
        revenueCertified: 0,
        revenueCollected: 0,
        actualCost: 0,
        grossMargin: 0,
        marginPercent: 0,
        billableGap: 0,
        procurementGap: 0,
        pendingAlerts: 0,
        criticalAlerts: 0,
    })
    const [budgetChartData, setBudgetChartData] = useState<BudgetChartDatum[]>([])
    const [alertData, setAlertData] = useState<AlertChartDatum[]>([])
    const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([])
    const [recentMilestones, setRecentMilestones] = useState<RecentMilestone[]>([])
    const [loading, setLoading] = useState(true)
    const dashboardLoading = activeProject ? loading : false

    useEffect(() => {
        if (!activeProject) return

        const fetchDashboardData = async () => {
            setLoading(true)

            const { data: invoiceRows } = await supabase
                .from('invoice_register')
                .select('invoice_no, total_invoice, status')
                .eq('project_id', activeProject.id)

            const invoiceNos = (invoiceRows ?? []).map((invoice) => invoice.invoice_no)
            const paymentQuery = invoiceNos.length > 0
                ? supabase.from('payment_tracker').select('payment_amount, invoice_ref').in('invoice_ref', invoiceNos)
                : Promise.resolve({ data: [] as { payment_amount: number | null; invoice_ref: string | null }[] })

            const [
                { data: boqRows },
                { data: paymentRows },
                { data: poRows },
                { data: alertRows },
                { data: milestoneRows },
                { data: budgetRows },
                { data: actualRows },
            ] = await Promise.all([
                supabase.from('boq_contract').select('contract_value').eq('project_id', activeProject.id),
                paymentQuery,
                supabase.from('purchase_order').select('total_po_value').eq('project_id', activeProject.id),
                supabase.from('alert_log').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false }).limit(20),
                supabase.from('schedule_milestones').select('milestone_name, completion_percent, status, planned_finish').eq('project_id', activeProject.id).limit(8),
                supabase.from('budget').select('cost_category, budget_value').eq('project_id', activeProject.id),
                supabase.from('actual_cost').select('cost_category:cost_type, amount').eq('project_id', activeProject.id),
            ])

            const contractValue = (boqRows ?? []).reduce((sum, row) => sum + (row.contract_value ?? 0), 0)
            const revenueCertified = (invoiceRows ?? []).filter(row => ['Certified', 'Paid'].includes(row.status)).reduce((sum, row) => sum + (row.total_invoice ?? 0), 0)
            const revenueCollected = (paymentRows ?? []).reduce((sum, row) => sum + (row.payment_amount ?? 0), 0)
            const actualCost = (poRows ?? []).reduce((sum, row) => sum + (row.total_po_value ?? 0), 0)
            const grossMargin = revenueCertified - actualCost
            const marginPercent = revenueCertified > 0 ? (grossMargin / revenueCertified) * 100 : 0
            const billableGap = revenueCertified - revenueCollected
            const pendingAlerts = (alertRows ?? []).filter(alert => !alert.resolved).length
            const criticalAlerts = (alertRows ?? []).filter(alert => !alert.resolved && alert.severity === 'High').length

            setKpis({ contractValue, revenueCertified, revenueCollected, actualCost, grossMargin, marginPercent, billableGap, procurementGap: 0, pendingAlerts, criticalAlerts })
            setRecentAlerts((alertRows ?? []).filter(alert => !alert.resolved).slice(0, 5))
            setRecentMilestones(milestoneRows ?? [])
            setAlerts(alertRows ?? [])

            const budgetMap: Record<string, number> = {}
            ; (budgetRows ?? []).forEach(row => { budgetMap[row.cost_category] = (budgetMap[row.cost_category] ?? 0) + row.budget_value })
            const actualMap: Record<string, number> = {}
            ; (actualRows ?? []).forEach(row => { actualMap[row.cost_category] = (actualMap[row.cost_category] ?? 0) + row.amount })
            const allCats = [...new Set([...Object.keys(budgetMap), ...Object.keys(actualMap)])]
            setBudgetChartData(allCats.map(category => ({ name: category, budget: budgetMap[category] ?? 0, actual: actualMap[category] ?? 0 })))

            const sevMap: Record<string, number> = { High: 0, Medium: 0, Low: 0 }
            ; (alertRows ?? []).filter(alert => !alert.resolved).forEach(alert => { sevMap[alert.severity] = (sevMap[alert.severity] ?? 0) + 1 })
            setAlertData(Object.entries(sevMap).map(([name, value]) => ({ name, value })))

            setLoading(false)
        }

        void fetchDashboardData()
    }, [activeProject, setAlerts])

    const noProject = !activeProject

    return (
        <div className="space-y-6">
            {noProject && (
                <div className="glass-card p-6 text-center" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
                    <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
                    <p className="font-semibold" style={{ color: 'var(--color-surface-50)' }}>No Active Project Selected</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-400)' }}>Go to Projects and click "Set Active" on a project to load dashboard data.</p>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <KpiCard title="Contract Value" value={kpis.contractValue} isCurrency accentColor="teal" icon={<DollarSign size={20} style={{ color: TEAL }} />} loading={dashboardLoading} />
                <KpiCard title="Revenue Certified" value={kpis.revenueCertified} isCurrency accentColor="blue" icon={<CheckCircle size={20} style={{ color: BLUE }} />} loading={dashboardLoading} />
                <KpiCard title="Amount Collected" value={kpis.revenueCollected} isCurrency accentColor="green" icon={<TrendingUp size={20} style={{ color: GREEN }} />} loading={dashboardLoading} />
                <KpiCard title="Actual Cost (PO)" value={kpis.actualCost} isCurrency accentColor="amber" icon={<Package size={20} style={{ color: AMBER }} />} loading={dashboardLoading} />
                <KpiCard title="Gross Margin" value={kpis.grossMargin} isCurrency accentColor={kpis.grossMargin >= 0 ? 'green' : 'red'} icon={<Activity size={20} style={{ color: GREEN }} />} loading={dashboardLoading} trendLabel={`${kpis.marginPercent.toFixed(1)}%`} trend={kpis.grossMargin} />
                <KpiCard title="Pending Alerts" value={kpis.pendingAlerts} unit={` (${kpis.criticalAlerts} critical)`} accentColor="red" icon={<Bell size={20} style={{ color: RED }} />} loading={dashboardLoading} trend={-kpis.criticalAlerts} trendLabel={`${kpis.criticalAlerts} High`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="glass-card p-5 lg:col-span-2">
                    <p className="section-title mb-4">Budget vs Actual Cost</p>
                    {budgetChartData.length === 0 && !dashboardLoading ? (
                        <p className="text-sm text-center py-8" style={{ color: 'var(--color-surface-400)' }}>No budget data available yet.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={budgetChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '8px', color: '#e2e8f0' }}
                                    formatter={(value) => formatCurrency(typeof value === 'number' ? value : 0)}
                                />
                                <Bar dataKey="budget" fill={TEAL} radius={[4, 4, 0, 0]} name="Budget" />
                                <Bar dataKey="actual" fill={BLUE} radius={[4, 4, 0, 0]} name="Actual" />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="glass-card p-5">
                    <p className="section-title mb-4">Active Alerts</p>
                    {alertData.filter(datum => datum.value > 0).length === 0 && !dashboardLoading ? (
                        <div className="flex flex-col items-center justify-center h-40">
                            <CheckCircle size={32} style={{ color: GREEN }} className="mb-2" />
                            <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>All clear!</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={alertData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                    {alertData.map((_entry, index) => (
                                        <Cell key={index} fill={[RED, AMBER, '#64748b'][index]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '8px', color: '#e2e8f0' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                    <p className="section-title mb-4">Recent Unresolved Alerts</p>
                    {recentAlerts.length === 0 ? (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--color-surface-400)' }}>No active alerts.</p>
                    ) : (
                        <div className="space-y-2">
                            {recentAlerts.map((alert) => (
                                <div key={alert.id} className={`p-3 rounded-lg ${alert.severity === 'High' ? 'alert-high' : alert.severity === 'Medium' ? 'alert-medium' : 'alert-low'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm" style={{ color: 'var(--color-surface-100)' }}>{alert.message}</p>
                                        <StatusBadge status={alert.severity} className="shrink-0" />
                                    </div>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-surface-400)' }}>{alert.category} Ã‚Â· {formatDate(alert.created_at)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass-card p-5">
                    <p className="section-title mb-4">Schedule Milestones</p>
                    {recentMilestones.length === 0 ? (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--color-surface-400)' }}>No milestones defined.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentMilestones.map((milestone) => (
                                <div key={milestone.milestone_name}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-surface-100)' }}>{milestone.milestone_name}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold" style={{ color: milestone.completion_percent >= 100 ? GREEN : TEAL }}>{milestone.completion_percent.toFixed(0)}%</span>
                                            <StatusBadge status={milestone.status} />
                                        </div>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className={`progress-fill ${milestone.status === 'Delayed' ? 'progress-fill-red' : milestone.completion_percent >= 100 ? 'progress-fill-green' : 'progress-fill-teal'}`}
                                            style={{ width: `${milestone.completion_percent}%` }}
                                        />
                                    </div>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>Due: {formatDate(milestone.planned_finish)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

