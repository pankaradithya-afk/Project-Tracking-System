import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Calendar, FolderEdit, Loader2, Plus, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Project, Task } from '@/types'
import { getProject } from '@/services/projectService'
import { subscribeWithReconnect } from '@/lib/supabase'
import { formatDate, getProjectProgressClass, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TaskList } from '@/components/tasks/TaskList'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'

interface ProjectDetailsProps {
    projectId: string
    initialCreateTaskOpen?: boolean
}

export function ProjectDetails({ projectId, initialCreateTaskOpen = false }: ProjectDetailsProps) {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [createTaskOpen, setCreateTaskOpen] = useState(initialCreateTaskOpen)
    const { data: profile } = useCurrentProfile()
    const canEditTasks = profile?.role === 'admin' || profile?.role === 'member'
    const canCreateProjects = profile?.role === 'admin'

    useEffect(() => {
        if (profile && !canEditTasks && createTaskOpen) {
            setCreateTaskOpen(false)
        }
    }, [profile, canEditTasks, createTaskOpen])

    const { data: project, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => getProject(projectId),
    })

    useEffect(() => {
        const unsubscribeTasks = subscribeWithReconnect<Task>({
            table: 'tasks',
            filter: `project_id=eq.${projectId}`,
            onChange: () => {
                void qc.invalidateQueries({ queryKey: ['project', projectId] })
                void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
            },
            onError: (subscriptionError) => {
                console.error('Task realtime subscription error', subscriptionError)
            },
        })

        const unsubscribeProjects = subscribeWithReconnect<Project>({
            table: 'projects',
            filter: `id=eq.${projectId}`,
            onChange: () => {
                void qc.invalidateQueries({ queryKey: ['project', projectId] })
            },
            onError: (subscriptionError) => {
                console.error('Project realtime subscription error', subscriptionError)
            },
        })

        return () => {
            unsubscribeTasks()
            unsubscribeProjects()
        }
    }, [projectId, qc])

    const stats = useMemo(() => ({
        totalTasks: project?.task_count ?? project?.tasks?.length ?? 0,
        completed: project?.completed_task_count ?? (project?.tasks?.filter((task) => task.status === 'done').length ?? 0),
        members: project?.team_members?.length ?? 0,
    }), [project])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="glass-card p-6 animate-pulse">
                    <div className="h-6 w-64 rounded bg-slate-700/50" />
                    <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-700/40" />
                    <div className="mt-6 h-4 rounded bg-slate-700/40" />
                </div>
                <div className="glass-card p-6 h-96 animate-pulse" />
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={30} className="mx-auto text-red-400" />
                <p className="font-semibold text-slate-50">Project could not be loaded</p>
                <p className="text-sm text-slate-400">{error instanceof Error ? error.message : 'The requested project was not found.'}</p>
                <div className="flex items-center justify-center gap-3">
                    <button className="btn-secondary" onClick={() => navigate('/projects')}>
                        <ArrowLeft size={14} />
                        Back to projects
                    </button>
                    <button className="btn-primary" onClick={() => refetch()} disabled={isFetching}>
                        {isFetching ? <Loader2 size={14} className="animate-spin" /> : null}
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <CreateTaskModal
                open={createTaskOpen}
                projectId={project.id}
                members={project.team_members ?? []}
                onClose={() => setCreateTaskOpen(false)}
            />

            <div className="glass-card p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={project.status} />
                            <span className="text-xs uppercase tracking-wide text-slate-400">Project details</span>
                        </div>
                        <h1 className="mt-3 text-3xl font-bold text-slate-50">{project.name}</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                            {project.description || 'No project description has been added yet.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button type="button" className="btn-secondary" onClick={() => navigate('/projects')}>
                            <ArrowLeft size={15} />
                            Back
                        </button>
                        {canEditTasks && (
                            <button type="button" className="btn-secondary" onClick={() => setCreateTaskOpen(true)}>
                                <Plus size={15} />
                                Add Task
                            </button>
                        )}
                        {canCreateProjects && (
                            <Link to="/projects/new" className="btn-primary">
                                <FolderEdit size={15} />
                                New Project
                            </Link>
                        )}
                    </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Progress</p>
                        <p className="mt-2 text-3xl font-bold text-slate-50">{project.progress.toFixed(0)}%</p>
                        <div className="progress-bar mt-4">
                            <div className={cn('progress-fill', getProjectProgressClass(project.progress))} style={{ width: `${project.progress}%` }} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Timeline</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                            <p className="inline-flex items-center gap-2"><Calendar size={14} /> Start {formatDate(project.start_date)}</p>
                            <p className="inline-flex items-center gap-2"><Calendar size={14} /> End {project.end_date ? formatDate(project.end_date) : 'Not set'}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Team</p>
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                            <Users size={14} />
                            {stats.members} members, {stats.totalTasks} tasks, {stats.completed} done
                        </div>
                    </div>
                </div>
            </div>

            <TaskList project={project} />
        </div>
    )
}
