import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { useProjectStore } from '@/stores/projectStore'
import { AlertTriangle, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { WarehouseStock } from '@/types'

export default function StockPage() {
    const { activeProject } = useProjectStore()

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['warehouse_stock', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('warehouse_stock').select('*').eq('project_id', activeProject.id).order('material_code')
            return data as WarehouseStock[]
        },
        enabled: !!activeProject,
        refetchInterval: 30000, // auto-refresh every 30s
    })

    const columns = [
        { key: 'material_code', header: 'Material Code', sortable: true },
        { key: 'location', header: 'Location', sortable: true },
        { key: 'current_qty', header: 'Current Qty', render: (v: number) => <span style={{ color: v <= 0 ? '#f87171' : v < 10 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>{v?.toLocaleString()}</span>, sortable: true },
        { key: 'weighted_avg_cost', header: 'Avg Cost (₹)', render: (v: number) => formatCurrency(v) },
        { key: 'last_updated', header: 'Last Updated', render: (v: string) => new Date(v).toLocaleString('en-IN') },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    const totalStockValue = rows.reduce((s, r) => s + r.current_qty * r.weighted_avg_cost, 0)

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Warehouse Stock</p><p className="section-subtitle">Total Stock Value: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalStockValue)}</strong></p></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                {['WH1', 'WH2', 'Site'].map(loc => {
                    const locRows = rows.filter(r => r.location === loc)
                    return (
                        <div key={loc} className="glass-card p-4">
                            <div className="flex items-center gap-2 mb-2"><Package size={16} style={{ color: 'var(--color-brand-400)' }} /><p className="font-semibold" style={{ color: 'var(--color-surface-50)' }}>{loc}</p></div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--color-brand-300)' }}>{locRows.length}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-surface-400)' }}>material lines</p>
                            <p className="text-sm font-semibold mt-2" style={{ color: '#34d399' }}>{formatCurrency(locRows.reduce((s, r) => s + r.current_qty * r.weighted_avg_cost, 0))}</p>
                        </div>
                    )
                })}
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['material_code', 'location']} searchPlaceholder="Search material or location..." />
        </div>
    )
}
