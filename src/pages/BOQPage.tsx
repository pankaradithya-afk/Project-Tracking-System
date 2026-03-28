import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Layers3, Plus, SplitSquareVertical } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency } from '@/lib/utils'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { useProjectStore } from '@/stores/projectStore'
import type { BOQCategory, BOQItem, BOQLumpsumBreakupLine } from '@/types'

type ERPItemOption = {
    id: string
    item_code: string
    name: string
    uom: string
    standard_rate: number
    item_type: 'material' | 'service'
}

type CostCodeOption = {
    id: string
    code: string
    description: string
}

type BreakupFormRow = {
    id: string
    material_item_id: string
    cost_code_id: string
    sap_ref_no: string
    description: string
    quantity: string
    uom: string
    rate: string
}

const categoryOptions: BOQCategory[] = ['Material', 'Installation', 'Earthwork', 'Equipment']
const itemTypeOptions = [
    { label: 'Regular', value: 'regular' },
    { label: 'Lumpsum', value: 'lumpsum' },
]

const emptyForm = {
    boq_ref: '',
    boq_section: '',
    cost_code_id: '',
    item_id: '',
    category: 'Material' as BOQCategory,
    item_type: 'regular' as BOQItem['item_type'],
    sap_ref_no: '',
    description: '',
    quantity: '',
    uom: '',
    rate: '',
}

const createBreakupRow = (): BreakupFormRow => ({
    id: crypto.randomUUID(),
    material_item_id: '',
    cost_code_id: '',
    sap_ref_no: '',
    description: '',
    quantity: '',
    uom: '',
    rate: '',
})

export default function BOQPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const { data: profile } = useCurrentProfile()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [breakups, setBreakups] = useState<BreakupFormRow[]>([createBreakupRow()])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: boqRows = [], isLoading } = useQuery({
        queryKey: ['boq-items', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data, error: queryError } = await supabase
                .from('v_boq_item_summary')
                .select('*')
                .eq('project_id', activeProject.id)
                .order('line_no')

            if (queryError) throw queryError
            return (data ?? []) as BOQItem[]
        },
        enabled: !!activeProject,
    })

    const { data: items = [] } = useQuery({
        queryKey: ['boq-items-master'],
        queryFn: async () => {
            const { data, error: queryError } = await supabase
                .from('items')
                .select('id, item_code, name, uom, standard_rate, item_type')
                .eq('is_active', true)
                .order('item_code')

            if (queryError) throw queryError
            return (data ?? []) as ERPItemOption[]
        },
    })

    const { data: costCodes = [] } = useQuery({
        queryKey: ['boq-cost-codes'],
        queryFn: async () => {
            const { data, error: queryError } = await supabase
                .from('cost_codes')
                .select('id, code, description')
                .order('code')

            if (queryError) throw queryError
            return (data ?? []) as CostCodeOption[]
        },
    })

    const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
    const costCodeMap = useMemo(() => new Map(costCodes.map((costCode) => [costCode.id, `${costCode.code} - ${costCode.description}`])), [costCodes])

    const totalValue = boqRows.reduce((sum, row) => sum + row.amount, 0)
    const lumpsumCount = boqRows.filter((row) => row.item_type === 'lumpsum').length
    const breakupVarianceCount = boqRows.filter((row) => row.item_type === 'lumpsum' && !row.breakup_matches).length

    const parentAmount = Number(form.quantity || 0) * Number(form.rate || 0)
    const breakupAmount = breakups.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.rate || 0), 0)
    const breakupVariance = Number((parentAmount - breakupAmount).toFixed(2))

    const resetModal = () => {
        setModalOpen(false)
        setForm(emptyForm)
        setBreakups([createBreakupRow()])
        setSaving(false)
        setError('')
    }

    const handleParentItemChange = (itemId: string) => {
        const selected = itemMap.get(itemId)
        setForm((current) => ({
            ...current,
            item_id: itemId,
            description: selected?.name ?? current.description,
            uom: selected?.uom ?? current.uom,
            rate: selected?.standard_rate ? String(selected.standard_rate) : current.rate,
        }))
    }

    const handleBreakupItemChange = (rowId: string, itemId: string) => {
        const selected = itemMap.get(itemId)
        setBreakups((current) =>
            current.map((row) =>
                row.id === rowId
                    ? {
                        ...row,
                        material_item_id: itemId,
                        description: selected?.name ?? row.description,
                        uom: selected?.uom ?? row.uom,
                        rate: selected?.standard_rate ? String(selected.standard_rate) : row.rate,
                    }
                    : row
            )
        )
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!activeProject) return

        setSaving(true)
        setError('')

        try {
            const payloadBreakups = breakups
                .filter((row) => row.material_item_id && Number(row.quantity) > 0 && Number(row.rate) > 0)
                .map((row) => ({
                    material_item_id: row.material_item_id,
                    cost_code_id: row.cost_code_id || form.cost_code_id,
                    sap_ref_no: row.sap_ref_no,
                    description: row.description,
                    quantity: Number(row.quantity),
                    uom: row.uom,
                    rate: Number(row.rate),
                }))

            if (form.item_type === 'lumpsum') {
                if (payloadBreakups.length === 0) {
                    throw new Error('Add at least one breakup line for a lumpsum BOQ item.')
                }

                if (Math.abs(parentAmount - breakupAmount) > 0.01) {
                    throw new Error('Lumpsum breakup total must match the parent BOQ amount exactly.')
                }
            }

            const { error: rpcError } = await supabase.rpc('create_boq_item_with_breakups', {
                p_project_id: activeProject.id,
                p_cost_code_id: form.cost_code_id,
                p_item_id: form.item_id,
                p_boq_ref: form.boq_ref,
                p_boq_section: form.boq_section,
                p_category: form.category,
                p_item_type: form.item_type,
                p_description: form.description,
                p_quantity: Number(form.quantity),
                p_uom: form.uom,
                p_rate: Number(form.rate),
                p_breakups: payloadBreakups,
                p_sap_ref_no: form.sap_ref_no || null,
                p_created_by: profile?.id ?? null,
            })

            if (rpcError) throw rpcError

            await Promise.all([
                qc.invalidateQueries({ queryKey: ['boq-items', activeProject.id] }),
                qc.invalidateQueries({ queryKey: ['boq-breakups', activeProject.id] }),
                qc.invalidateQueries({ queryKey: ['boq_contract'] }),
                qc.invalidateQueries({ queryKey: ['boq_sap_breakup'] }),
                qc.invalidateQueries({ queryKey: ['construction-erp-dashboard'] }),
            ])

            resetModal()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to save BOQ item.')
            setSaving(false)
        }
    }

    const columns = [
        { key: 'boq_ref', header: 'BOQ Ref', sortable: true, width: '110px' },
        { key: 'boq_section', header: 'Section', sortable: true },
        { key: 'item_type', header: 'Type', render: (value: BOQItem['item_type']) => value === 'lumpsum' ? 'Lumpsum' : 'Regular' },
        { key: 'item_code', header: 'Item Code', sortable: true },
        { key: 'description', header: 'Description' },
        { key: 'quantity', header: 'Qty', render: (value: number) => value.toLocaleString(), sortable: true },
        { key: 'uom', header: 'UOM', width: '80px' },
        { key: 'rate', header: 'Rate', render: (value: number) => formatCurrency(value), sortable: true },
        { key: 'amount', header: 'Amount', render: (value: number) => formatCurrency(value), sortable: true },
        {
            key: 'breakup_status',
            header: 'Breakup',
            render: (_: unknown, row: BOQItem) => {
                if (row.item_type === 'regular') return 'NA'
                return row.breakup_matches ? `${row.breakup_count ?? 0} lines` : 'Mismatch'
            },
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
                <div>
                    <p className="section-title">BOQ Contract</p>
                    <p className="section-subtitle">
                        {boqRows.length} items · Total Contract Value: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalValue)}</strong>
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add BOQ Item</button>
            </div>

            <div className="glass-card p-4 grid gap-4 md:grid-cols-4">
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Contract Value</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalValue)}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>BOQ Items</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-surface-50)' }}>{boqRows.length}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Lumpsum Items</p>
                    <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{lumpsumCount}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Breakup Issues</p>
                    <p className="text-xl font-bold" style={{ color: breakupVarianceCount === 0 ? '#34d399' : '#f87171' }}>{breakupVarianceCount}</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={boqRows}
                loading={isLoading}
                keyExtractor={(row) => row.id}
                searchPlaceholder="Search BOQ..."
                filterKeys={['boq_ref', 'description', 'boq_section', 'item_code']}
            />

            <Modal
                open={modalOpen}
                onClose={resetModal}
                title="Add BOQ Item"
                maxWidth="xl"
                loading={saving}
                footer={
                    <>
                        <button className="btn-secondary" onClick={resetModal}>Cancel</button>
                        <button className="btn-primary" form="boq-form" type="submit">Save BOQ Item</button>
                    </>
                }
            >
                <form id="boq-form" onSubmit={handleSubmit} className="space-y-5">
                    {error ? (
                        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                            {error}
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">BOQ Ref *</label>
                            <input className="form-input" required value={form.boq_ref} onChange={(event) => setForm((current) => ({ ...current, boq_ref: event.target.value }))} placeholder="BOQ-ICP-004" />
                        </div>
                        <div>
                            <label className="form-label">Section *</label>
                            <input className="form-input" required value={form.boq_section} onChange={(event) => setForm((current) => ({ ...current, boq_section: event.target.value }))} placeholder="Earthwork" />
                        </div>
                        <div>
                            <label className="form-label">Cost Code *</label>
                            <select className="form-input" required value={form.cost_code_id} onChange={(event) => setForm((current) => ({ ...current, cost_code_id: event.target.value }))}>
                                <option value="">Select cost code</option>
                                {costCodes.map((costCode) => (
                                    <option key={costCode.id} value={costCode.id}>{costCode.code} - {costCode.description}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Category *</label>
                            <select className="form-input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as BOQCategory }))}>
                                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Item Type *</label>
                            <select className="form-input" value={form.item_type} onChange={(event) => setForm((current) => ({ ...current, item_type: event.target.value as BOQItem['item_type'] }))}>
                                {itemTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">SAP Ref No</label>
                            <input className="form-input" value={form.sap_ref_no} onChange={(event) => setForm((current) => ({ ...current, sap_ref_no: event.target.value }))} placeholder="Optional - system will generate if blank" />
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Parent Item *</label>
                            <select className="form-input" required value={form.item_id} onChange={(event) => handleParentItemChange(event.target.value)}>
                                <option value="">Select item</option>
                                {items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.item_code} - {item.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Description *</label>
                            <input className="form-input" required value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Quantity *</label>
                            <input type="number" className="form-input" required min="0.01" step="0.01" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">UOM *</label>
                            <input className="form-input" required value={form.uom} onChange={(event) => setForm((current) => ({ ...current, uom: event.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Rate *</label>
                            <input type="number" className="form-input" required min="0.01" step="0.01" value={form.rate} onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Amount</label>
                            <input className="form-input" disabled value={parentAmount > 0 ? formatCurrency(parentAmount) : 'NA'} />
                        </div>
                    </div>

                    {form.item_type === 'lumpsum' ? (
                        <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'rgba(51,65,85,0.45)' }}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <SplitSquareVertical size={16} style={{ color: 'var(--color-brand-300)' }} />
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-surface-50)' }}>Lumpsum Breakup</p>
                                        <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>
                                            Every lumpsum BOQ item must be fully split into resource lines.
                                        </p>
                                    </div>
                                </div>
                                <button type="button" className="btn-secondary" onClick={() => setBreakups((current) => [...current, createBreakupRow()])}>
                                    <Plus size={14} /> Add Breakup Line
                                </button>
                            </div>

                            <div className="space-y-3">
                                {breakups.map((row, index) => (
                                    <div key={row.id} className="grid grid-cols-12 gap-3 rounded-xl border p-3" style={{ borderColor: 'rgba(51,65,85,0.35)' }}>
                                        <div className="col-span-12 flex items-center justify-between">
                                            <p className="text-xs font-semibold" style={{ color: 'var(--color-surface-300)' }}>Breakup Line {index + 1}</p>
                                            {breakups.length > 1 ? (
                                                <button type="button" className="btn-secondary" onClick={() => setBreakups((current) => current.filter((entry) => entry.id !== row.id))}>
                                                    Remove
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="col-span-6">
                                            <label className="form-label">Resource *</label>
                                            <select className="form-input" required value={row.material_item_id} onChange={(event) => handleBreakupItemChange(row.id, event.target.value)}>
                                                <option value="">Select resource</option>
                                                {items.map((item) => (
                                                    <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-6">
                                            <label className="form-label">Cost Code *</label>
                                            <select className="form-input" required value={row.cost_code_id} onChange={(event) => setBreakups((current) => current.map((entry) => entry.id === row.id ? { ...entry, cost_code_id: event.target.value } : entry))}>
                                                <option value="">Select cost code</option>
                                                {costCodes.map((costCode) => (
                                                    <option key={costCode.id} value={costCode.id}>{costCode.code} - {costCode.description}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-4">
                                            <label className="form-label">SAP Ref No</label>
                                            <input className="form-input" value={row.sap_ref_no} onChange={(event) => setBreakups((current) => current.map((entry) => entry.id === row.id ? { ...entry, sap_ref_no: event.target.value } : entry))} />
                                        </div>
                                        <div className="col-span-4">
                                            <label className="form-label">Quantity *</label>
                                            <input type="number" className="form-input" required min="0.01" step="0.01" value={row.quantity} onChange={(event) => setBreakups((current) => current.map((entry) => entry.id === row.id ? { ...entry, quantity: event.target.value } : entry))} />
                                        </div>
                                        <div className="col-span-4">
                                            <label className="form-label">Rate *</label>
                                            <input type="number" className="form-input" required min="0.01" step="0.01" value={row.rate} onChange={(event) => setBreakups((current) => current.map((entry) => entry.id === row.id ? { ...entry, rate: event.target.value } : entry))} />
                                        </div>
                                        <div className="col-span-8">
                                            <label className="form-label">Description *</label>
                                            <input className="form-input" required value={row.description} onChange={(event) => setBreakups((current) => current.map((entry) => entry.id === row.id ? { ...entry, description: event.target.value } : entry))} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="form-label">UOM *</label>
                                            <input className="form-input" required value={row.uom} onChange={(event) => setBreakups((current) => current.map((entry) => entry.id === row.id ? { ...entry, uom: event.target.value } : entry))} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="form-label">Amount</label>
                                            <input className="form-input" disabled value={Number(row.quantity || 0) * Number(row.rate || 0) > 0 ? formatCurrency(Number(row.quantity || 0) * Number(row.rate || 0)) : 'NA'} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-xl p-3" style={{ background: 'rgba(20,184,166,0.08)' }}>
                                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Parent Amount</p>
                                    <p className="text-lg font-bold" style={{ color: 'var(--color-surface-50)' }}>{formatCurrency(parentAmount)}</p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Breakup Total</p>
                                    <p className="text-lg font-bold" style={{ color: 'var(--color-surface-50)' }}>{formatCurrency(breakupAmount)}</p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: breakupVariance === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Variance</p>
                                    <p className="text-lg font-bold" style={{ color: breakupVariance === 0 ? '#34d399' : '#f87171' }}>{formatCurrency(breakupVariance)}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ borderColor: 'rgba(51,65,85,0.45)' }}>
                            <Layers3 size={18} style={{ color: 'var(--color-brand-300)', marginTop: 2 }} />
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--color-surface-50)' }}>Regular BOQ Item</p>
                                <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
                                    Regular items flow directly into procurement and compatibility SAP breakup views using the parent SAP reference.
                                </p>
                            </div>
                        </div>
                    )}
                </form>
            </Modal>
        </div>
    )
}
