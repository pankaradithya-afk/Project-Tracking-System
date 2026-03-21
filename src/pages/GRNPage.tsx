import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, generateRecordId } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { GRNRegister, PurchaseOrder } from '@/types'

const defaultForm = { po_ref: '', received_qty: '', accepted_qty: '', inspection_status: 'Pending', receipt_location: 'WH1', unit_rate: '', transport_cost: '0', remarks: '' }

export default function GRNPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['grn_register', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('grn_register').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as GRNRegister[]
        },
        enabled: !!activeProject,
    })

    const { data: openPOs = [] } = useQuery({
        queryKey: ['open_pos', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('purchase_order').select('po_no, sap_boq_ref, material_code, po_qty, po_rate').eq('project_id', activeProject.id).not('po_status', 'in', '("Closed","Cancelled")')
            return data as Pick<PurchaseOrder, 'po_no' | 'sap_boq_ref' | 'material_code' | 'po_qty' | 'po_rate'>[]
        },
        enabled: !!activeProject,
    })

    const selectedPO = openPOs.find(p => p.po_no === form.po_ref)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject || !selectedPO) return
        setSaving(true); setError('')
        const grn_no = generateRecordId('GRN')
        const accepted = parseFloat(form.accepted_qty)
        const received = parseFloat(form.received_qty)
        const unit_rate = form.unit_rate ? parseFloat(form.unit_rate) : selectedPO.po_rate

        const { error: err } = await supabase.from('grn_register').insert([{
            grn_no, project_id: activeProject.id,
            po_ref: form.po_ref,
            sap_boq_ref: selectedPO.sap_boq_ref,
            material_code: selectedPO.material_code,
            received_qty: received, accepted_qty: accepted,
            inspection_status: form.inspection_status,
            receipt_location: form.receipt_location,
            unit_rate, transport_cost: parseFloat(form.transport_cost || '0'),
            remarks: form.remarks,
        }])

        if (!err) {
            const { data: existingStock } = await supabase
                .from('warehouse_stock')
                .select('current_qty, weighted_avg_cost')
                .eq('project_id', activeProject.id)
                .eq('material_code', selectedPO.material_code)
                .eq('location', form.receipt_location)
                .maybeSingle()

            const currentQty = existingStock?.current_qty ?? 0
            const newQty = currentQty + accepted
            const weightedAvgCost = newQty > 0
                ? (((currentQty * (existingStock?.weighted_avg_cost ?? 0)) + (accepted * unit_rate)) / newQty)
                : unit_rate

            await supabase.from('warehouse_stock').upsert({
                project_id: activeProject.id,
                material_code: selectedPO.material_code,
                location: form.receipt_location,
                current_qty: newQty,
                weighted_avg_cost: weightedAvgCost,
                last_updated: new Date().toISOString(),
            }, { onConflict: 'project_id,material_code,location', ignoreDuplicates: false })
        }

        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['grn_register'] })
        qc.invalidateQueries({ queryKey: ['warehouse_stock'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const columns = [
        { key: 'grn_no', header: 'GRN No', sortable: true, width: '100px' },
        { key: 'grn_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'po_ref', header: 'PO Ref', sortable: true },
        { key: 'material_code', header: 'Material', sortable: true },
        { key: 'received_qty', header: 'Received', render: (v: number) => v?.toLocaleString() },
        { key: 'accepted_qty', header: 'Accepted', render: (v: number) => v?.toLocaleString() },
        { key: 'rejected_qty', header: 'Rejected', render: (v: number) => <span style={{ color: v > 0 ? '#f87171' : 'inherit' }}>{v?.toLocaleString()}</span> },
        { key: 'receipt_location', header: 'Location', sortable: true },
        { key: 'total_grn_value', header: 'GRN Value', render: (v: number) => formatCurrency(v) },
        { key: 'inspection_status', header: 'Inspection', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">GRN Register</p><p className="section-subtitle">{rows.length} receipts logged</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> New GRN</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['grn_no', 'po_ref', 'material_code', 'receipt_location']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Goods Receipt (GRN)" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="grn-form" type="submit">Create GRN</button></>}
            >
                <form id="grn-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div className="col-span-2">
                        <label className="form-label">Purchase Order *</label>
                        <select className="form-input" required value={form.po_ref} onChange={e => setForm(f => ({ ...f, po_ref: e.target.value }))}>
                            <option value="">â€” Select Open PO â€”</option>
                            {openPOs.map(p => <option key={p.po_no} value={p.po_no}>{p.po_no} â€” {p.material_code} (Ordered: {p.po_qty})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Received Qty *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.received_qty} onChange={e => setForm(f => ({ ...f, received_qty: e.target.value, accepted_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Accepted Qty *</label>
                        <input type="number" className="form-input" required min="0" step="0.01" max={form.received_qty} value={form.accepted_qty} onChange={e => setForm(f => ({ ...f, accepted_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Rejected Qty</label>
                        <input className="form-input" disabled value={form.received_qty && form.accepted_qty ? parseFloat(form.received_qty) - parseFloat(form.accepted_qty) : 0} />
                    </div>
                    <div>
                        <label className="form-label">Inspection Status</label>
                        <select className="form-input" value={form.inspection_status} onChange={e => setForm(f => ({ ...f, inspection_status: e.target.value }))}>
                            <option>Pending</option><option>Accepted</option><option>Rejected</option><option>Partial</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Receipt Location *</label>
                        <select className="form-input" required value={form.receipt_location} onChange={e => setForm(f => ({ ...f, receipt_location: e.target.value }))}>
                            <option>WH1</option><option>WH2</option><option>Site</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Unit Rate (â‚¹)</label>
                        <input type="number" className="form-input" step="0.01" min="0" value={form.unit_rate} placeholder={selectedPO ? `PO Rate: ${selectedPO.po_rate}` : ''} onChange={e => setForm(f => ({ ...f, unit_rate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Transport Cost (â‚¹)</label>
                        <input type="number" className="form-input" step="0.01" min="0" value={form.transport_cost} onChange={e => setForm(f => ({ ...f, transport_cost: e.target.value }))} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
