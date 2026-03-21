import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Plus } from 'lucide-react'
import type { VendorMaster } from '@/types'

const defaultForm = { vendor_code: '', vendor_name: '', category: 'Material', contact_person: '', phone: '', email: '', address: '', gst_no: '', pan_no: '', payment_terms: '30', remarks: '' }

export default function VendorMasterPage() {
    const qc = useQueryClient()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['vendor_master'],
        queryFn: async () => {
            const { data } = await supabase.from('vendor_master').select('*').order('vendor_code')
            return data as VendorMaster[]
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError('')
        const { error: err } = await supabase.from('vendor_master').insert([{ ...form, payment_terms: parseInt(form.payment_terms || '30') }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['vendor_master'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const columns = [
        { key: 'vendor_code', header: 'Code', sortable: true },
        { key: 'vendor_name', header: 'Name', sortable: true },
        { key: 'category', header: 'Category', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'contact_person', header: 'Contact', render: (v: string) => v ?? '—' },
        { key: 'phone', header: 'Phone', render: (v: string) => v ?? '—' },
        { key: 'email', header: 'Email', render: (v: string) => v ?? '—' },
        { key: 'payment_terms', header: 'Payment Terms', render: (v: number) => `${v} days` },
        { key: 'performance_rating', header: 'Rating', render: (v: number) => v ? `★ ${v.toFixed(1)}` : '—' },
        { key: 'active_status', header: 'Status', render: (v: boolean) => <span style={{ color: v ? '#34d399' : '#f87171', fontWeight: 600 }}>{v ? 'Active' : 'Inactive'}</span> },
    ]

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Vendor Master</p><p className="section-subtitle">{rows.length} vendors</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add Vendor</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['vendor_code', 'vendor_name', 'category', 'contact_person']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Vendor" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="ven-form" type="submit">Save</button></>}
            >
                <form id="ven-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div><label className="form-label">Vendor Code * (e.g. VND-001)</label><input className="form-input" required value={form.vendor_code} onChange={e => setForm(f => ({ ...f, vendor_code: e.target.value }))} /></div>
                    <div><label className="form-label">Vendor Name *</label><input className="form-input" required value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} /></div>
                    <div><label className="form-label">Category *</label><select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option>Material</option><option>Service</option><option>Subcontract</option><option>Equipment</option></select></div>
                    <div><label className="form-label">Payment Terms (days)</label><input type="number" className="form-input" min="0" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} /></div>
                    <div><label className="form-label">Contact Person</label><input className="form-input" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
                    <div><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><label className="form-label">GST No</label><input className="form-input" value={form.gst_no} onChange={e => setForm(f => ({ ...f, gst_no: e.target.value }))} /></div>
                    <div><label className="form-label">PAN No</label><input className="form-input" value={form.pan_no} onChange={e => setForm(f => ({ ...f, pan_no: e.target.value }))} /></div>
                    <div className="col-span-2"><label className="form-label">Address</label><textarea className="form-input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
