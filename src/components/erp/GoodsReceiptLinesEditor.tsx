import { Plus, Trash2 } from 'lucide-react'
import type { ERPItem, PurchaseOrderLine } from '@/types/constructionErp'

export type GoodsReceiptLineForm = {
    id: string
    item_id: string
    ordered_qty: string
    received_qty: string
    accepted_qty: string
    store_location: string
    remarks: string
}

interface GoodsReceiptLinesEditorProps {
    items: ERPItem[]
    poLines: PurchaseOrderLine[]
    value: GoodsReceiptLineForm[]
    onChange: (lines: GoodsReceiptLineForm[]) => void
}

export function buildReceiptLinesFromPurchaseOrder(poLines: PurchaseOrderLine[]) {
    if (poLines.length === 0) {
        return [{
            id: crypto.randomUUID(),
            item_id: '',
            ordered_qty: '0',
            received_qty: '',
            accepted_qty: '',
            store_location: 'Main Store',
            remarks: '',
        }]
    }

    return poLines.map((line) => ({
        id: crypto.randomUUID(),
        item_id: line.item_id,
        ordered_qty: String(line.quantity),
        received_qty: '',
        accepted_qty: '',
        store_location: 'Main Store',
        remarks: '',
    }))
}

export function GoodsReceiptLinesEditor({ items, poLines, value, onChange }: GoodsReceiptLinesEditorProps) {
    const itemMap = new Map(items.map((item) => [item.id, `${item.item_code} - ${item.name}`]))

    const updateLine = (id: string, key: keyof GoodsReceiptLineForm, nextValue: string) => {
        onChange(value.map((line) => {
            if (line.id !== id) return line
            if (key === 'received_qty') {
                return {
                    ...line,
                    received_qty: nextValue,
                    accepted_qty: line.accepted_qty || nextValue,
                }
            }

            return { ...line, [key]: nextValue }
        }))
    }

    const addLine = () => {
        onChange([
            ...value,
            {
                id: crypto.randomUUID(),
                item_id: '',
                ordered_qty: '0',
                received_qty: '',
                accepted_qty: '',
                store_location: 'Main Store',
                remarks: '',
            },
        ])
    }

    const removeLine = (id: string) => {
        onChange(value.filter((line) => line.id !== id))
    }

    return (
        <div className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-surface-50)' }}>GRN Items</p>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Capture received and accepted quantities line by line.</p>
                </div>
                <button className="btn-secondary" type="button" onClick={addLine}>
                    <Plus size={14} />
                    Add Item
                </button>
            </div>
            <div className="space-y-3">
                {value.map((line, index) => {
                    const poQuantity = poLines.find((poLine) => poLine.item_id === line.item_id)?.quantity ?? Number(line.ordered_qty || '0')
                    const received = Number(line.received_qty || '0')
                    const accepted = Number(line.accepted_qty || '0')
                    const rejected = Math.max(received - accepted, 0)

                    return (
                        <div key={line.id} className="grid grid-cols-12 gap-3 rounded-xl border p-3" style={{ borderColor: 'rgba(51,65,85,0.55)' }}>
                            <div className="col-span-12 md:col-span-4">
                                <label className="form-label">Item {index + 1} *</label>
                                <select className="form-input" required value={line.item_id} onChange={(event) => updateLine(line.id, 'item_id', event.target.value)}>
                                    <option value="">Select item...</option>
                                    {items.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.item_code} - {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="form-label">Ordered Qty</label>
                                <input className="form-input" type="number" min="0" step="0.01" value={line.ordered_qty} onChange={(event) => updateLine(line.id, 'ordered_qty', event.target.value)} />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="form-label">Received Qty *</label>
                                <input className="form-input" type="number" min="0" step="0.01" required value={line.received_qty} onChange={(event) => updateLine(line.id, 'received_qty', event.target.value)} />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="form-label">Accepted Qty *</label>
                                <input className="form-input" type="number" min="0" max={line.received_qty || undefined} step="0.01" required value={line.accepted_qty} onChange={(event) => updateLine(line.id, 'accepted_qty', event.target.value)} />
                            </div>
                            <div className="col-span-6 md:col-span-1 flex items-end justify-end">
                                <button className="btn-danger px-2 py-2" type="button" onClick={() => removeLine(line.id)} disabled={value.length === 1}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                <label className="form-label">Store</label>
                                <input className="form-input" value={line.store_location} onChange={(event) => updateLine(line.id, 'store_location', event.target.value)} />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                <label className="form-label">Remarks</label>
                                <input className="form-input" value={line.remarks} onChange={(event) => updateLine(line.id, 'remarks', event.target.value)} />
                            </div>
                            <div className="col-span-12 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                                {itemMap.get(line.item_id) ?? 'Line item'} | PO Qty {poQuantity} | Rejected {rejected}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
