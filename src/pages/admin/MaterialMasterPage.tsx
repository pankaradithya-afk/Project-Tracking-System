import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { Plus } from 'lucide-react'
import type { MaterialMaster } from '@/types'

const defaultForm = { material_code: '', material_description: '', category: 'Raw', uom: '', remarks: '' }

export default function MaterialMasterPage() {
    const qc = useQueryClient()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['material_master'],
        queryFn: async () => {
            const { data } = await supabase.from('material_master').select('*').order('material_code')
            return data as MaterialMaster[]
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError('')
        const { error: err } = await supabase.from('material_master').insert([{ ...form }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['material_master'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const handleToggleActive = async (row: MaterialMaster) => {
        await supabase.from('material_master').update({ active_status: !row.active_status }).eq('id', row.id)
        qc.invalidateQueries({ queryKey: ['material_master'] })
    }

    const columns = [
        { key: 'material_code', header: 'Code', sortable: true, width: '120px' },
        { key: 'material_description', header: 'Description', sortable: true },
        { key: 'category', header: 'Category', sortable: true },
        { key: 'uom', header: 'UOM', width: '80px' },
        { key: 'active_status', header: 'Active', render: (v: boolean) => <span style={{ color: v ? '#34d399' : '#f87171', fontWeight: 600 }}>{v ? 'Active' : 'Inactive'}</span> },
    ]

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Material Master</p><p className="section-subtitle">{rows.length} materials</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add Material</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['material_code', 'material_description', 'category']}
                actions={(row) => <button className="btn-secondary text-xs py-1 px-2" onClick={() => handleToggleActive(row)}>{row.active_status ? 'Deactivate' : 'Activate'}</button>}
            />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Material" maxWidth="md" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="mat-form" type="submit">Save</button></>}
            >
                <form id="mat-form" onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div><label className="form-label">Material Code * (e.g. MAT-001)</label><input className="form-input" required value={form.material_code} onChange={e => setForm(f => ({ ...f, material_code: e.target.value }))} /></div>
                    <div><label className="form-label">Description *</label><input className="form-input" required value={form.material_description} onChange={e => setForm(f => ({ ...f, material_description: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="form-label">Category</label><select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option>Raw</option><option>Consumable</option><option>Equipment</option><option>Finished</option></select></div>
                        <div><label className="form-label">UOM *</label><input className="form-input" required value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} placeholder="Nos, m, kg, L..." /></div>
                    </div>
                    <div><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
