import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProjectStore } from '@/stores/projectStore'
import { DataTable } from '@/components/common/DataTable'
import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BudgetVsActual } from '@/types'

export default function BudgetActualReport() {
    const { activeProject } = useProjectStore()

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['budget_vs_actual', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('budget_vs_actual').select('*').eq('project_id', activeProject.id)
            return (data ?? []) as BudgetVsActual[]
        },
        enabled: !!activeProject,
    })

    const totalBudget = rows.reduce((s, r) => s + r.budget_value, 0)
    const totalActual = rows.reduce((s, r) => s + r.actual_value, 0)
    const totalVariance = totalBudget - totalActual

    const columns = [
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
        { key: 'budget_value', header: 'Budget', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'actual_value', header: 'Actual', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'variance', header: 'Variance', render: (v: number) => <span style={{ color: v >= 0 ? '#34d399' : '#ef4444', fontWeight: 600 }}>{formatCurrency(v)}</span>, sortable: true },
        { key: 'variance_percent', header: 'Var %', render: (v: number) => <span style={{ color: v >= 0 ? '#34d399' : '#ef4444' }}>{(v * 100).toFixed(1)}%</span> },
        { key: 'status', header: 'Status', render: (v: string) => <span style={{ color: v === 'Over Budget' ? '#ef4444' : v === 'Under Budget' ? '#34d399' : '#60a5fa', fontWeight: 600, fontSize: '0.8rem' }}>{v}</span> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="glass-card p-4 grid grid-cols-4 gap-4">
                {[['Total Budget', totalBudget, 'var(--color-brand-300)'], ['Total Actual', totalActual, '#60a5fa'], ['Variance', totalVariance, totalVariance >= 0 ? '#34d399' : '#ef4444'], ['Over Budget Lines', rows.filter(r => r.status === 'Over Budget').length, '#ef4444']].map(([label, value, color]) => (
                    <div key={String(label)}>
                        <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>{label}</p>
                        <p className="text-xl font-bold" style={{ color: String(color) }}>{typeof value === 'number' && String(label) !== 'Over Budget Lines' ? formatCurrency(value) : value}</p>
                    </div>
                ))}
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.sap_boq_ref} filterKeys={['sap_boq_ref', 'status']} />
        </div>
    )
}
