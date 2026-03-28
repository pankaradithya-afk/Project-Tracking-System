import { Plus, Trash2 } from 'lucide-react'
import type { ERPItem } from '@/types/constructionErp'

export type PurchaseOrderLineForm = {
    id: string
    item_id: string
    quantity: string
    rate: string
    description: string
}

interface PurchaseOrderLinesEditorProps {
    items: ERPItem[]
    value: PurchaseOrderLineForm[]
    onChange: (lines: PurchaseOrderLineForm[]) => void
}

export function PurchaseOrderLinesEditor({ items, value, onChange }: PurchaseOrderLinesEditorProps) {
    const updateLine = (id: string, key: keyof PurchaseOrderLineForm, nextValue: string) => {
        onChange(value.map((line) => line.id === id ? { ...line, [key]: nextValue } : line))
    }

    const addLine = () => {
        onChange([
            ...value,
            {
                id: crypto.randomUUID(),
                item_id: '',
                quantity: '',
                rate: '',
                description: '',
            },
        ])
    }

    const removeLine = (id: string) => {
        onChange(value.filter((line) => line.id !== id))
    }

    const lineTotal = (line: PurchaseOrderLineForm) => {
        const quantity = Number(line.quantity || '0')
        const rate = Number(line.rate || '0')
        return quantity * rate
    }

    return (
        <div className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-surface-50)' }}>PO Line Items</p>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Add one or more items to the purchase order.</p>
                </div>
                <button className="btn-secondary" type="button" onClick={addLine}>
                    <Plus size={14} />
                    Add Line
                </button>
            </div>
            <div className="space-y-3">
                {value.map((line, index) => (
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
                            <label className="form-label">Quantity *</label>
                            <input className="form-input" type="number" min="0.01" step="0.01" required value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <label className="form-label">Rate *</label>
                            <input className="form-input" type="number" min="0.01" step="0.01" required value={line.rate} onChange={(event) => updateLine(line.id, 'rate', event.target.value)} />
                        </div>
                        <div className="col-span-10 md:col-span-3">
                            <label className="form-label">Description</label>
                            <input className="form-input" value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} />
                        </div>
                        <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                            <button className="btn-danger px-2 py-2" type="button" onClick={() => removeLine(line.id)} disabled={value.length === 1}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="col-span-12 text-right text-xs font-semibold" style={{ color: 'var(--color-brand-300)' }}>
                            Line total: {lineTotal(line).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
