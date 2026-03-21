import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatDate, generateRecordId } from '@/lib/utils'
import type { DCRegister, BOQSAPBreakup } from '@/types'

const defaultForm = { sap_boq_ref: '', material_code: '', dc_qty: '', from_location: 'WH1', to_site: '', remarks: '' }

export default function DCPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['dc_register', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('dc_register').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as DCRegister[]
        },
        enabled: !!activeProject,
    })

    const { data: sapRefs = [] } = useQuery({
        queryKey: ['sap_refs_dc', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('boq_sap_breakup').select('sap_boq_ref, material_code').eq('project_id', activeProject.id)
            return data as Pick<BOQSAPBreakup, 'sap_boq_ref' | 'material_code'>[]
        },
        enabled: !!activeProject,
    })

    const { data: stock = [] } = useQuery({
        queryKey: ['stock_check', activeProject?.id, form.material_code, form.from_location],
        queryFn: async () => {
            if (!activeProject || !form.material_code || !form.from_location) return []
            const { data } = await supabase.from('warehouse_stock').select('current_qty').eq('project_id', activeProject.id).eq('material_code', form.material_code).eq('location', form.from_location)
            return data as { current_qty: number }[]
        },
        enabled: !!activeProject && !!form.material_code && !!form.from_location,
    })

    const availableQty = stock[0]?.current_qty ?? 0

    const handleSapSelect = (ref: string) => {
        const sap = sapRefs.find(s => s.sap_boq_ref === ref)
        setForm(f => ({ ...f, sap_boq_ref: ref, material_code: sap?.material_code ?? '' }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        const qty = parseFloat(form.dc_qty)
        if (qty > availableQty) { setError(`Insufficient stock. Available: ${availableQty}`); return }
        setSaving(true); setError('')
        const dc_no = generateRecordId('DC')
        const { error: err } = await supabase.from('dc_register').insert([{
            dc_no, project_id: activeProject.id,
            sap_boq_ref: form.sap_boq_ref, material_code: form.material_code,
            dc_qty: qty, from_location: form.from_location,
            to_site: form.to_site, remarks: form.remarks,
        }])
        if (!err) {
            // Deduct from warehouse stock
            const newQty = availableQty - qty
            await supabase.from('warehouse_stock').update({ current_qty: newQty, last_updated: new Date().toISOString() })
                .eq('project_id', activeProject.id).eq('material_code', form.material_code).eq('location', form.from_location)
        }
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['dc_register'] })
        qc.invalidateQueries({ queryKey: ['warehouse_stock'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const columns = [
        { key: 'dc_no', header: 'DC No', sortable: true, width: '100px' },
        { key: 'dc_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
        { key: 'material_code', header: 'Material', sortable: true },
        { key: 'dc_qty', header: 'DC Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'from_location', header: 'From', sortable: true },
        { key: 'to_site', header: 'To Site', sortable: true },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Delivery Challans</p><p className="section-subtitle">{rows.length} DCs issued</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Issue DC</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['dc_no', 'sap_boq_ref', 'material_code', 'from_location', 'to_site']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Issue Delivery Challan" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="dc-form" type="submit">Issue DC</button></>}
            >
                <form id="dc-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div className="col-span-2">
                        <label className="form-label">SAP BOQ Ref *</label>
                        <select className="form-input" required value={form.sap_boq_ref} onChange={e => handleSapSelect(e.target.value)}>
                            <option value="">— Select SAP Ref —</option>
                            {sapRefs.map(s => <option key={s.sap_boq_ref} value={s.sap_boq_ref}>{s.sap_boq_ref} — {s.material_code}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Material Code</label>
                        <input className="form-input" disabled value={form.material_code} />
                    </div>
                    <div>
                        <label className="form-label">From Location *</label>
                        <select className="form-input" required value={form.from_location} onChange={e => setForm(f => ({ ...f, from_location: e.target.value }))}>
                            <option>WH1</option><option>WH2</option><option>Site Yard</option>
                        </select>
                    </div>
                    {form.material_code && (
                        <div className="col-span-2 p-3 rounded-lg" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Available stock at {form.from_location}</p>
                            <p className="text-lg font-bold" style={{ color: availableQty > 0 ? '#34d399' : '#f87171' }}>{availableQty.toLocaleString()}</p>
                        </div>
                    )}
                    <div>
                        <label className="form-label">DC Qty * (max: {availableQty})</label>
                        <input type="number" className="form-input" required min="0.01" max={availableQty} step="0.01" value={form.dc_qty} onChange={e => setForm(f => ({ ...f, dc_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">To Site *</label>
                        <input className="form-input" required value={form.to_site} onChange={e => setForm(f => ({ ...f, to_site: e.target.value }))} placeholder="e.g. Golf Course - Fairway 5" />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
