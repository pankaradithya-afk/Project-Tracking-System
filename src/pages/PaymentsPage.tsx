import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, generateRecordId } from '@/lib/utils'
import type { PaymentTracker, InvoiceRegister } from '@/types'

const defaultForm = { invoice_ref: '', payment_date: '', payment_amount: '', payment_mode: 'Bank Transfer', transaction_ref: '', remarks: '' }

export default function PaymentsPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['payment_tracker', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data: projectInvoices } = await supabase
                .from('invoice_register')
                .select('invoice_no')
                .eq('project_id', activeProject.id)

            const invoiceNos = (projectInvoices ?? []).map((invoice) => invoice.invoice_no)
            if (invoiceNos.length === 0) return []

            const { data } = await supabase
                .from('payment_tracker')
                .select('*')
                .in('invoice_ref', invoiceNos)
                .order('payment_date', { ascending: false })
            return data as PaymentTracker[]
        },
        enabled: !!activeProject,
    })

    const { data: certifiedInvoices = [] } = useQuery({
        queryKey: ['certified_invoices', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('invoice_register').select('invoice_no, total_invoice, status').eq('project_id', activeProject.id).in('status', ['Certified', 'Submitted'])
            return data as Pick<InvoiceRegister, 'invoice_no' | 'total_invoice' | 'status'>[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError('')
        const payment_id = generateRecordId('PAY')
        const { error: err } = await supabase.from('payment_tracker').insert([{
            payment_id, invoice_ref: form.invoice_ref,
            payment_date: form.payment_date, payment_amount: parseFloat(form.payment_amount),
            payment_mode: form.payment_mode, transaction_ref: form.transaction_ref || null,
            remarks: form.remarks,
        }])
        if (!err) {
            await supabase.from('invoice_register').update({ status: 'Paid' }).eq('invoice_no', form.invoice_ref)
        }
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['payment_tracker'] })
        qc.invalidateQueries({ queryKey: ['invoice_register'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const totalPaid = rows.reduce((s, r) => s + r.payment_amount, 0)
    const columns = [
        { key: 'payment_id', header: 'Payment ID', sortable: true },
        { key: 'invoice_ref', header: 'Invoice Ref', sortable: true },
        { key: 'payment_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'payment_amount', header: 'Amount', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'payment_mode', header: 'Mode' },
        { key: 'transaction_ref', header: 'Txn Ref', render: (v: string) => v ?? '—' },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Payment Tracker</p><p className="section-subtitle">Total Collected: <strong style={{ color: '#34d399' }}>{formatCurrency(totalPaid)}</strong></p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Record Payment</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['payment_id', 'invoice_ref', 'payment_mode']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Payment" maxWidth="md" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="pay-form" type="submit">Save</button></>}
            >
                <form id="pay-form" onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div>
                        <label className="form-label">Invoice Reference *</label>
                        <select className="form-input" required value={form.invoice_ref} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))}>
                            <option value="">— Select Certified Invoice —</option>
                            {certifiedInvoices.map(i => <option key={i.invoice_no} value={i.invoice_no}>{i.invoice_no} — {formatCurrency(i.total_invoice ?? 0)} ({i.status})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Payment Date *</label>
                        <input type="date" className="form-input" required value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Amount (₹) *</label>
                        <input type="number" className="form-input" required min="0.01" step="0.01" value={form.payment_amount} onChange={e => setForm(f => ({ ...f, payment_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Payment Mode *</label>
                        <select className="form-input" value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                            <option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Transaction Ref</label>
                        <input className="form-input" value={form.transaction_ref} onChange={e => setForm(f => ({ ...f, transaction_ref: e.target.value }))} placeholder="UTR / Cheque No" />
                    </div>
                </form>
            </Modal>
        </div>
    )
}
