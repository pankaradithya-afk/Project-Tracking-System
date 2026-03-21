import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BOQSAPBreakup, BOQContract, MaterialMaster } from '@/types'

const defaultForm = { parent_boq_ref: '', sap_boq_ref: '', material_code: '', description: '', uom: '', required_qty: '', rate: '', remarks: '' }

export default function SAPBreakupPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['boq_sap_breakup', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('boq_sap_breakup').select('*').eq('project_id', activeProject.id).order('sap_boq_ref')
            return data as BOQSAPBreakup[]
        },
        enabled: !!activeProject,
    })

    const { data: boqList = [] } = useQuery({
        queryKey: ['boq_refs', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('boq_contract').select('boq_ref, description').eq('project_id', activeProject.id)
            return data as Pick<BOQContract, 'boq_ref' | 'description'>[]
        },
        enabled: !!activeProject,
    })

    const { data: materials = [] } = useQuery({
        queryKey: ['material_master'],
        queryFn: async () => {
            const { data } = await supabase.from('material_master').select('material_code, material_description, uom').eq('active_status', true).order('material_code')
            return data as Pick<MaterialMaster, 'material_code' | 'material_description' | 'uom'>[]
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const { error: err } = await supabase.from('boq_sap_breakup').insert([{
            project_id: activeProject.id,
            parent_boq_ref: form.parent_boq_ref,
            sap_boq_ref: form.sap_boq_ref,
            material_code: form.material_code,
            description: form.description,
            uom: form.uom,
            required_qty: parseFloat(form.required_qty),
            rate: form.rate ? parseFloat(form.rate) : null,
            remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['boq_sap_breakup'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const handleMaterialSelect = (code: string) => {
        const mat = materials.find(m => m.material_code === code)
        setForm(p => ({ ...p, material_code: code, uom: mat?.uom ?? p.uom, description: mat?.material_description ?? p.description }))
    }

    const columns = [
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true, width: '110px' },
        { key: 'parent_boq_ref', header: 'Parent BOQ', sortable: true },
        { key: 'material_code', header: 'Material Code', sortable: true },
        { key: 'description', header: 'Description' },
        { key: 'uom', header: 'UOM', width: '70px' },
        { key: 'required_qty', header: 'Req Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'rate', header: 'Rate', render: (v: number) => v ? formatCurrency(v) : '—' },
        { key: 'value', header: 'Value', render: (v: number) => v ? formatCurrency(v) : '—' },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">SAP BOQ Breakup</p><p className="section-subtitle">{rows.length} SAP line items (master execution keys)</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add SAP Item</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id}
                searchPlaceholder="Search SAP ref, material, description..." filterKeys={['sap_boq_ref', 'material_code', 'description', 'parent_boq_ref']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add SAP BOQ Item" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="sap-form" type="submit">Save</button></>}
            >
                <form id="sap-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div>
                        <label className="form-label">Parent BOQ Ref *</label>
                        <select className="form-input" required value={form.parent_boq_ref} onChange={e => setForm(p => ({ ...p, parent_boq_ref: e.target.value }))}>
                            <option value="">— Select BOQ —</option>
                            {boqList.map(b => <option key={b.boq_ref} value={b.boq_ref}>{b.boq_ref} — {b.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">SAP BOQ Ref * (e.g. SAP-001)</label>
                        <input className="form-input" required value={form.sap_boq_ref} onChange={e => setForm(p => ({ ...p, sap_boq_ref: e.target.value }))} placeholder="SAP-001" />
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Material Code *</label>
                        <select className="form-input" required value={form.material_code} onChange={e => handleMaterialSelect(e.target.value)}>
                            <option value="">— Select Material —</option>
                            {materials.map(m => <option key={m.material_code} value={m.material_code}>{m.material_code} — {m.material_description}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Description</label>
                        <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">UOM *</label>
                        <input className="form-input" required value={form.uom} onChange={e => setForm(p => ({ ...p, uom: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Required Qty *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.required_qty} onChange={e => setForm(p => ({ ...p, required_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Rate (₹)</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Est. Value</label>
                        <input className="form-input" disabled value={form.required_qty && form.rate ? formatCurrency(parseFloat(form.required_qty) * parseFloat(form.rate)) : '—'} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
