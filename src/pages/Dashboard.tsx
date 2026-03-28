import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, CheckCircle2, FolderKanban, Loader2, FolderOpen } from 'lucide-react'
import { getProjects } from '@/services/projectService'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { KpiCard } from '@/components/common/KpiCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate, getProjectProgressClass, cn } from '@/lib/utils'

export default function Dashboard() {
    const { data: profile } = useCurrentProfile()
    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: getProjects,
    })

    const stats = useMemo(() => {
        const allTasks = projects.flatMap((project) => project.tasks ?? [])
        const completedTasks = allTasks.filter((task) => task.status === 'done').length
        const upcomingDeadlines = allTasks.filter((task) => task.due_date && task.status !== 'done' && new Date(task.due_date) >= new Date()).length
        const activeProjects = projects.filter((project) => project.status === 'current' || project.status === 'active').length
        const completedProjects = projects.filter((project) => project.status === 'finished' || project.status === 'completed').length
        return {
            totalProjects: projects.length,
            activeProjects,
            completedProjects,
            completedTasks,
            upcomingDeadlines,
            recentProjects: projects.slice(0, 3),
        }
    }, [projects])

    const displayName = profile?.full_name ?? profile?.email ?? 'Project team member'

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <p className="text-sm uppercase tracking-widest text-brand-300">Welcome back</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-50">{displayName}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Here is a quick snapshot of your live ERP workspace. Projects, tasks, and delivery signals stay in sync with Supabase.
                </p>
                <p className="mt-4 text-xs text-slate-500">Today is {formatDate(new Date())}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <KpiCard
                    title="Total Projects"
                    value={stats.totalProjects}
                    icon={<FolderKanban size={18} className="text-brand-300" />}
                    loading={isLoading}
                    accentColor="blue"
                />
                <KpiCard
                    title="Current Projects"
                    value={stats.activeProjects}
                    icon={<FolderOpen size={18} className="text-emerald-300" />}
                    loading={isLoading}
                    accentColor="green"
                />
                <KpiCard
                    title="Completed Projects"
                    value={stats.completedProjects}
                    icon={<CheckCircle2 size={18} className="text-amber-300" />}
                    loading={isLoading}
                    accentColor="amber"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <KpiCard
                    title="Completed Tasks"
                    value={stats.completedTasks}
                    icon={<CheckCircle2 size={18} className="text-emerald-300" />}
                    loading={isLoading}
                    accentColor="green"
                />
                <KpiCard
                    title="Upcoming Deadlines"
                    value={stats.upcomingDeadlines}
                    icon={<CalendarDays size={18} className="text-amber-300" />}
                    loading={isLoading}
                    accentColor="amber"
                />
            </div>

            <div className="glass-card p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-50">Recent Projects</h2>
                        <p className="text-sm text-slate-400">Open a project to view its full task board and details.</p>
                    </div>
                    <Link to="/projects" className="btn-secondary">
                        View all
                        <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {stats.recentProjects.length === 0 ? (
                        <div className="col-span-full rounded-xl border border-dashed border-slate-700/70 p-8 text-center text-sm text-slate-400">
                            No projects available yet.
                        </div>
                    ) : (
                        stats.recentProjects.map((project) => (
                            <Link key={project.id} to={`/projects/${project.id}`} className="glass-card p-4 transition-all hover:-translate-y-1 hover:border-brand-500/50">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <StatusBadge status={project.status} />
                                        <h3 className="mt-2 truncate text-base font-semibold text-slate-50">{project.name}</h3>
                                        <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                                            {project.description || 'No description added yet.'}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-200">{project.progress.toFixed(0)}%</span>
                                </div>
                                <div className="mt-4">
                                    <div className="progress-bar">
                                        <div
                                            className={cn('progress-fill', getProjectProgressClass(project.progress))}
                                            style={{ width: `${project.progress}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        {formatDate(project.start_date)}
                                        {project.end_date ? ` - ${formatDate(project.end_date)}` : ''}
                                    </p>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    Syncing project data...
                </div>
            )}
        </div>
    )
}
