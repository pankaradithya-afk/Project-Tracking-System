import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Loader2, Users, CalendarRange, Building2, ArrowLeft, ArrowRight } from 'lucide-react'
import type { Project, ProjectStatus } from '@/types'
import { createProject, updateProject } from '@/services/projectService'
import { cn, formatCurrency, formatStatusLabel, getStatusColor } from '@/lib/utils'

const STATUS_OPTIONS: ProjectStatus[] = ['enquiry', 'upcoming', 'current', 'finished', 'archived']

type ProjectWizardValues = {
    name: string
    client: string
    client_contact: string
    location: string
    wo_number: string
    wo_received_date: string
    order_value: string
    scope_of_works: string
    team_plan: string
    work_plan: string
    start_date: string
    end_date: string
    status: ProjectStatus
}

interface ProjectFormProps {
    project?: Project
    submitLabel?: string
    onSuccess?: (project: Project) => void
    onCancel?: () => void
    redirectToDashboard?: boolean
}

const initialValues: ProjectWizardValues = {
    name: '',
    client: '',
    client_contact: '',
    location: '',
    wo_number: '',
    wo_received_date: '',
    order_value: '',
    scope_of_works: '',
    team_plan: '',
    work_plan: '',
    start_date: '',
    end_date: '',
    status: 'enquiry',
}

function StepPill({ active, complete, label, index }: { active: boolean; complete: boolean; label: string; index: number }) {
    return (
        <div className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3', active ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700/60 bg-slate-900/40')}>
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold', complete ? 'bg-emerald-500/20 text-emerald-300' : active ? 'bg-brand-500/20 text-brand-300' : 'bg-slate-700/80 text-slate-400')}>
                {complete ? <CheckCircle2 size={16} /> : index}
            </div>
            <span className={cn('text-sm font-medium', active ? 'text-slate-50' : 'text-slate-400')}>{label}</span>
        </div>
    )
}

export function ProjectForm({ project, submitLabel = 'Save Project', onSuccess, onCancel, redirectToDashboard = true }: ProjectFormProps) {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [step, setStep] = useState(1)
    const [form, setForm] = useState<ProjectWizardValues>(initialValues)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!project) return
        setForm({
            name: project.name ?? project.project_name ?? '',
            client: project.client ?? '',
            client_contact: project.client_contact ?? '',
            location: project.location ?? '',
            wo_number: project.wo_number ?? '',
            wo_received_date: project.wo_received_date ?? project.wo_date ?? '',
            order_value: String(project.order_value ?? project.wo_value ?? ''),
            scope_of_works: project.scope_of_works ?? project.description ?? '',
            team_plan: project.team_plan ?? '',
            work_plan: project.work_plan ?? '',
            start_date: project.start_date ?? project.wo_date ?? '',
            end_date: project.end_date ?? '',
            status: project.status ?? 'enquiry',
        })
    }, [project])

    const wizardSteps = useMemo(() => ([
        { id: 1, label: 'WO & Client' },
        { id: 2, label: 'Scope' },
        { id: 3, label: 'Timeline & Team' },
        { id: 4, label: 'Review' },
    ]), [])

    const validateStep = (currentStep: number): string | null => {
        if (currentStep === 1) {
            if (!form.name.trim()) return 'Project name is required.'
            if (!form.client.trim()) return 'Client name is required.'
            if (!form.wo_number.trim()) return 'WO number is required.'
            if (!form.wo_received_date) return 'WO received date is required.'
            if (!form.order_value.trim() || Number.isNaN(Number(form.order_value))) return 'Order value is required.'
        }
        if (currentStep === 2) {
            if (!form.scope_of_works.trim()) return 'Scope of works is required.'
        }
        if (currentStep === 3) {
        }
        return null
    }

    const mutation = useMutation({
        mutationFn: async () => {
            const projectPayload = {
                name: form.name,
                description: form.scope_of_works,
                status: form.status,
                start_date: form.start_date || form.wo_received_date,
                end_date: form.end_date || null,
                client: form.client,
                client_contact: form.client_contact || undefined,
                location: form.location || undefined,
                wo_number: form.wo_number,
                wo_date: form.wo_received_date,
                wo_received_date: form.wo_received_date,
                wo_value: Number(form.order_value) || 0,
                order_value: Number(form.order_value) || 0,
                scope_of_works: form.scope_of_works,
                team_plan: form.team_plan,
                work_plan: form.work_plan,
            }

            if (project) {
                return updateProject(project.id, projectPayload)
            }

            return createProject(projectPayload)
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

    const handleNext = () => {
        const validationError = validateStep(step)
        if (validationError) {
            setError(validationError)
            return
        }
        setError('')
        setStep((current) => Math.min(4, current + 1))
    }

    const handleBack = () => {
        setError('')
        setStep((current) => Math.max(1, current - 1))
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        const validationError = validateStep(step)
        if (validationError) {
            setError(validationError)
            return
        }
        setError('')
        mutation.mutate()
    }

    const valueNumber = Number(form.order_value) || 0

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-3 md:grid-cols-4">
                {wizardSteps.map((item) => (
                    <StepPill key={item.id} index={item.id} label={item.label} active={step === item.id} complete={step > item.id} />
                ))}
            </div>

            {error && (
                <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                    {error}
                </div>
            )}

            {step === 1 && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4">
                        <div className="flex items-center gap-2 text-brand-300">
                            <Building2 size={18} />
                            <p className="text-sm font-semibold uppercase tracking-wide">WO and client details</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Capture the enquiry and commercial handover before execution planning begins.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="form-label">Project Name *</label>
                            <input className="form-input" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter project name" />
                        </div>
                        <div>
                            <label className="form-label">Client Name *</label>
                            <input className="form-input" required value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))} placeholder="Client / organisation" />
                        </div>
                        <div>
                            <label className="form-label">Client Contact</label>
                            <input className="form-input" value={form.client_contact} onChange={(event) => setForm((current) => ({ ...current, client_contact: event.target.value }))} placeholder="Primary contact person" />
                        </div>
                        <div>
                            <label className="form-label">WO Number *</label>
                            <input className="form-input" required value={form.wo_number} onChange={(event) => setForm((current) => ({ ...current, wo_number: event.target.value }))} placeholder="WO / PO reference" />
                        </div>
                        <div>
                            <label className="form-label">WO Received Date *</label>
                            <input type="date" className="form-input" required value={form.wo_received_date} onChange={(event) => setForm((current) => ({ ...current, wo_received_date: event.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Order Value (₹) *</label>
                            <input type="number" min="0" step="0.01" className="form-input" required value={form.order_value} onChange={(event) => setForm((current) => ({ ...current, order_value: event.target.value }))} placeholder="Total order value" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="form-label">Site / Location</label>
                            <input className="form-input" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Project site location" />
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4">
                        <div className="flex items-center gap-2 text-brand-300">
                            <ClipboardList size={18} />
                            <p className="text-sm font-semibold uppercase tracking-wide">Scope of works</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Write what must be delivered so the execution team gets a clear brief.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="form-label">Scope of Works *</label>
                            <textarea className="form-input min-h-40" required value={form.scope_of_works} onChange={(event) => setForm((current) => ({ ...current, scope_of_works: event.target.value }))} placeholder="Summarise the contract scope, deliverables, exclusions, and key conditions" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="form-label">Project Status</label>
                            <select className={cn('form-input', getStatusColor(form.status))} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))}>
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{formatStatusLabel(status)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4">
                        <div className="flex items-center gap-2 text-brand-300">
                            <Users size={18} />
                            <p className="text-sm font-semibold uppercase tracking-wide">Timeline and team planning</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Set your working window and outline the first delivery team.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="form-label">Planned Start Date</label>
                            <input type="date" className="form-input" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Planned End Date</label>
                            <input type="date" className="form-input" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="form-label">Team Plan</label>
                            <textarea className="form-input min-h-28" value={form.team_plan} onChange={(event) => setForm((current) => ({ ...current, team_plan: event.target.value }))} placeholder="Who will own execution, supervision, billing, and coordination?" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="form-label">Work Plan</label>
                            <textarea className="form-input min-h-28" value={form.work_plan} onChange={(event) => setForm((current) => ({ ...current, work_plan: event.target.value }))} placeholder="Initial sequencing, milestones, and handover plan" />
                        </div>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2 text-emerald-300">
                            <CheckCircle2 size={18} />
                            <p className="text-sm font-semibold uppercase tracking-wide">Review</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Double-check the intake details before we create the project.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                            <p className="text-xs uppercase text-slate-400">Client</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{form.client}</p>
                            <p className="mt-2 text-xs text-slate-400">{form.client_contact || 'No contact provided'}</p>
                            <p className="mt-2 text-xs text-slate-400">{form.location || 'No location provided'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                            <p className="text-xs uppercase text-slate-400">Commercial</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{form.wo_number}</p>
                            <p className="mt-2 text-xs text-slate-400">WO received {form.wo_received_date}</p>
                            <p className="mt-2 text-sm font-semibold text-emerald-300">{formatCurrency(valueNumber)}</p>
                        </div>
                        <div className="md:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                            <p className="text-xs uppercase text-slate-400">Scope of works</p>
                            <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{form.scope_of_works}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                            <p className="text-xs uppercase text-slate-400">Team plan</p>
                            <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{form.team_plan || 'No team notes yet.'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                            <p className="text-xs uppercase text-slate-400">Work plan</p>
                            <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{form.work_plan || 'No work plan yet.'}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                    {onCancel && (
                        <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
                            Cancel
                        </button>
                    )}
                    {step > 1 && (
                        <button type="button" className="btn-secondary" onClick={handleBack} disabled={mutation.isPending}>
                            <ArrowLeft size={14} />
                            Back
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {step < 4 ? (
                        <button type="button" className="btn-primary" onClick={handleNext}>
                            Next
                            <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                            {mutation.isPending ? 'Saving...' : submitLabel}
                        </button>
                    )}
                </div>
            </div>
        </form>
    )
}
