import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, generateRecordId } from '@/lib/utils'
import type { LaborEquipmentCost } from '@/types'

const defaultForm = { cost_date: new Date().toISOString().split('T')[0], sap_boq_ref: '', resource_type: 'Labor', resource_name: '', hours: '', quantity: '', rate: '', supervisor: '', remarks: '' }

export default function LaborCostPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['labor_equipment_cost', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('labor_equipment_cost').select('*').eq('project_id', activeProject.id).order('cost_date', { ascending: false })
            return data as LaborEquipmentCost[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const entry_id = generateRecordId('LEC')
        const { error: err } = await supabase.from('labor_equipment_cost').insert([{
            entry_id, project_id: activeProject.id, cost_date: form.cost_date,
            sap_boq_ref: form.sap_boq_ref || null, resource_type: form.resource_type,
            resource_name: form.resource_name, rate: parseFloat(form.rate),
            hours: form.hours ? parseFloat(form.hours) : null,
            quantity: form.quantity ? parseFloat(form.quantity) : null,
            supervisor: form.supervisor, remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['labor_equipment_cost'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const totalCost = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
    const columns = [
        { key: 'entry_id', header: 'Entry ID', sortable: true },
        { key: 'cost_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'resource_type', header: 'Type', sortable: true },
        { key: 'resource_name', header: 'Resource', sortable: true },
        { key: 'hours', header: 'Hours', render: (v: number) => v ?? '—' },
        { key: 'quantity', header: 'Qty', render: (v: number) => v ?? '—' },
        { key: 'rate', header: 'Rate', render: (v: number) => formatCurrency(v) },
        { key: 'amount', header: 'Amount', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'supervisor', header: 'Supervisor', render: (v: string) => v ?? '—' },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Labor & Equipment Cost</p><p className="section-subtitle">Total: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalCost)}</strong></p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Log Cost</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['entry_id', 'resource_type', 'resource_name', 'supervisor']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Labor / Equipment Cost" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="lec-form" type="submit">Save</button></>}
            >
                <form id="lec-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div>
                        <label className="form-label">Date *</label>
                        <input type="date" className="form-input" required value={form.cost_date} onChange={e => setForm(f => ({ ...f, cost_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Resource Type *</label>
                        <select className="form-input" value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}>
                            <option>Labor</option><option>Equipment</option><option>Subcontract</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Resource Name *</label>
                        <input className="form-input" required value={form.resource_name} onChange={e => setForm(f => ({ ...f, resource_name: e.target.value }))} placeholder="e.g. Excavator, Plumber Team A" />
                    </div>
                    <div>
                        <label className="form-label">Hours</label>
                        <input type="number" className="form-input" min="0" step="0.5" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Quantity</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Rate (₹) *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Computed Amount</label>
                        <input className="form-input" disabled value={(form.hours || form.quantity) && form.rate ? formatCurrency((parseFloat(form.hours || form.quantity || '0')) * parseFloat(form.rate)) : '—'} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Supervisor</label><input className="form-input" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))} /></div>
                    <div className="col-span-2"><label className="form-label">SAP BOQ Ref</label><input className="form-input" value={form.sap_boq_ref} onChange={e => setForm(f => ({ ...f, sap_boq_ref: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
