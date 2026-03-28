import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Package } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { formatCurrency } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { getERPReferenceData, getProcurementSnapshot } from '@/services/constructionErpService'
import type { InventoryStock } from '@/types/constructionErp'

export default function StockPage() {
    const { activeProject } = useProjectStore()

    const { data: snapshot, isLoading } = useQuery({
        queryKey: ['construction-erp-stock', activeProject?.id],
        queryFn: () => getProcurementSnapshot(activeProject!.id),
        enabled: !!activeProject,
        refetchInterval: 30000,
    })

    const { data: reference } = useQuery({
        queryKey: ['construction-erp-stock-reference'],
        queryFn: () => getERPReferenceData(),
    })

    const rows = snapshot?.inventory ?? []
    const itemMap = useMemo(() => new Map((reference?.items ?? []).map((item) => [item.id, `${item.item_code} - ${item.name}`])), [reference?.items])

    if (!activeProject) {
        return (
            <div className="glass-card p-8 text-center">
                <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
                <p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p>
            </div>
        )
    }

    const totalStockValue = rows.reduce((sum, row) => sum + row.balance_qty * row.average_rate, 0)
    const stockSummary = [
        { label: 'Items In Stock', value: rows.length, amount: totalStockValue },
        { label: 'Positive Balance', value: rows.filter((row) => row.balance_qty > 0).length, amount: rows.filter((row) => row.balance_qty > 0).reduce((sum, row) => sum + row.balance_qty * row.average_rate, 0) },
        { label: 'Low Balance', value: rows.filter((row) => row.balance_qty > 0 && row.balance_qty < 10).length, amount: rows.filter((row) => row.balance_qty > 0 && row.balance_qty < 10).reduce((sum, row) => sum + row.balance_qty * row.average_rate, 0) },
    ]

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div>
                    <p className="section-title">Inventory Stock</p>
                    <p className="section-subtitle">Total Stock Value: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalStockValue)}</strong></p>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {stockSummary.map((summary) => (
                    <div key={summary.label} className="glass-card p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Package size={16} style={{ color: 'var(--color-brand-400)' }} />
                            <p className="font-semibold" style={{ color: 'var(--color-surface-50)' }}>{summary.label}</p>
                        </div>
                        <p className="text-2xl font-bold" style={{ color: 'var(--color-brand-300)' }}>{summary.value}</p>
                        <p className="mt-2 text-sm font-semibold" style={{ color: '#34d399' }}>{formatCurrency(summary.amount)}</p>
                    </div>
                ))}
            </div>
            <DataTable
                columns={[
                    { key: 'item_id', header: 'Item', render: (value: string) => itemMap.get(value) ?? value, sortable: true },
                    { key: 'inward_qty', header: 'Inward Qty', sortable: true },
                    { key: 'outward_qty', header: 'Outward Qty', sortable: true },
                    { key: 'balance_qty', header: 'Balance Qty', render: (value: number) => <span style={{ color: value <= 0 ? '#f87171' : value < 10 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>{value.toLocaleString()}</span>, sortable: true },
                    { key: 'average_rate', header: 'Avg Rate', render: (value: number) => formatCurrency(value), sortable: true },
                    { key: 'stock_value', header: 'Stock Value', render: (_: unknown, row: InventoryStock) => formatCurrency(row.balance_qty * row.average_rate), sortable: true },
                ]}
                data={rows}
                loading={isLoading}
                keyExtractor={(row) => row.id}
                filterKeys={['item_id']}
                searchPlaceholder="Search inventory..."
            />
        </div>
    )
}
