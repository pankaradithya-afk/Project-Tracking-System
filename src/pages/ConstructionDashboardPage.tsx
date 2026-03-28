import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardCheck, DollarSign, FileWarning, PackageCheck, ReceiptIndianRupee, ShoppingCart, Truck } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { KpiCard } from '@/components/common/KpiCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { getConstructionDashboardSnapshot, getERPReferenceData, getProcurementSnapshot } from '@/services/constructionErpService'

export default function ConstructionDashboardPage() {
    const { activeProject } = useProjectStore()
    const { data, isLoading } = useQuery({
        queryKey: ['construction-erp-dashboard', activeProject?.id],
        queryFn: getConstructionDashboardSnapshot,
    })
    const { data: procurementSnapshot } = useQuery({
        queryKey: ['construction-erp-dashboard-inventory', activeProject?.id],
        queryFn: () => getProcurementSnapshot(activeProject!.id),
        enabled: !!activeProject,
    })
    const { data: reference } = useQuery({
        queryKey: ['construction-erp-dashboard-reference', activeProject?.id],
        queryFn: () => getERPReferenceData(activeProject?.id),
        enabled: !!activeProject,
    })

    const summary = data?.summary ?? []
    const recentActivity = data?.recentActivity ?? []
    const mismatches = data?.invoiceMismatches ?? []
    const inventory = procurementSnapshot?.inventory ?? []
    const itemMap = useMemo(
        () => new Map((reference?.items ?? []).map((item) => [item.id, `${item.item_code} - ${item.name}`])),
        [reference?.items]
    )

    const activeRow = useMemo(
        () => summary.find((row) => row.project_id === activeProject?.id) ?? null,
        [activeProject?.id, summary]
    )

    const totals = useMemo(() => ({
        budget: summary.reduce((sum, row) => sum + row.budget_amount, 0),
        cost: summary.reduce((sum, row) => sum + row.cost_to_date, 0),
        pendingPr: summary.reduce((sum, row) => sum + row.pending_pr_count, 0),
        pendingPo: summary.reduce((sum, row) => sum + row.pending_po_count, 0),
        pendingGrn: summary.reduce((sum, row) => sum + row.pending_grn_count, 0),
        pendingInvoice: summary.reduce((sum, row) => sum + row.pending_invoice_count, 0),
        pendingPayment: summary.reduce((sum, row) => sum + row.pending_payment_count, 0),
        cashOutflow: summary.reduce((sum, row) => sum + row.cash_outflow, 0),
        cashPaid: summary.reduce((sum, row) => sum + row.cash_paid, 0),
        dpr: summary.reduce((sum, row) => sum + row.dpr_entries, 0),
        dprQty: summary.reduce((sum, row) => sum + row.dpr_quantity, 0),
        mismatches: mismatches.length,
    }), [mismatches.length, summary])

    const variance = totals.budget - totals.cost

    const summaryColumns = [
        { key: 'project_name', header: 'Project', sortable: true },
        { key: 'budget_amount', header: 'Budget', render: (value: number) => formatCurrency(value), sortable: true },
        { key: 'cost_to_date', header: 'Cost to Date', render: (value: number) => formatCurrency(value), sortable: true },
        {
            key: 'variance',
            header: 'Variance',
            render: (_: unknown, row: typeof summary[number]) => {
                const rowVariance = row.budget_amount - row.cost_to_date
                return <span style={{ color: rowVariance >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(rowVariance)}</span>
            },
        },
        { key: 'pending_pr_count', header: 'Pending PR', sortable: true },
        { key: 'pending_po_count', header: 'Pending POs', sortable: true },
        { key: 'pending_grn_count', header: 'Pending GRN', sortable: true },
        { key: 'pending_invoice_count', header: 'Pending Invoices', sortable: true },
        { key: 'pending_payment_count', header: 'Pending Payments', sortable: true },
        { key: 'dpr_entries', header: 'DPR Entries', sortable: true },
        { key: 'cash_outflow', header: 'Cash Outflow', render: (value: number) => formatCurrency(value), sortable: true },
        { key: 'cash_paid', header: 'Cash Paid', render: (value: number) => formatCurrency(value), sortable: true },
        {
            key: 'open_invoice_variance_count',
            header: 'Invoice Mismatch',
            render: (value: number) => <StatusBadge status={value > 0 ? 'High' : 'Approved'} />,
            sortable: true,
        },
    ]

    return (
        <div className="space-y-6">
            {activeProject ? (
                <div className="glass-card p-5">
                    <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--color-brand-300)' }}>Active Project</p>
                    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-surface-50)' }}>{activeProject.name}</h2>
                            <p className="mt-1 text-sm" style={{ color: 'var(--color-surface-400)' }}>
                                {activeRow
                                    ? `Budget ${formatCurrency(activeRow.budget_amount)} | Cost ${formatCurrency(activeRow.cost_to_date)} | ${activeRow.pending_po_count} pending POs`
                                    : 'No construction ERP transactions have been logged for this project yet.'}
                            </p>
                        </div>
                        {activeRow ? (
                            <div className="rounded-xl px-4 py-3 text-right" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)' }}>
                                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-surface-400)' }}>Project Variance</p>
                                <p className="mt-1 text-xl font-bold" style={{ color: activeRow.budget_amount - activeRow.cost_to_date >= 0 ? '#34d399' : '#f87171' }}>
                                    {formatCurrency(activeRow.budget_amount - activeRow.cost_to_date)}
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="glass-card p-6 text-center">
                    <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
                    <p className="font-semibold" style={{ color: 'var(--color-surface-50)' }}>No active project selected</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-surface-400)' }}>
                        Project-level widgets will highlight once you set an active project.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8">
                <KpiCard title="Budget" value={totals.budget} isCurrency accentColor="teal" icon={<DollarSign size={18} />} loading={isLoading} />
                <KpiCard title="Cost To Date" value={totals.cost} isCurrency accentColor="amber" icon={<ReceiptIndianRupee size={18} />} loading={isLoading} />
                <KpiCard title="Variance" value={variance} isCurrency accentColor={variance >= 0 ? 'green' : 'red'} icon={<ClipboardCheck size={18} />} loading={isLoading} />
                <KpiCard title="Pending PR" value={totals.pendingPr} accentColor="blue" icon={<ShoppingCart size={18} />} loading={isLoading} />
                <KpiCard title="Pending POs" value={totals.pendingPo} accentColor="blue" icon={<PackageCheck size={18} />} loading={isLoading} />
                <KpiCard title="Pending GRN" value={totals.pendingGrn} accentColor="amber" icon={<Truck size={18} />} loading={isLoading} />
                <KpiCard title="Pending Invoices" value={totals.pendingInvoice} accentColor="purple" icon={<ReceiptIndianRupee size={18} />} loading={isLoading} />
                <KpiCard title="Pending Payments" value={totals.pendingPayment} accentColor="purple" icon={<ReceiptIndianRupee size={18} />} loading={isLoading} />
                <KpiCard title="DPR Progress Qty" value={totals.dprQty} accentColor="teal" icon={<ClipboardCheck size={18} />} loading={isLoading} />
                <KpiCard title="Invoice Mismatch" value={totals.mismatches} accentColor="red" icon={<FileWarning size={18} />} loading={isLoading} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <div className="space-y-3">
                    <div className="section-header">
                        <div>
                            <p className="section-title">Project-wise Summary</p>
                            <p className="section-subtitle">Budget, spend, pending procurement, payment exposure, and DPR activity</p>
                        </div>
                    </div>
                    <DataTable
                        columns={summaryColumns}
                        data={summary}
                        loading={isLoading}
                        keyExtractor={(row) => row.project_id}
                        filterKeys={['project_name']}
                        searchPlaceholder="Search project summary..."
                    />
                </div>

                <div className="space-y-3">
                    <div className="section-header">
                        <div>
                            <p className="section-title">Recent Activity</p>
                            <p className="section-subtitle">Latest ERP writes captured by the audit trigger</p>
                        </div>
                    </div>
                    <div className="glass-card p-4">
                        {recentActivity.length === 0 && !isLoading ? (
                            <p className="py-8 text-center text-sm" style={{ color: 'var(--color-surface-400)' }}>No activity logged yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {recentActivity.map((entry) => (
                                    <div key={entry.id} className="rounded-xl border p-3" style={{ borderColor: 'rgba(51,65,85,0.45)' }}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: 'var(--color-surface-50)' }}>
                                                    {entry.record_system_id ?? entry.table_name}
                                                </p>
                                                <p className="mt-1 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                                                    {entry.table_name} | {entry.action}
                                                </p>
                                            </div>
                                            <StatusBadge status={entry.action === 'delete' ? 'Rejected' : entry.action === 'update' ? 'Submitted' : 'Approved'} />
                                        </div>
                                        <p className="mt-2 text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                            {formatDate(entry.created_at)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {activeProject ? (
                <div className="space-y-3">
                    <div className="section-header">
                        <div>
                            <p className="section-title">Inventory Status</p>
                            <p className="section-subtitle">Live inward, outward, and balance quantities for the active project</p>
                        </div>
                    </div>
                    <DataTable
                        columns={[
                            { key: 'item_id', header: 'Item', render: (value: string) => itemMap.get(value) ?? value, sortable: true },
                            { key: 'inward_qty', header: 'Inward Qty', sortable: true },
                            { key: 'outward_qty', header: 'Outward Qty', sortable: true },
                            { key: 'balance_qty', header: 'Balance Qty', sortable: true },
                            { key: 'average_rate', header: 'Avg Rate', render: (value: number) => formatCurrency(value), sortable: true },
                        ]}
                        data={inventory}
                        loading={isLoading}
                        keyExtractor={(row) => row.id}
                        filterKeys={['item_id']}
                        searchPlaceholder="Search inventory status..."
                    />
                </div>
            ) : null}
        </div>
    )
}
