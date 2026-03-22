import { memo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Loader2, Trash2 } from 'lucide-react'
import type { Task, TaskStatus } from '@/types'
import { deleteTask, updateTaskStatus } from '@/services/taskService'
import { formatDate, getPriorityColor, getStatusColor, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'

interface TaskCardProps {
    task: Task
    canEdit: boolean
}

export const TaskCard = memo(function TaskCard({ task, canEdit }: TaskCardProps) {
    const qc = useQueryClient()
    const [error, setError] = useState('')

    const statusMutation = useMutation({
        mutationFn: async (status: TaskStatus) => updateTaskStatus(task.id, status),
        onSuccess: async () => {
            setError('')
            await qc.invalidateQueries({ queryKey: ['tasks', task.project_id] })
            await qc.invalidateQueries({ queryKey: ['project', task.project_id] })
        },
        onError: (error) => {
            console.error('Task status update failed', error)
            setError(error instanceof Error ? error.message : 'Task status could not be updated.')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async () => deleteTask(task.id),
        onSuccess: async () => {
            setError('')
            await qc.invalidateQueries({ queryKey: ['tasks', task.project_id] })
            await qc.invalidateQueries({ queryKey: ['project', task.project_id] })
        },
        onError: (error) => {
            console.error('Task deletion failed', error)
            setError(error instanceof Error ? error.message : 'Task could not be deleted.')
        },
    })

    const handleDelete = () => {
        if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return
        deleteMutation.mutate()
    }

    return (
        <div className="glass-card p-4 transition-colors hover:border-brand-500/50">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={task.status} />
                        <span className={cn('status-badge', getPriorityColor(task.priority))}>{task.priority}</span>
                    </div>
                    <h4 className="font-semibold text-slate-50 truncate">{task.title}</h4>
                    {task.description && <p className="mt-1 text-sm text-slate-400 line-clamp-2">{task.description}</p>}
                </div>
                {canEdit && (
                    <button
                        type="button"
                        className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete task ${task.title}`}
                    >
                        {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {task.assignee && <span>Assigned to: {task.assignee.full_name ?? task.assignee.email}</span>}
                {task.due_date && (
                    <span className="inline-flex items-center gap-1">
                        <Calendar size={12} />
                        Due {formatDate(task.due_date)}
                    </span>
                )}
            </div>

            {canEdit && (
                <div className="mt-4">
                    <label className="sr-only" htmlFor={`task-status-${task.id}`}>Task status</label>
                    <select
                        id={`task-status-${task.id}`}
                        className={cn('form-input text-sm', getStatusColor(task.status))}
                        value={task.status}
                        disabled={statusMutation.isPending}
                        onChange={(event) => statusMutation.mutate(event.target.value as TaskStatus)}
                    >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                    </select>
                </div>
            )}

            {error && (
                <p className="mt-3 text-xs text-red-300">
                    {error}
                </p>
            )}
        </div>
    )
})
