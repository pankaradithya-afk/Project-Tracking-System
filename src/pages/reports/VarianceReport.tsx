import { DataTable } from '@/components/common/DataTable'
import { useProjectStore } from '@/stores/projectStore'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BudgetVsActual } from '@/types'

export default function VarianceReport() {
    const { activeProject } = useProjectStore()

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['variance_report', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('budget_vs_actual').select('*').eq('project_id', activeProject.id).order('variance')
            return (data ?? []) as BudgetVsActual[]
        },
        enabled: !!activeProject,
    })

    const overBudget = rows.filter(r => r.status === 'Over Budget')
    const underBudget = rows.filter(r => r.status === 'Under Budget')
    const totalOverBudgetAmount = overBudget.reduce((s, r) => s + Math.abs(r.variance), 0)

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="glass-card p-4 grid grid-cols-3 gap-4 mb-4">
                <div><p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Over Budget Lines</p><p className="text-xl font-bold" style={{ color: '#ef4444' }}>{overBudget.length}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Total Overrun</p><p className="text-xl font-bold" style={{ color: '#ef4444' }}>{formatCurrency(totalOverBudgetAmount)}</p></div>
                <div><p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Under Budget Lines</p><p className="text-xl font-bold" style={{ color: '#34d399' }}>{underBudget.length}</p></div>
            </div>

            {overBudget.length > 0 && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <p className="font-semibold mb-3 text-sm" style={{ color: '#f87171' }}>⚠ Over Budget Items ({overBudget.length})</p>
                    <div className="space-y-2">
                        {overBudget.map(r => (
                            <div key={r.sap_boq_ref} className="flex justify-between items-center text-sm">
                                <span style={{ color: 'var(--color-surface-200)' }}>{r.sap_boq_ref}</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>Overrun by {formatCurrency(Math.abs(r.variance))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <DataTable
                columns={[
                    { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
                    { key: 'budget_value', header: 'Budget', render: (v: number) => formatCurrency(v) },
                    { key: 'actual_value', header: 'Actual', render: (v: number) => formatCurrency(v) },
                    { key: 'variance', header: 'Variance', render: (v: number) => <strong style={{ color: v >= 0 ? '#34d399' : '#ef4444' }}>{formatCurrency(v)}</strong>, sortable: true },
                    { key: 'variance_percent', header: 'Var %', render: (v: number) => <span style={{ color: v >= 0 ? '#34d399' : '#ef4444' }}>{(v * 100).toFixed(1)}%</span> },
                    { key: 'status', header: 'Status', render: (v: string) => <span style={{ color: v === 'Over Budget' ? '#ef4444' : '#34d399', fontWeight: 600 }}>{v}</span> },
                ]}
                data={rows}
                loading={isLoading}
                keyExtractor={r => r.sap_boq_ref}
            />
        </div>
    )
}
