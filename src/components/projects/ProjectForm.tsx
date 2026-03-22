import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { Project, ProjectStatus } from '@/types'
import { createProject, updateProject } from '@/services/projectService'
import { getStatusColor, cn } from '@/lib/utils'

const STATUS_OPTIONS: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'archived']

type ProjectFormValues = {
    name: string
    description: string
    status: ProjectStatus
    start_date: string
    end_date: string
}

interface ProjectFormProps {
    project?: Project
    submitLabel?: string
    onSuccess?: (project: Project) => void
    onCancel?: () => void
    redirectToDashboard?: boolean
}

const initialValues: ProjectFormValues = {
    name: '',
    description: '',
    status: 'planning',
    start_date: '',
    end_date: '',
}

export function ProjectForm({ project, submitLabel = 'Save Project', onSuccess, onCancel, redirectToDashboard = true }: ProjectFormProps) {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [form, setForm] = useState<ProjectFormValues>(initialValues)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!project) return
        setForm({
            name: project.name ?? project.project_name ?? '',
            description: project.description ?? project.remarks ?? '',
            status: project.status ?? 'planning',
            start_date: project.start_date ?? project.wo_date ?? '',
            end_date: project.end_date ?? '',
        })
    }, [project])

    const mutation = useMutation({
        mutationFn: async () => {
            if (!form.name.trim()) throw new Error('Project name is required.')
            if (!form.start_date) throw new Error('Project start date is required.')

            if (project) {
                return updateProject(project.id, {
                    name: form.name,
                    description: form.description,
                    status: form.status,
                    start_date: form.start_date,
                    end_date: form.end_date || null,
                })
            }

            return createProject({
                name: form.name,
                description: form.description,
                status: form.status,
                start_date: form.start_date,
                end_date: form.end_date || null,
            })
        },
        onSuccess: async (saved) => {
            await qc.invalidateQueries({ queryKey: ['projects'] })
            await qc.invalidateQueries({ queryKey: ['project', saved.id] })
            onSuccess?.(saved)
            if (redirectToDashboard) {
                navigate('/dashboard')
            }
        },
        onError: (err) => {
            console.error('Project form submission failed', err)
            setError(err instanceof Error ? err.message : 'Unable to save project.')
        },
    })

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        mutation.mutate()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                    <label className="form-label">Project Name *</label>
                    <input
                        className="form-input"
                        required
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Enter project name"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="form-label">Description</label>
                    <textarea
                        className="form-input min-h-28"
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Short project description"
                    />
                </div>

                <div>
                    <label className="form-label">Status</label>
                    <select
                        className={cn('form-input', getStatusColor(form.status))}
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))}
                    >
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="form-label">Start Date *</label>
                    <input
                        type="date"
                        className="form-input"
                        required
                        value={form.start_date}
                        onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
                    />
                </div>

                <div>
                    <label className="form-label">End Date</label>
                    <input
                        type="date"
                        className="form-input"
                        value={form.end_date}
                        onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
                {onCancel && (
                    <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
                        Cancel
                    </button>
                )}
                <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                    {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    {mutation.isPending ? 'Saving...' : submitLabel}
                </button>
            </div>
        </form>
    )
}

