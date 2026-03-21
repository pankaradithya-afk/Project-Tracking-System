import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { InvoiceRegister, DCRegister } from '@/types'

const defaultForm = { invoice_no: '', invoice_date: '', invoice_type: 'Material', boq_ref: '', sap_boq_ref: '', dc_ref: '', billed_qty: '', rate: '', gst_amount: '0', remarks: '' }

export default function InvoicesPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['invoice_register', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('invoice_register').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as InvoiceRegister[]
        },
        enabled: !!activeProject,
    })

    const { data: dcs = [] } = useQuery({
        queryKey: ['dc_list', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('dc_register').select('dc_no, material_code, dc_qty').eq('project_id', activeProject.id).order('dc_no')
            return data as Pick<DCRegister, 'dc_no' | 'material_code' | 'dc_qty'>[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        if (form.invoice_type === 'Material' && !form.dc_ref) {
            setError('Material invoices require a DC reference.')
            return
        }
        setSaving(true); setError('')
        const { error: err } = await supabase.from('invoice_register').insert([{
            invoice_no: form.invoice_no, invoice_date: form.invoice_date,
            invoice_type: form.invoice_type, project_id: activeProject.id,
            boq_ref: form.boq_ref || null, sap_boq_ref: form.sap_boq_ref || null,
            dc_ref: form.invoice_type === 'Material' ? form.dc_ref : null,
            billed_qty: parseFloat(form.billed_qty), rate: form.rate ? parseFloat(form.rate) : null,
            gst_amount: parseFloat(form.gst_amount || '0'),
            status: 'Draft', remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['invoice_register'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const totalValue = rows.reduce((s, r) => s + (r.total_invoice ?? 0), 0)
    const certifiedValue = rows.filter(r => ['Certified', 'Paid'].includes(r.status)).reduce((s, r) => s + (r.total_invoice ?? 0), 0)

    const columns = [
        { key: 'invoice_no', header: 'Invoice No', sortable: true },
        { key: 'invoice_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'invoice_type', header: 'Type', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'dc_ref', header: 'DC Ref', render: (v: string) => v ?? '—' },
        { key: 'billed_qty', header: 'Billed Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'invoice_value', header: 'Invoice Value', render: (v: number) => formatCurrency(v) },
        { key: 'gst_amount', header: 'GST', render: (v: number) => formatCurrency(v) },
        { key: 'total_invoice', header: 'Total', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div>
                    <p className="section-title">Invoice Register</p>
                    <p className="section-subtitle">Total: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalValue)}</strong> · Certified: <strong style={{ color: '#34d399' }}>{formatCurrency(certifiedValue)}</strong></p>
                </div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add Invoice</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['invoice_no', 'invoice_type', 'dc_ref', 'status']}
                actions={(row) => row.status === 'Draft' ? (
                    <button className="btn-secondary text-xs py-1 px-2" onClick={async () => {
                        await supabase.from('invoice_register').update({ status: 'Submitted' }).eq('id', row.id)
                        qc.invalidateQueries({ queryKey: ['invoice_register'] })
                    }}>Submit</button>
                ) : row.status === 'Submitted' ? (
                    <button className="btn-primary text-xs py-1 px-2" onClick={async () => {
                        await supabase.from('invoice_register').update({ status: 'Certified', certified_date: new Date().toISOString().split('T')[0] }).eq('id', row.id)
                        qc.invalidateQueries({ queryKey: ['invoice_register'] })
                    }}>Certify</button>
                ) : null}
            />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Invoice" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="inv-form" type="submit">Save Invoice</button></>}
            >
                <form id="inv-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div>
                        <label className="form-label">Invoice No *</label>
                        <input className="form-input" required value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Invoice Date *</label>
                        <input type="date" className="form-input" required value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Invoice Type *</label>
                        <select className="form-input" value={form.invoice_type} onChange={e => setForm(f => ({ ...f, invoice_type: e.target.value }))}>
                            <option>Material</option><option>Service</option>
                        </select>
                    </div>
                    {form.invoice_type === 'Material' && (
                        <div>
                            <label className="form-label">DC Reference * (required for Material)</label>
                            <select className="form-input" value={form.dc_ref} onChange={e => setForm(f => ({ ...f, dc_ref: e.target.value }))}>
                                <option value="">— Select DC —</option>
                                {dcs.map(d => <option key={d.dc_no} value={d.dc_no}>{d.dc_no} — {d.material_code} ({d.dc_qty})</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="form-label">Billed Qty *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.billed_qty} onChange={e => setForm(f => ({ ...f, billed_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Rate (₹)</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">GST Amount (₹)</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.gst_amount} onChange={e => setForm(f => ({ ...f, gst_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Total Invoice Value</label>
                        <input className="form-input" disabled value={form.billed_qty && form.rate ? formatCurrency(parseFloat(form.billed_qty) * parseFloat(form.rate) + parseFloat(form.gst_amount || '0')) : '—'} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
