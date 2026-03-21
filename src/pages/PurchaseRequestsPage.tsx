import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatDate, generateRecordId } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { PurchaseRequest, BOQSAPBreakup } from '@/types'

const defaultForm = {
    sap_boq_ref: '', material_code: '', pr_qty: '', uom: '',
    required_date: '', priority: 'Medium', justification: '', remarks: '',
}

export default function PurchaseRequestsPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['purchase_request', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('purchase_request').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as PurchaseRequest[]
        },
        enabled: !!activeProject,
    })

    const { data: sapRefs = [] } = useQuery({
        queryKey: ['sap_refs', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('boq_sap_breakup').select('sap_boq_ref, material_code, uom').eq('project_id', activeProject.id)
            return data as Pick<BOQSAPBreakup, 'sap_boq_ref' | 'material_code' | 'uom'>[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const pr_no = generateRecordId('PR')
        const { data: { user } } = await supabase.auth.getUser()
        const { error: err } = await supabase.from('purchase_request').insert([{
            pr_no, project_id: activeProject.id,
            sap_boq_ref: form.sap_boq_ref, material_code: form.material_code,
            pr_qty: parseFloat(form.pr_qty), uom: form.uom,
            required_date: form.required_date, priority: form.priority,
            justification: form.justification, remarks: form.remarks,
            requested_by: user?.id, status: 'Draft',
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['purchase_request'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const handleSapSelect = (ref: string) => {
        const sap = sapRefs.find(s => s.sap_boq_ref === ref)
        setForm(p => ({ ...p, sap_boq_ref: ref, material_code: sap?.material_code ?? '', uom: sap?.uom ?? '' }))
    }

    const handleApprove = async (pr: PurchaseRequest) => {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('purchase_request').update({ status: 'Approved', approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', pr.id)
        qc.invalidateQueries({ queryKey: ['purchase_request'] })
    }

    const handleReject = async (pr: PurchaseRequest) => {
        await supabase.from('purchase_request').update({ status: 'Rejected' }).eq('id', pr.id)
        qc.invalidateQueries({ queryKey: ['purchase_request'] })
    }

    const columns = [
        { key: 'pr_no', header: 'PR No', sortable: true, width: '100px' },
        { key: 'pr_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
        { key: 'material_code', header: 'Material', sortable: true },
        { key: 'pr_qty', header: 'Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'uom', header: 'UOM', width: '70px' },
        { key: 'required_date', header: 'Required By', render: (v: string) => formatDate(v), sortable: true },
        { key: 'priority', header: 'Priority', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Purchase Requests</p><p className="section-subtitle">{rows.length} PRs — {rows.filter(r => r.status === 'Approved').length} approved, {rows.filter(r => r.status === 'Draft').length} pending</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Create PR</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id}
                searchPlaceholder="Search PR..." filterKeys={['pr_no', 'sap_boq_ref', 'material_code', 'status']}
                actions={(row) => (
                    row.status === 'Submitted' ? (
                        <div className="flex gap-2">
                            <button className="btn-primary text-xs py-1 px-2" onClick={() => handleApprove(row)}>Approve</button>
                            <button className="btn-danger text-xs py-1 px-2" onClick={() => handleReject(row)}>Reject</button>
                        </div>
                    ) : row.status === 'Draft' ? (
                        <button className="btn-secondary text-xs py-1 px-2" onClick={async () => {
                            await supabase.from('purchase_request').update({ status: 'Submitted' }).eq('id', row.id)
                            qc.invalidateQueries({ queryKey: ['purchase_request'] })
                        }}>Submit</button>
                    ) : null
                )}
            />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Purchase Request" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="pr-form" type="submit">Create PR</button></>}
            >
                <form id="pr-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
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
                        <label className="form-label">UOM</label>
                        <input className="form-input" disabled value={form.uom} />
                    </div>
                    <div>
                        <label className="form-label">PR Qty *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.pr_qty} onChange={e => setForm(p => ({ ...p, pr_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Required By Date *</label>
                        <input type="date" className="form-input" required value={form.required_date} onChange={e => setForm(p => ({ ...p, required_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Priority</label>
                        <select className="form-input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}><option>High</option><option>Medium</option><option>Low</option></select>
                    </div>
                    <div className="col-span-2"><label className="form-label">Justification</label><textarea className="form-input" rows={2} value={form.justification} onChange={e => setForm(p => ({ ...p, justification: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
