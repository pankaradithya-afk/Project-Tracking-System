import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import type { WarehousePlanning, BOQSAPBreakup } from '@/types'

const defaultForm = { sap_boq_ref: '', material_code: '', warehouse_location: 'WH1', required_qty: '', available_warehouse_qty: '0', reserved_qty: '0', remarks: '' }

export default function WarehousePlanningPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['warehouse_planning', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('warehouse_planning').select('*').eq('project_id', activeProject.id).order('sap_boq_ref')
            return data as WarehousePlanning[]
        },
        enabled: !!activeProject,
    })

    const { data: sapRefs = [] } = useQuery({
        queryKey: ['sap_refs_wh', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('boq_sap_breakup').select('sap_boq_ref, material_code, uom').eq('project_id', activeProject.id)
            return data as Pick<BOQSAPBreakup, 'sap_boq_ref' | 'material_code' | 'uom'>[]
        },
        enabled: !!activeProject,
    })

    const handleSapSelect = (ref: string) => {
        const sap = sapRefs.find(s => s.sap_boq_ref === ref)
        setForm(f => ({ ...f, sap_boq_ref: ref, material_code: sap?.material_code ?? '' }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const { error: err } = await supabase.from('warehouse_planning').insert([{
            project_id: activeProject.id,
            sap_boq_ref: form.sap_boq_ref, material_code: form.material_code,
            warehouse_location: form.warehouse_location,
            required_qty: parseFloat(form.required_qty),
            available_warehouse_qty: parseFloat(form.available_warehouse_qty || '0'),
            reserved_qty: parseFloat(form.reserved_qty || '0'),
            remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['warehouse_planning'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const needBuy = rows.filter(r => r.action_needed === 'BUY')
    const columns = [
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
        { key: 'material_code', header: 'Material', sortable: true },
        { key: 'warehouse_location', header: 'Location', sortable: true },
        { key: 'required_qty', header: 'Required', render: (v: number) => v?.toLocaleString() },
        { key: 'available_warehouse_qty', header: 'WH Avail', render: (v: number) => v?.toLocaleString() },
        { key: 'reserved_qty', header: 'Reserved', render: (v: number) => v?.toLocaleString() },
        { key: 'net_available_qty', header: 'Net Available', render: (v: number) => v?.toLocaleString() },
        { key: 'qty_to_procure', header: 'To Procure', render: (v: number) => <span style={{ color: v > 0 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>{v?.toLocaleString()}</span> },
        { key: 'action_needed', header: 'Action', render: (v: string) => <span style={{ color: v === 'BUY' ? '#ef4444' : '#34d399', fontWeight: 700, fontSize: '0.8rem' }}>{v}</span> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div>
                    <p className="section-title">Warehouse Planning</p>
                    <p className="section-subtitle">{rows.length} lines · <span style={{ color: '#ef4444' }}>{needBuy.length} items need procurement</span></p>
                </div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add Plan</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['sap_boq_ref', 'material_code', 'warehouse_location', 'action_needed']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Warehouse Planning Line" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="wh-form" type="submit">Save</button></>}
            >
                <form id="wh-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div className="col-span-2"><label className="form-label">SAP BOQ Ref *</label><select className="form-input" required value={form.sap_boq_ref} onChange={e => handleSapSelect(e.target.value)}><option value="">— Select —</option>{sapRefs.map(s => <option key={s.sap_boq_ref} value={s.sap_boq_ref}>{s.sap_boq_ref} — {s.material_code}</option>)}</select></div>
                    <div><label className="form-label">Material Code</label><input className="form-input" disabled value={form.material_code} /></div>
                    <div><label className="form-label">Warehouse Location *</label><select className="form-input" required value={form.warehouse_location} onChange={e => setForm(f => ({ ...f, warehouse_location: e.target.value }))}><option>WH1</option><option>WH2</option><option>Site Yard</option></select></div>
                    <div><label className="form-label">Required Qty *</label><input type="number" className="form-input" required min="0.01" step="0.01" value={form.required_qty} onChange={e => setForm(f => ({ ...f, required_qty: e.target.value }))} /></div>
                    <div><label className="form-label">Available at WH</label><input type="number" className="form-input" min="0" step="0.01" value={form.available_warehouse_qty} onChange={e => setForm(f => ({ ...f, available_warehouse_qty: e.target.value }))} /></div>
                    <div><label className="form-label">Reserved Qty</label><input type="number" className="form-input" min="0" step="0.01" value={form.reserved_qty} onChange={e => setForm(f => ({ ...f, reserved_qty: e.target.value }))} /></div>
                    <div>
                        <label className="form-label">Qty to Procure (calculated)</label>
                        <input className="form-input" disabled value={Math.max(0, parseFloat(form.required_qty || '0') - parseFloat(form.available_warehouse_qty || '0') - parseFloat(form.reserved_qty || '0')).toLocaleString()} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
