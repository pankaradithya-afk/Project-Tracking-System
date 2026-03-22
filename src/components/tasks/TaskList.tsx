import { useMemo, useState, useDeferredValue } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Search, RefreshCw } from 'lucide-react'
import type { Project, Task, TaskStatus } from '@/types'
import { getTasksByProject } from '@/services/taskService'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { StatusBadge } from '@/components/common/StatusBadge'
import { CreateTaskModal } from './CreateTaskModal'
import { TaskCard } from './TaskCard'

const TABS: Array<{ label: string; value: TaskStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Todo', value: 'todo' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Review', value: 'review' },
    { label: 'Done', value: 'done' },
]

interface TaskListProps {
    project: Project
}

const PAGE_SIZE = 8

export function TaskList({ project }: TaskListProps) {
    const qc = useQueryClient()
    const { data: profile } = useCurrentProfile()
    const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [modalOpen, setModalOpen] = useState(false)
    const deferredSearch = useDeferredValue(search)

    const { data: tasks = [], isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['tasks', project.id],
        queryFn: () => getTasksByProject(project.id),
    })

    const canEdit = profile?.role === 'admin' || profile?.role === 'member'

    const filteredTasks = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase()
        return tasks.filter((task) => {
            const matchesTab = filter === 'all' ? true : task.status === filter
            const matchesSearch = !term
                || task.title.toLowerCase().includes(term)
                || task.description?.toLowerCase().includes(term)
                || task.priority.toLowerCase().includes(term)
            return matchesTab && matchesSearch
        })
    }, [deferredSearch, filter, tasks])

    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE))
    const pageTasks = useMemo(() => filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredTasks, page])

    const counts = useMemo(() => ({
        all: tasks.length,
        todo: tasks.filter((task) => task.status === 'todo').length,
        in_progress: tasks.filter((task) => task.status === 'in_progress').length,
        review: tasks.filter((task) => task.status === 'review').length,
        done: tasks.filter((task) => task.status === 'done').length,
    }), [tasks])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-5 w-40 rounded bg-slate-700/50 animate-pulse" />
                    <div className="h-10 w-32 rounded bg-slate-700/50 animate-pulse" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="glass-card p-4 h-48 animate-pulse">
                            <div className="h-4 w-24 rounded bg-slate-700/50" />
                            <div className="mt-4 h-4 w-full rounded bg-slate-700/50" />
                            <div className="mt-2 h-4 w-2/3 rounded bg-slate-700/50" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="glass-card p-6 text-center space-y-3">
                <p className="font-semibold text-slate-50">Tasks could not be loaded</p>
                <p className="text-sm text-slate-400">{error instanceof Error ? error.message : 'Unknown error'}</p>
                <button className="btn-secondary mx-auto" onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <CreateTaskModal
                open={modalOpen}
                projectId={project.id}
                members={project.team_members ?? []}
                onClose={() => setModalOpen(false)}
                onCreated={async () => {
                    await qc.invalidateQueries({ queryKey: ['tasks', project.id] })
                }}
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-50">Tasks</h3>
                    <p className="text-sm text-slate-400">{counts.all} total tasks</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            className="form-input pl-9 sm:w-72"
                            placeholder="Search tasks..."
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value)
                                setPage(1)
                            }}
                        />
                    </div>
                    {canEdit && (
                        <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                            <Plus size={15} />
                            Add Task
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => {
                            setFilter(tab.value)
                            setPage(1)
                        }}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${filter === tab.value ? 'border-brand-500 bg-brand-500/10 text-brand-300' : 'border-slate-700 text-slate-400 hover:border-brand-500/40 hover:text-slate-100'}`}
                    >
                        {tab.label}
                        <span className="ml-2 text-xs opacity-70">({counts[tab.value] ?? counts.all})</span>
                    </button>
                ))}
            </div>

            {filteredTasks.length === 0 ? (
                <div className="glass-card p-10 text-center">
                    <p className="text-lg font-semibold text-slate-50">
                        {tasks.length === 0 ? 'No tasks yet' : 'No tasks match this filter'}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                        {tasks.length === 0
                            ? 'Create the first task to start tracking work.'
                            : 'Try another status or search term.'}
                    </p>
                    {canEdit && tasks.length === 0 && (
                        <button type="button" className="btn-primary mt-6" onClick={() => setModalOpen(true)}>
                            <Plus size={15} />
                            Add Task
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {pageTasks.map((task) => (
                            <TaskCard key={task.id} task={task} canEdit={canEdit} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm text-slate-400">
                            <span>Page {page} of {totalPages}</span>
                            <div className="flex items-center gap-2">
                                <button className="btn-secondary px-3 py-2" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                                    Previous
                                </button>
                                <button className="btn-secondary px-3 py-2" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
