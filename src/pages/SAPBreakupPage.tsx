import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import type { BOQItem, BOQLumpsumBreakupLine } from '@/types'

export default function SAPBreakupPage() {
    const { activeProject } = useProjectStore()

    const { data: summary = [] } = useQuery({
        queryKey: ['boq-lumpsum-summary', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data, error } = await supabase
                .from('v_boq_item_summary')
                .select('*')
                .eq('project_id', activeProject.id)
                .eq('item_type', 'lumpsum')
                .order('line_no')

            if (error) throw error
            return (data ?? []) as BOQItem[]
        },
        enabled: !!activeProject,
    })

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['boq-breakups', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data, error } = await supabase
                .from('v_boq_lumpsum_breakup_details')
                .select('*')
                .eq('project_id', activeProject.id)
                .order('boq_ref')
                .order('line_no')

            if (error) throw error
            return (data ?? []) as BOQLumpsumBreakupLine[]
        },
        enabled: !!activeProject,
    })

    const totals = useMemo(() => ({
        lumpsumItems: summary.length,
        breakupLines: rows.length,
        boqAmount: summary.reduce((sum, row) => sum + row.amount, 0),
        breakupAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    }), [rows, summary])

    const columns = [
        { key: 'boq_ref', header: 'Parent BOQ', sortable: true },
        { key: 'sap_ref_no', header: 'SAP Ref', sortable: true },
        { key: 'material_item_code', header: 'Resource Code', sortable: true },
        { key: 'material_item_name', header: 'Resource' },
        { key: 'cost_code', header: 'Cost Code', sortable: true },
        { key: 'quantity', header: 'Qty', render: (value: number) => value.toLocaleString() },
        { key: 'uom', header: 'UOM', width: '80px' },
        { key: 'rate', header: 'Rate', render: (value: number) => formatCurrency(value), sortable: true },
        { key: 'amount', header: 'Amount', render: (value: number) => formatCurrency(value), sortable: true },
        {
            key: 'variance',
            header: 'Status',
            render: (_: unknown, row: BOQLumpsumBreakupLine) => Math.abs(row.variance ?? 0) <= 0.01 ? 'Matched' : `Variance ${formatCurrency(row.variance ?? 0)}`,
        },
    ]

    if (!activeProject) {
        return (
            <div className="glass-card p-8 text-center">
                <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
                <p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div className="flex items-center gap-3">
                    <ClipboardList size={20} style={{ color: 'var(--color-brand-300)' }} />
                    <div>
                        <p className="section-title">SAP BOQ Breakup</p>
                        <p className="section-subtitle">Lumpsum BOQ items are internally split into resource-level SAP lines</p>
                    </div>
                </div>
            </div>

            <div className="glass-card p-4 grid gap-4 md:grid-cols-4">
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Lumpsum Items</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-surface-50)' }}>{totals.lumpsumItems}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Breakup Lines</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-surface-50)' }}>{totals.breakupLines}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Parent Lumpsum Value</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totals.boqAmount)}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Breakup Total</p>
                    <p className="text-xl font-bold" style={{ color: Math.abs(totals.boqAmount - totals.breakupAmount) <= 0.01 ? '#34d399' : '#f87171' }}>
                        {formatCurrency(totals.breakupAmount)}
                    </p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={rows}
                loading={isLoading}
                keyExtractor={(row) => row.id}
                searchPlaceholder="Search parent BOQ, SAP ref, or resource..."
                filterKeys={['boq_ref', 'sap_ref_no', 'material_item_code', 'material_item_name', 'description']}
            />
        </div>
    )
}
