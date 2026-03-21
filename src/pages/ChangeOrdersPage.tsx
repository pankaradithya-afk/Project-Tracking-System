import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatDate, generateRecordId } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ChangeOrder } from '@/types'

const defaultForm = { co_date: new Date().toISOString().split('T')[0], boq_ref: '', change_type: 'Addition', description: '', qty_change: '', rate_change: '', remarks: '' }

export default function ChangeOrdersPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['change_order', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('change_order').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as ChangeOrder[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const co_no = generateRecordId('CO')
        const { error: err } = await supabase.from('change_order').insert([{
            co_no, co_date: form.co_date, project_id: activeProject.id,
            boq_ref: form.boq_ref || null, change_type: form.change_type,
            description: form.description, qty_change: parseFloat(form.qty_change),
            rate_change: form.rate_change ? parseFloat(form.rate_change) : null,
            remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['change_order'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const columns = [
        { key: 'co_no', header: 'CO No', sortable: true },
        { key: 'co_date', header: 'Date', render: (v: string) => formatDate(v) },
        { key: 'boq_ref', header: 'BOQ Ref', render: (v: string) => v ?? '—' },
        { key: 'change_type', header: 'Type', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'description', header: 'Description' },
        { key: 'qty_change', header: 'Qty Change', render: (v: number) => <span style={{ color: v >= 0 ? '#34d399' : '#ef4444' }}>{v > 0 ? '+' : ''}{v}</span> },
        { key: 'value_impact', header: 'Value Impact', render: (v: number) => v != null ? <span style={{ color: v >= 0 ? '#34d399' : '#ef4444' }}>₹{v?.toLocaleString()}</span> : '—' },
        { key: 'approval_status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Change Orders</p><p className="section-subtitle">{rows.length} change orders · {rows.filter(r => r.approval_status === 'Approved').length} approved</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> New CO</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['co_no', 'change_type', 'description', 'approval_status']}
                actions={(row) => row.approval_status === 'Draft' ? (
                    <button className="btn-secondary text-xs py-1 px-2" onClick={async () => {
                        await supabase.from('change_order').update({ approval_status: 'Submitted' }).eq('id', row.id)
                        qc.invalidateQueries({ queryKey: ['change_order'] })
                    }}>Submit</button>
                ) : row.approval_status === 'Submitted' ? (
                    <button className="btn-primary text-xs py-1 px-2" onClick={async () => {
                        const { data: { user } } = await supabase.auth.getUser()
                        await supabase.from('change_order').update({ approval_status: 'Approved', approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', row.id)
                        qc.invalidateQueries({ queryKey: ['change_order'] })
                    }}>Approve</button>
                ) : null}
            />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Change Order" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="co-form" type="submit">Create CO</button></>}
            >
                <form id="co-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div><label className="form-label">Date *</label><input type="date" className="form-input" required value={form.co_date} onChange={e => setForm(f => ({ ...f, co_date: e.target.value }))} /></div>
                    <div><label className="form-label">Change Type *</label><select className="form-input" value={form.change_type} onChange={e => setForm(f => ({ ...f, change_type: e.target.value }))}><option>Addition</option><option>Deletion</option><option>Revision</option></select></div>
                    <div><label className="form-label">BOQ Ref</label><input className="form-input" value={form.boq_ref} onChange={e => setForm(f => ({ ...f, boq_ref: e.target.value }))} /></div>
                    <div><label className="form-label">Qty Change *</label><input type="number" className="form-input" required step="0.01" value={form.qty_change} onChange={e => setForm(f => ({ ...f, qty_change: e.target.value }))} /></div>
                    <div><label className="form-label">Rate Change (₹)</label><input type="number" className="form-input" step="0.01" value={form.rate_change} onChange={e => setForm(f => ({ ...f, rate_change: e.target.value }))} /></div>
                    <div>
                        <label className="form-label">Value Impact</label>
                        <input className="form-input" disabled value={form.qty_change && form.rate_change ? `₹${(parseFloat(form.qty_change) * parseFloat(form.rate_change)).toLocaleString()}` : '—'} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Description *</label><textarea className="form-input" required rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
