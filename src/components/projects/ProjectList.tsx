import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FolderPlus, Loader2, Search, ArrowRight } from 'lucide-react'
import { getProjects } from '@/services/projectService'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { getProjectProgressClass, formatDate, getStatusColor, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { Project } from '@/types'

const ProjectCard = memo(function ProjectCard({ project }: { project: Project }) {
    return (
        <div className="glass-card p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-500/50">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={project.status} />
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                            {project.task_count ?? 0} tasks
                        </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-50 truncate">{project.name}</h3>
                    <p className="mt-1 text-sm text-slate-400 line-clamp-2">{project.description || 'No description added yet.'}</p>
                </div>
                <div className="rounded-xl px-3 py-2 text-right bg-slate-900/60 border border-slate-700/60">
                    <p className="text-xs text-slate-400">Progress</p>
                    <p className="text-lg font-bold text-slate-50">{project.progress.toFixed(0)}%</p>
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div className="progress-bar">
                    <div className={cn('progress-fill', getProjectProgressClass(project.progress))} style={{ width: `${project.progress}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Start: {formatDate(project.start_date)}</span>
                    <span>{project.end_date ? `End: ${formatDate(project.end_date)}` : 'Open-ended'}</span>
                </div>
                <p className="text-xs text-slate-500">
                    Team: {project.team_members?.length ? project.team_members.map((member) => member.user?.full_name ?? member.user?.email ?? 'Member').slice(0, 3).join(', ') : 'No members yet'}
                </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                    {project.completed_task_count ?? 0} completed
                    {project.upcoming_deadline_count ? `, ${project.upcoming_deadline_count} due soon` : ''}
                </div>
                <Link
                    to={`/projects/${project.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500/50 hover:text-white"
                >
                    View Details
                    <ArrowRight size={14} />
                </Link>
            </div>
        </div>
    )
})

export function ProjectList() {
    const [search, setSearch] = useState('')
    const { data: profile } = useCurrentProfile()
    const { data: projects = [], isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['projects'],
        queryFn: getProjects,
    })

    const filteredProjects = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return projects
        return projects.filter((project) => (
            project.name.toLowerCase().includes(term)
            || project.description?.toLowerCase().includes(term)
            || project.status.toLowerCase().includes(term)
        ))
    }, [projects, search])

    const canCreate = profile?.role === 'admin'

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="glass-card p-5 animate-pulse">
                        <div className="h-5 w-28 rounded bg-slate-700/70" />
                        <div className="mt-4 h-4 w-full rounded bg-slate-700/50" />
                        <div className="mt-2 h-4 w-5/6 rounded bg-slate-700/50" />
                        <div className="mt-6 h-2 rounded bg-slate-700/50" />
                    </div>
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="glass-card p-6 text-center space-y-3">
                <AlertCircle size={28} className="mx-auto text-red-400" />
                <p className="font-semibold text-slate-100">Projects could not be loaded</p>
                <p className="text-sm text-slate-400 break-all">{error instanceof Error ? error.message : 'Unknown error'}</p>
                <button className="btn-secondary mx-auto" onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? <Loader2 size={14} className="animate-spin" /> : null}
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-50">My Projects</h2>
                    <p className="text-sm text-slate-400">{filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'} visible</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search projects..."
                            className="form-input pl-9 sm:w-72"
                        />
                    </div>
                    {canCreate && (
                        <Link to="/projects/new" className="btn-primary justify-center">
                            <FolderPlus size={15} />
                            New Project
                        </Link>
                    )}
                </div>
            </div>

            {filteredProjects.length === 0 ? (
                <div className="glass-card p-10 text-center">
                    <FolderPlus size={36} className="mx-auto mb-4 text-brand-400" />
                    <h3 className="text-xl font-semibold text-slate-50">No projects found</h3>
                    <p className="mt-2 text-sm text-slate-400">
                        {search ? 'Try a different search term.' : 'Create your first project to start tracking work.'}
                    </p>
                    {canCreate && !search && (
                        <Link to="/projects/new" className="btn-primary mt-6">
                            Create Project
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredProjects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            )}
        </div>
    )
}
