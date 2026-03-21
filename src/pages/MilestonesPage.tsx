import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatDate, generateRecordId } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ScheduleMilestone } from '@/types'

const defaultForm = { milestone_name: '', boq_ref: '', planned_start: '', planned_finish: '', completion_percent: '0', remarks: '' }

export default function MilestonesPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['schedule_milestones', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('schedule_milestones').select('*').eq('project_id', activeProject.id).order('planned_start')
            return data as ScheduleMilestone[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const milestone_id = generateRecordId('MS')
        const { error: err } = await supabase.from('schedule_milestones').insert([{
            milestone_id, project_id: activeProject.id,
            milestone_name: form.milestone_name, boq_ref: form.boq_ref || null,
            planned_start: form.planned_start, planned_finish: form.planned_finish,
            completion_percent: parseFloat(form.completion_percent), remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['schedule_milestones'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const columns = [
        { key: 'milestone_id', header: 'ID', sortable: true, width: '90px' },
        { key: 'milestone_name', header: 'Milestone', sortable: true },
        { key: 'planned_start', header: 'Planned Start', render: (v: string) => formatDate(v) },
        { key: 'planned_finish', header: 'Planned Finish', render: (v: string) => formatDate(v) },
        { key: 'actual_finish', header: 'Actual Finish', render: (v: string) => v ? formatDate(v) : '—' },
        {
            key: 'completion_percent', header: '% Done', render: (v: number) => (
                <div className="flex items-center gap-2"><div className="progress-bar w-14"><div className="progress-fill progress-fill-teal" style={{ width: `${v}%` }} /></div><span className="text-xs">{v?.toFixed(0)}%</span></div>
            )
        },
        { key: 'delay_days', header: 'Delay', render: (v: number) => v > 0 ? <span style={{ color: '#ef4444' }}>+{v}d</span> : '—' },
        { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Schedule Milestones</p><p className="section-subtitle">{rows.length} milestones — {rows.filter(r => r.status === 'Delayed').length} delayed</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add Milestone</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['milestone_name', 'status']}
                actions={(row) => (
                    <button className="btn-secondary text-xs py-1 px-2" onClick={async () => {
                        const p = prompt('Update completion % (0-100):', String(row.completion_percent))
                        if (!p) return
                        await supabase.from('schedule_milestones').update({ completion_percent: parseFloat(p) }).eq('id', row.id)
                        qc.invalidateQueries({ queryKey: ['schedule_milestones'] })
                    }}>Update %</button>
                )}
            />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Milestone" maxWidth="md" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="ms-form" type="submit">Save</button></>}
            >
                <form id="ms-form" onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div><label className="form-label">Milestone Name *</label><input className="form-input" required value={form.milestone_name} onChange={e => setForm(f => ({ ...f, milestone_name: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="form-label">Planned Start *</label><input type="date" className="form-input" required value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} /></div>
                        <div><label className="form-label">Planned Finish *</label><input type="date" className="form-input" required value={form.planned_finish} onChange={e => setForm(f => ({ ...f, planned_finish: e.target.value }))} /></div>
                    </div>
                    <div><label className="form-label">BOQ Ref (optional)</label><input className="form-input" value={form.boq_ref} onChange={e => setForm(f => ({ ...f, boq_ref: e.target.value }))} /></div>
                    <div><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
