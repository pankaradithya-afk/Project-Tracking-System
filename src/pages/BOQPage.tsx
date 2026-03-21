import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, Lock, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BOQContract } from '@/types'

const defaultForm = {
    boq_section: '', boq_ref: '', description: '', category: 'Material',
    uom: '', contract_qty: '', contract_rate: '', remarks: '',
}

export default function BOQPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: boqRows = [], isLoading } = useQuery({
        queryKey: ['boq_contract', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data, error } = await supabase.from('boq_contract').select('*').eq('project_id', activeProject.id).order('boq_ref')
            if (error) throw error
            return data as BOQContract[]
        },
        enabled: !!activeProject,
    })

    const totalValue = boqRows.reduce((s, r) => s + (r.contract_value ?? 0), 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const { error: err } = await supabase.from('boq_contract').insert([{
            project_id: activeProject.id,
            boq_section: form.boq_section,
            boq_ref: form.boq_ref,
            description: form.description,
            category: form.category,
            uom: form.uom,
            contract_qty: parseFloat(form.contract_qty),
            contract_rate: parseFloat(form.contract_rate),
            remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['boq_contract'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const columns = [
        { key: 'boq_ref', header: 'BOQ Ref', sortable: true, width: '100px' },
        { key: 'boq_section', header: 'Section', sortable: true },
        { key: 'description', header: 'Description' },
        { key: 'category', header: 'Category', sortable: true },
        { key: 'uom', header: 'UOM', width: '70px' },
        { key: 'contract_qty', header: 'Qty', render: (v: number) => v.toLocaleString(), sortable: true },
        { key: 'contract_rate', header: 'Rate', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'contract_value', header: 'Value', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'is_locked', header: 'Locked', render: (v: boolean) => v ? <Lock size={14} style={{ color: '#f59e0b' }} /> : '—' },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center">
            <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
            <p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p>
        </div>
    )

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

            <div className="glass-card p-4 flex gap-6">
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Contract Value</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalValue)}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>BOQ Items</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-surface-50)' }}>{boqRows.length}</p>
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Locked Items</p>
                    <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{boqRows.filter(r => r.is_locked).length}</p>
                </div>
            </div>

            <DataTable columns={columns} data={boqRows} loading={isLoading} keyExtractor={r => r.id}
                searchPlaceholder="Search BOQ..." filterKeys={['boq_ref', 'description', 'boq_section']} />

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add BOQ Item" maxWidth="lg" loading={saving}
                footer={<>
                    <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button className="btn-primary" form="boq-form" type="submit">Save BOQ Item</button>
                </>}
            >
                <form id="boq-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div>
                        <label className="form-label">BOQ Ref * (e.g. BOQ-001)</label>
                        <input className="form-input" required value={form.boq_ref} onChange={e => setForm(p => ({ ...p, boq_ref: e.target.value }))} placeholder="BOQ-001" />
                    </div>
                    <div>
                        <label className="form-label">Section</label>
                        <input className="form-input" value={form.boq_section} onChange={e => setForm(p => ({ ...p, boq_section: e.target.value }))} placeholder="e.g. Mainline Piping" />
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Description *</label>
                        <input className="form-input" required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Category *</label>
                        <select className="form-input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                            <option>Material</option><option>Installation</option><option>Earthwork</option><option>Equipment</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">UOM *</label>
                        <input className="form-input" required value={form.uom} onChange={e => setForm(p => ({ ...p, uom: e.target.value }))} placeholder="e.g. Nos, m, m², LS" />
                    </div>
                    <div>
                        <label className="form-label">Contract Qty *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.contract_qty} onChange={e => setForm(p => ({ ...p, contract_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Contract Rate (₹) *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.contract_rate} onChange={e => setForm(p => ({ ...p, contract_rate: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Contract Value (auto-calculated)</label>
                        <input className="form-input" disabled value={
                            form.contract_qty && form.contract_rate
                                ? formatCurrency(parseFloat(form.contract_qty) * parseFloat(form.contract_rate))
                                : '—'
                        } />
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Remarks</label>
                        <textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
                    </div>
                </form>
            </Modal>
        </div>
    )
}
