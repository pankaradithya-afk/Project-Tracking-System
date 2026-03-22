import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectMember, Task, TaskPriority } from '@/types'
import { createTask } from '@/services/taskService'
import { Modal } from '@/components/common/Modal'
import { Loader2 } from 'lucide-react'

type TaskFormValues = {
    title: string
    description: string
    priority: TaskPriority
    due_date: string
    assigned_to: string
}

interface CreateTaskModalProps {
    open: boolean
    projectId: string
    members?: ProjectMember[]
    onClose: () => void
    onCreated?: (task: Task) => void
}

const initialValues: TaskFormValues = {
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
}

export function CreateTaskModal({ open, projectId, members = [], onClose, onCreated }: CreateTaskModalProps) {
    const qc = useQueryClient()
    const [form, setForm] = useState<TaskFormValues>(initialValues)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!open) {
            setForm(initialValues)
            setError('')
        }
    }, [open])

    const mutation = useMutation({
        mutationFn: async () => createTask({
            project_id: projectId,
            title: form.title,
            description: form.description,
            priority: form.priority,
            due_date: form.due_date || null,
            assigned_to: form.assigned_to || null,
        }),
        onSuccess: async (task) => {
            await qc.invalidateQueries({ queryKey: ['project', projectId] })
            await qc.invalidateQueries({ queryKey: ['tasks', projectId] })
            onCreated?.(task)
            onClose()
        },
        onError: (err) => {
            console.error('Create task failed', err)
            setError(err instanceof Error ? err.message : 'Unable to create task.')
        },
    })

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        mutation.mutate()
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Create Task"
            maxWidth="lg"
            loading={mutation.isPending}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>
                        Cancel
                    </button>
                    <button type="submit" form="task-create-form" className="btn-primary" disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                        Add Task
                    </button>
                </>
            }
        >
            <form id="task-create-form" onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                        {error}
                    </div>
                )}

                <div>
                    <label className="form-label">Title *</label>
                    <input
                        className="form-input"
                        required
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Task title"
                    />
                </div>

                <div>
                    <label className="form-label">Description</label>
                    <textarea
                        className="form-input min-h-28"
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Optional task details"
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <label className="form-label">Priority</label>
                        <select
                            className="form-input"
                            value={form.priority}
                            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="form-label">Due Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={form.due_date}
                            onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                        />
                    </div>
                </div>

                <div>
                    <label className="form-label">Assignee</label>
                    <select
                        className="form-input"
                        value={form.assigned_to}
                        onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.target.value }))}
                    >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                                {member.user?.full_name ?? member.user?.email ?? member.user_id}
                            </option>
                        ))}
                    </select>
                </div>
            </form>
        </Modal>
    )
}

