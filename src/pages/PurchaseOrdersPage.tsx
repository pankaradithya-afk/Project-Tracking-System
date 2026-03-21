import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, generateRecordId } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { PurchaseOrder, PurchaseRequest, VendorMaster } from '@/types'

const defaultForm = {
    pr_ref: '', sap_boq_ref: '', material_code: '', vendor_code: '',
    po_qty: '', po_rate: '', tax_amount: '0', freight_amount: '0',
    expected_delivery: '', uom: '', remarks: '',
}

export default function PurchaseOrdersPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['purchase_order', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('purchase_order').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as PurchaseOrder[]
        },
        enabled: !!activeProject,
    })

    const { data: approvedPRs = [] } = useQuery({
        queryKey: ['approved_prs', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('purchase_request').select('pr_no, sap_boq_ref, material_code, uom, pr_qty').eq('project_id', activeProject.id).eq('status', 'Approved')
            return data as Pick<PurchaseRequest, 'pr_no' | 'sap_boq_ref' | 'material_code' | 'uom' | 'pr_qty'>[]
        },
        enabled: !!activeProject,
    })

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: async () => {
            const { data } = await supabase.from('vendor_master').select('vendor_code, vendor_name').eq('active_status', true).order('vendor_code')
            return data as Pick<VendorMaster, 'vendor_code' | 'vendor_name'>[]
        },
    })

    const handlePRSelect = (prNo: string) => {
        const pr = approvedPRs.find(p => p.pr_no === prNo)
        setForm(f => ({ ...f, pr_ref: prNo, sap_boq_ref: pr?.sap_boq_ref ?? '', material_code: pr?.material_code ?? '', uom: pr?.uom ?? '', po_qty: String(pr?.pr_qty ?? '') }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const po_no = generateRecordId('PO')
        const { error: err } = await supabase.from('purchase_order').insert([{
            po_no, project_id: activeProject.id,
            pr_ref: form.pr_ref || null,
            sap_boq_ref: form.sap_boq_ref, material_code: form.material_code,
            vendor_code: form.vendor_code || null,
            po_qty: parseFloat(form.po_qty), po_rate: parseFloat(form.po_rate),
            tax_amount: parseFloat(form.tax_amount), freight_amount: parseFloat(form.freight_amount),
            expected_delivery: form.expected_delivery || null,
            remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        // Update PR status
        if (form.pr_ref) await supabase.from('purchase_request').update({ status: 'PO Created' }).eq('pr_no', form.pr_ref)
        qc.invalidateQueries({ queryKey: ['purchase_order'] })
        qc.invalidateQueries({ queryKey: ['purchase_request'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const totalValue = rows.reduce((s, r) => s + (r.total_po_value ?? 0), 0)

    const columns = [
        { key: 'po_no', header: 'PO No', sortable: true, width: '100px' },
        { key: 'po_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
        { key: 'material_code', header: 'Material', sortable: true },
        { key: 'vendor_code', header: 'Vendor', sortable: true },
        { key: 'po_qty', header: 'Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'po_rate', header: 'Rate', render: (v: number) => formatCurrency(v) },
        { key: 'total_po_value', header: 'Total Value', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'expected_delivery', header: 'Expected', render: (v: string) => formatDate(v) },
        { key: 'po_status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'delivery_status', header: 'Delivery', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Purchase Orders</p><p className="section-subtitle">Total PO Value: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalValue)}</strong></p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Create PO</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id}
                searchPlaceholder="Search PO..." filterKeys={['po_no', 'sap_boq_ref', 'material_code', 'vendor_code']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Purchase Order" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="po-form" type="submit">Create PO</button></>}
            >
                <form id="po-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div className="col-span-2">
                        <label className="form-label">Link PR (Approved only)</label>
                        <select className="form-input" value={form.pr_ref} onChange={e => handlePRSelect(e.target.value)}>
                            <option value="">— No PR Link (direct PO) —</option>
                            {approvedPRs.map(p => <option key={p.pr_no} value={p.pr_no}>{p.pr_no} — {p.sap_boq_ref} ({p.material_code})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">SAP BOQ Ref *</label>
                        <input className="form-input" required value={form.sap_boq_ref} onChange={e => setForm(f => ({ ...f, sap_boq_ref: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Material Code *</label>
                        <input className="form-input" required value={form.material_code} onChange={e => setForm(f => ({ ...f, material_code: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Vendor</label>
                        <select className="form-input" value={form.vendor_code} onChange={e => setForm(f => ({ ...f, vendor_code: e.target.value }))}>
                            <option value="">— Select Vendor —</option>
                            {vendors.map(v => <option key={v.vendor_code} value={v.vendor_code}>{v.vendor_code} — {v.vendor_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">PO Qty *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.po_qty} onChange={e => setForm(f => ({ ...f, po_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">PO Rate (₹) *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.po_rate} onChange={e => setForm(f => ({ ...f, po_rate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Tax Amount (₹)</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Freight Amount (₹)</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.freight_amount} onChange={e => setForm(f => ({ ...f, freight_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Total PO Value</label>
                        <input className="form-input" disabled value={
                            form.po_qty && form.po_rate
                                ? formatCurrency(parseFloat(form.po_qty) * parseFloat(form.po_rate) + parseFloat(form.tax_amount || '0') + parseFloat(form.freight_amount || '0'))
                                : '—'
                        } />
                    </div>
                    <div>
                        <label className="form-label">Expected Delivery</label>
                        <input type="date" className="form-input" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
