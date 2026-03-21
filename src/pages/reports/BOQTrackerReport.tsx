import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProjectStore } from '@/stores/projectStore'
import { DataTable } from '@/components/common/DataTable'
import { AlertTriangle, BarChart3 } from 'lucide-react'
import type { BOQTracker } from '@/types'

export default function BOQTrackerReport() {
    const { activeProject } = useProjectStore()

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['boq_tracker', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            // Query via the view, filtered by project using boq_contract join
            const { data } = await supabase.rpc('get_boq_tracker', { p_project_id: activeProject.id }).then(
                (result) => result,
                // Fallback if RPC not set up — direct view query
                async () => supabase.from('boq_tracker').select('*')
            )
            return (data ?? []) as BOQTracker[]
        },
        enabled: !!activeProject,
    })

    const columns = [
        { key: 'boq_ref', header: 'BOQ Ref', sortable: true },
        { key: 'description', header: 'Description' },
        { key: 'contract_qty', header: 'Contract Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'uom', header: 'UOM', width: '60px' },
        { key: 'po_qty', header: 'PO Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'dc_qty', header: 'DC Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'installed_qty', header: 'Installed', render: (v: number) => v?.toLocaleString() },
        { key: 'billed_qty', header: 'Billed', render: (v: number) => v?.toLocaleString() },
        { key: 'balance_to_procure', header: 'Bal Procure', render: (v: number) => <span style={{ color: v > 0 ? '#f59e0b' : '#34d399' }}>{v?.toLocaleString()}</span> },
        { key: 'balance_to_execute', header: 'Bal Execute', render: (v: number) => <span style={{ color: v > 0 ? '#f59e0b' : '#34d399' }}>{v?.toLocaleString()}</span> },
        { key: 'balance_to_bill', header: 'Bal Bill', render: (v: number) => <span style={{ color: v > 0 ? '#ef4444' : '#34d399' }}>{v?.toLocaleString()}</span> },
        { key: 'missed_bill_flag', header: 'Flag', render: (v: string) => v !== 'OK' ? <span style={{ color: '#ef4444', fontWeight: 700 }}>{v}</span> : <span style={{ color: '#34d399' }}>✓ OK</span> },
        { key: 'execution_percent', header: 'Exec %', render: (v: number) => `${v?.toFixed(1)}%` },
        { key: 'billing_percent', header: 'Bill %', render: (v: number) => `${v?.toFixed(1)}%` },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div className="flex items-center gap-3">
                    <BarChart3 size={22} style={{ color: 'var(--color-brand-400)' }} />
                    <div><p className="section-title">BOQ Tracker</p><p className="section-subtitle">End-to-end procurement → execution → billing chain</p></div>
                </div>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.boq_ref} filterKeys={['boq_ref', 'description']} searchPlaceholder="Search BOQ..." />
        </div>
    )
}
