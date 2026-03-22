import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, FolderKanban, Loader2 } from 'lucide-react'
import { getProjects } from '@/services/projectService'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { ProjectList } from '@/components/projects/ProjectList'
import { KpiCard } from '@/components/common/KpiCard'
import { formatDate } from '@/lib/utils'

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
        return {
            totalProjects: projects.length,
            completedTasks,
            upcomingDeadlines,
        }
    }, [projects])

    const displayName = profile?.full_name ?? profile?.email ?? 'Project team member'

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <p className="text-sm uppercase tracking-widest text-brand-300">Welcome back</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-50">{displayName}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Here is a quick snapshot of your active work. Projects, tasks, and deadlines stay in sync with Supabase realtime subscriptions.
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

            <ProjectList />

            {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    Syncing project data...
                </div>
            )}
        </div>
    )
}

