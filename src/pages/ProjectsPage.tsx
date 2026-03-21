import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, Settings, CheckCircle } from 'lucide-react'
import { formatCurrency, formatDate, generateProjectId } from '@/lib/utils'
import type { Project } from '@/types'

async function fetchProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as Project[]
}

const defaultForm = {
    project_name: '', client: '', location: '', wo_number: '',
    wo_date: '', wo_value: '', status: 'Active', remarks: '',
}

export default function ProjectsPage() {
    const qc = useQueryClient()
    const { activeProject, setActiveProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        const project_id = generateProjectId()

        const { error: err } = await supabase.from('projects').insert([{
            ...form,
            project_id,
            wo_value: parseFloat(form.wo_value),
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['projects'] })
        setModalOpen(false)
        setForm(defaultForm)
    }

    const columns = [
        { key: 'project_id', header: 'Project ID', sortable: true, width: '120px' },
        { key: 'project_name', header: 'Name', sortable: true },
        { key: 'client', header: 'Client', sortable: true },
        { key: 'wo_number', header: 'WO #', sortable: true },
        { key: 'wo_date', header: 'WO Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'wo_value', header: 'WO Value', render: (v: number) => formatCurrency(v), sortable: true },
        { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'location', header: 'Location' },
    ]

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div>
                    <p className="section-title">Projects</p>
                    <p className="section-subtitle">{projects.length} project(s) found</p>
                </div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}>
                    <Plus size={15} /> New Project
                </button>
            </div>

            {activeProject && (
                <div className="glass-card p-3 flex items-center gap-3" style={{ borderColor: 'rgba(20,184,166,0.3)' }}>
                    <CheckCircle size={16} style={{ color: 'var(--color-brand-400)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-surface-200)' }}>
                        Active: <strong style={{ color: 'var(--color-brand-300)' }}>{activeProject.project_id} — {activeProject.project_name}</strong>
                    </p>
                </div>
            )}

            <DataTable
                columns={columns}
                data={projects}
                loading={isLoading}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search by name, client, WO#..."
                filterKeys={['project_name', 'client', 'project_id', 'wo_number']}
                actions={(row) => (
                    <div className="flex items-center gap-2">
                        <button
                            className="btn-secondary text-xs py-1 px-2"
                            onClick={(e) => { e.stopPropagation(); setActiveProject(row) }}
                            title="Set as active project"
                        >
                            <Settings size={12} />
                            {activeProject?.id === row.id ? 'Active ✓' : 'Set Active'}
                        </button>
                    </div>
                )}
            />

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Project" maxWidth="lg" loading={saving}
                footer={<>
                    <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button className="btn-primary" form="project-form" type="submit">Create Project</button>
                </>}
            >
                <form id="project-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div className="col-span-2">
                        <label className="form-label">Project Name *</label>
                        <input className="form-input" required value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Client *</label>
                        <input className="form-input" required value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Location</label>
                        <input className="form-input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">WO Number *</label>
                        <input className="form-input" required value={form.wo_number} onChange={e => setForm(p => ({ ...p, wo_number: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">WO Date *</label>
                        <input type="date" className="form-input" required value={form.wo_date} onChange={e => setForm(p => ({ ...p, wo_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">WO Value (₹) *</label>
                        <input type="number" className="form-input" required min="1" step="0.01" value={form.wo_value} onChange={e => setForm(p => ({ ...p, wo_value: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Status</label>
                        <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                            <option>Active</option><option>On Hold</option><option>Completed</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">Remarks</label>
                        <textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
                    </div>
                </form>
            </Modal>
        </div>
    )
}
