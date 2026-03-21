import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProjectStore } from '@/stores/projectStore'
import { DataTable } from '@/components/common/DataTable'
import { AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ScheduleMilestone } from '@/types'

export default function ScheduleReport() {
    const { activeProject } = useProjectStore()

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['schedule_milestones_report', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('schedule_milestones').select('*').eq('project_id', activeProject.id).order('planned_start')
            return data as ScheduleMilestone[]
        },
        enabled: !!activeProject,
    })

    const delayed = rows.filter(r => r.status === 'Delayed').length
    const completed = rows.filter(r => r.status === 'Completed').length
    const avgCompletion = rows.length > 0 ? rows.reduce((s, r) => s + r.completion_percent, 0) / rows.length : 0

    const columns = [
        { key: 'milestone_id', header: 'ID', sortable: true },
        { key: 'milestone_name', header: 'Milestone', sortable: true },
        { key: 'boq_ref', header: 'BOQ Ref', render: (v: string) => v ?? '—' },
        { key: 'planned_start', header: 'Planned Start', render: (v: string) => formatDate(v) },
        { key: 'planned_finish', header: 'Planned Finish', render: (v: string) => formatDate(v) },
        { key: 'actual_start', header: 'Actual Start', render: (v: string) => v ? formatDate(v) : '—' },
        { key: 'actual_finish', header: 'Actual Finish', render: (v: string) => v ? formatDate(v) : '—' },
        {
            key: 'completion_percent', header: '% Done', render: (v: number) => (
                <div className="flex items-center gap-2">
                    <div className="progress-bar w-16"><div className="progress-fill progress-fill-teal" style={{ width: `${v}%` }} /></div>
                    <span className="text-xs">{v?.toFixed(0)}%</span>
                </div>
            )
        },
        { key: 'delay_days', header: 'Delay (days)', render: (v: number) => v > 0 ? <span style={{ color: '#ef4444', fontWeight: 600 }}>+{v}d</span> : '—' },
        { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="glass-card p-4 grid grid-cols-4 gap-4">
                {[['Total Milestones', rows.length, 'var(--color-surface-50)'], ['Completed', completed, '#34d399'], ['Delayed', delayed, '#ef4444'], ['Avg Completion', `${avgCompletion.toFixed(0)}%`, 'var(--color-brand-300)']].map(([label, value, color]) => (
                    <div key={String(label)}><p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>{label}</p><p className="text-xl font-bold" style={{ color: String(color) }}>{value}</p></div>
                ))}
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['milestone_name', 'status', 'boq_ref']} />
        </div>
    )
}
