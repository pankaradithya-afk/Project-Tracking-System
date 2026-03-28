import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Calendar, FolderEdit, Loader2, Plus, Users, DollarSign, TrendingUp, Bell, Package, Activity, CheckCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Project, Task } from '@/types'
import { getProject } from '@/services/projectService'
import { subscribeWithReconnect } from '@/lib/supabase'
import { formatCurrency, formatDate, getProjectProgressClass, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TaskList } from '@/components/tasks/TaskList'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { supabase } from '@/lib/supabaseClient'
import { KpiCard } from '@/components/common/KpiCard'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import { useProjectStore } from '@/stores/projectStore'

interface ProjectDetailsProps {
    projectId: string
    initialCreateTaskOpen?: boolean
}

type ProjectDashboardMetrics = {
    contractValue: number
    revenueCertified: number
    revenueCollected: number
    actualCost: number
    grossMargin: number
    marginPercent: number
    billableGap: number
    pendingAlerts: number
    criticalAlerts: number
}

export function ProjectDetails({ projectId, initialCreateTaskOpen = false }: ProjectDetailsProps) {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const { setActiveProject } = useProjectStore()
    const [createTaskOpen, setCreateTaskOpen] = useState(initialCreateTaskOpen)
    const [metrics, setMetrics] = useState<ProjectDashboardMetrics>({
        contractValue: 0,
        revenueCertified: 0,
        revenueCollected: 0,
        actualCost: 0,
        grossMargin: 0,
        marginPercent: 0,
        billableGap: 0,
        pendingAlerts: 0,
        criticalAlerts: 0,
    })
    const [budgetChartData, setBudgetChartData] = useState<Array<{ name: string; budget: number; actual: number }>>([])
    const [recentAlerts, setRecentAlerts] = useState<Array<{ id: string; message: string; severity: string; category: string; created_at: string; resolved: boolean }>>([])
    const [recentMilestones, setRecentMilestones] = useState<Array<{ milestone_name: string; completion_percent: number; status: string; planned_finish: string }>>([])
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
        if (project) {
            setActiveProject(project)
        }
    }, [project, setActiveProject])

    useEffect(() => {
        const fetchProjectMetrics = async () => {
            const { data: invoiceRows } = await supabase
                .from('invoice_register')
                .select('invoice_no, total_invoice, status')
                .eq('project_id', projectId)

            const invoiceNos = (invoiceRows ?? []).map((invoice) => invoice.invoice_no)
            const paymentQuery = invoiceNos.length > 0
                ? supabase.from('payment_tracker').select('payment_amount, invoice_ref').in('invoice_ref', invoiceNos)
                : Promise.resolve({ data: [] as { payment_amount: number | null; invoice_ref: string | null }[] })

            const [
                { data: boqRows },
                { data: paymentRows },
                { data: poRows },
                { data: alertRows },
                { data: milestoneRows },
                { data: budgetRows },
                { data: actualRows },
            ] = await Promise.all([
                supabase.from('boq_contract').select('contract_value').eq('project_id', projectId),
                paymentQuery,
                supabase.from('purchase_order').select('total_po_value').eq('project_id', projectId),
                supabase.from('alert_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
                supabase.from('schedule_milestones').select('milestone_name, completion_percent, status, planned_finish').eq('project_id', projectId).limit(8),
                supabase.from('budget').select('cost_category, budget_value').eq('project_id', projectId),
                supabase.from('actual_cost').select('cost_category:cost_type, amount').eq('project_id', projectId),
            ])

            const contractValue = (boqRows ?? []).reduce((sum, row) => sum + (row.contract_value ?? 0), 0)
            const revenueCertified = (invoiceRows ?? []).filter(row => ['Certified', 'Paid'].includes(row.status)).reduce((sum, row) => sum + (row.total_invoice ?? 0), 0)
            const revenueCollected = (paymentRows ?? []).reduce((sum, row) => sum + (row.payment_amount ?? 0), 0)
            const actualCost = (poRows ?? []).reduce((sum, row) => sum + (row.total_po_value ?? 0), 0)
            const grossMargin = revenueCertified - actualCost
            const marginPercent = revenueCertified > 0 ? (grossMargin / revenueCertified) * 100 : 0
            const billableGap = revenueCertified - revenueCollected
            const pendingAlerts = (alertRows ?? []).filter(alert => !alert.resolved).length
            const criticalAlerts = (alertRows ?? []).filter(alert => !alert.resolved && alert.severity === 'High').length

            setMetrics({ contractValue, revenueCertified, revenueCollected, actualCost, grossMargin, marginPercent, billableGap, pendingAlerts, criticalAlerts })
            setRecentAlerts((alertRows ?? []).filter(alert => !alert.resolved).slice(0, 5))
            setRecentMilestones(milestoneRows ?? [])

            const budgetMap: Record<string, number> = {}
            ; (budgetRows ?? []).forEach(row => { budgetMap[row.cost_category] = (budgetMap[row.cost_category] ?? 0) + row.budget_value })
            const actualMap: Record<string, number> = {}
            ; (actualRows ?? []).forEach(row => { actualMap[row.cost_category] = (actualMap[row.cost_category] ?? 0) + row.amount })
            const allCats = [...new Set([...Object.keys(budgetMap), ...Object.keys(actualMap)])]
            setBudgetChartData(allCats.map(category => ({ name: category, budget: budgetMap[category] ?? 0, actual: actualMap[category] ?? 0 })))
        }

        void fetchProjectMetrics().catch((error) => {
            console.error('Project metrics failed', error)
        })
    }, [projectId])

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

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass-card p-5">
                    <p className="section-title mb-4">WO Intake</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Client</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{project.client ?? 'Not set'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Contact</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{project.client_contact ?? 'Not set'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">WO Number</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{project.wo_number ?? 'Not set'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">WO Date</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{project.wo_date ? formatDate(project.wo_date) : 'Not set'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Order Value</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-300">{formatCurrency(project.wo_value ?? project.order_value ?? 0)}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Location</p>
                            <p className="mt-1 text-sm font-semibold text-slate-50">{project.location ?? 'Not set'}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-5">
                    <p className="section-title mb-4">Scope and Planning</p>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Scope of Works</p>
                            <p className="mt-1 text-sm leading-6 text-slate-200 whitespace-pre-wrap">{project.scope_of_works || project.description || 'Not captured yet.'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Team Plan</p>
                            <p className="mt-1 text-sm leading-6 text-slate-200 whitespace-pre-wrap">{project.team_plan || 'Not captured yet.'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-400">Work Plan</p>
                            <p className="mt-1 text-sm leading-6 text-slate-200 whitespace-pre-wrap">{project.work_plan || 'Not captured yet.'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <KpiCard title="Contract Value" value={metrics.contractValue} isCurrency accentColor="teal" icon={<DollarSign size={20} style={{ color: 'var(--color-brand-500)' }} />} />
                <KpiCard title="Revenue Certified" value={metrics.revenueCertified} isCurrency accentColor="blue" icon={<CheckCircle size={20} style={{ color: '#3b82f6' }} />} />
                <KpiCard title="Amount Collected" value={metrics.revenueCollected} isCurrency accentColor="green" icon={<TrendingUp size={20} style={{ color: '#10b981' }} />} />
                <KpiCard title="Actual Cost (PO)" value={metrics.actualCost} isCurrency accentColor="amber" icon={<Package size={20} style={{ color: '#f59e0b' }} />} />
                <KpiCard title="Gross Margin" value={metrics.grossMargin} isCurrency accentColor={metrics.grossMargin >= 0 ? 'green' : 'red'} icon={<Activity size={20} style={{ color: '#10b981' }} />} trendLabel={`${metrics.marginPercent.toFixed(1)}%`} trend={metrics.grossMargin} />
                <KpiCard title="Pending Alerts" value={metrics.pendingAlerts} unit={` (${metrics.criticalAlerts} critical)`} accentColor="red" icon={<Bell size={20} style={{ color: '#ef4444' }} />} trend={-metrics.criticalAlerts} trendLabel={`${metrics.criticalAlerts} High`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="glass-card p-5 lg:col-span-2">
                    <p className="section-title mb-4">Budget vs Actual Cost</p>
                    {budgetChartData.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: 'var(--color-surface-400)' }}>No budget data available yet.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={budgetChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '8px', color: '#e2e8f0' }} formatter={(value) => formatCurrency(typeof value === 'number' ? value : 0)} />
                                <Bar dataKey="budget" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} name="Budget" />
                                <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual" />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="glass-card p-5">
                    <p className="section-title mb-4">Project Notes</p>
                    <div className="space-y-3 text-sm text-slate-300">
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                            <p className="text-xs uppercase text-slate-400">Billing Gap</p>
                            <p className="mt-1 text-lg font-semibold text-slate-50">{formatCurrency(metrics.billableGap)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                            <p className="text-xs uppercase text-slate-400">Project Status</p>
                            <p className="mt-1 text-lg font-semibold text-slate-50">{project.status.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                            <p className="text-xs uppercase text-slate-400">Members</p>
                            <p className="mt-1 text-lg font-semibold text-slate-50">{project.team_members?.length ?? 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                    <p className="section-title mb-4">Recent Unresolved Alerts</p>
                    {recentAlerts.length === 0 ? (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--color-surface-400)' }}>No active alerts.</p>
                    ) : (
                        <div className="space-y-2">
                            {recentAlerts.map((alert) => (
                                <div key={alert.id} className={`p-3 rounded-lg ${alert.severity === 'High' ? 'alert-high' : alert.severity === 'Medium' ? 'alert-medium' : 'alert-low'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm" style={{ color: 'var(--color-surface-100)' }}>{alert.message}</p>
                                        <StatusBadge status={alert.severity} className="shrink-0" />
                                    </div>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-surface-400)' }}>{alert.category} · {formatDate(alert.created_at)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass-card p-5">
                    <p className="section-title mb-4">Schedule Milestones</p>
                    {recentMilestones.length === 0 ? (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--color-surface-400)' }}>No milestones defined.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentMilestones.map((milestone) => (
                                <div key={milestone.milestone_name}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-surface-100)' }}>{milestone.milestone_name}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold" style={{ color: milestone.completion_percent >= 100 ? '#10b981' : 'var(--color-brand-500)' }}>{milestone.completion_percent.toFixed(0)}%</span>
                                            <StatusBadge status={milestone.status} />
                                        </div>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className={`progress-fill ${milestone.status === 'Delayed' ? 'progress-fill-red' : milestone.completion_percent >= 100 ? 'progress-fill-green' : 'progress-fill-teal'}`}
                                            style={{ width: `${milestone.completion_percent}%` }}
                                        />
                                    </div>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>Due: {formatDate(milestone.planned_finish)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <TaskList project={project} />
        </div>
    )
}
