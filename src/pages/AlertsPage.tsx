import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProjectStore } from '@/stores/projectStore'
import { useAlertStore } from '@/stores/alertStore'
import { useEffect } from 'react'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Bell, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import type { AlertLog } from '@/types'

const EMPTY_ALERTS: AlertLog[] = []

export default function AlertsPage() {
    const { activeProject } = useProjectStore()
    const { setAlerts } = useAlertStore()
    const qc = useQueryClient()

    const { data: alerts, isLoading, error } = useQuery({
        queryKey: ['alerts', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data, error } = await supabase
                .from('alert_log')
                .select('*')
                .eq('project_id', activeProject.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            return (data ?? []) as AlertLog[]
        },
        enabled: !!activeProject,
    })

    const alertRows = alerts ?? EMPTY_ALERTS

    useEffect(() => {
        setAlerts(alertRows)
    }, [alertRows, setAlerts])

    const handleResolve = async (alert: AlertLog) => {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('alert_log').update({ resolved: true, resolved_date: new Date().toISOString(), resolved_by: user?.id }).eq('id', alert.id)
        qc.invalidateQueries({ queryKey: ['alerts'] })
    }

    const unresolved = alertRows.filter((a) => !a.resolved)
    const resolved = alertRows.filter((a) => a.resolved)

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    if (error) {
        return (
            <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={32} className="mx-auto" style={{ color: '#ef4444' }} />
                <p className="font-semibold" style={{ color: 'var(--color-surface-100)' }}>Alerts could not be loaded</p>
                <p className="text-sm" style={{ color: 'var(--color-surface-300)' }}>
                    The alert list query failed for the active project. This page now shows the error instead of rendering blank so we can debug the live data safely.
                </p>
                <p className="text-xs break-all" style={{ color: 'var(--color-surface-400)' }}>{String(error.message ?? error)}</p>
            </div>
        )
    }

    const AlertCard = ({ alert }: { alert: AlertLog }) => (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${alert.severity === 'High' ? 'alert-high' : alert.severity === 'Medium' ? 'alert-medium' : 'alert-low'}`}>
            <Bell size={16} className="mt-0.5 shrink-0" style={{ color: alert.severity === 'High' ? '#ef4444' : alert.severity === 'Medium' ? '#f59e0b' : '#64748b' }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-surface-100)' }}>{alert.message}</p>
                    <StatusBadge status={alert.severity ?? 'Low'} className="shrink-0" />
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                    <span>{alert.category}</span>
                    {alert.sap_boq_ref && <span>· {alert.sap_boq_ref}</span>}
                    <span>· {formatDate(alert.created_at ?? alert.alert_date)}</span>
                </div>
            </div>
            {!alert.resolved && (
                <button className="btn-secondary text-xs py-1 px-2 shrink-0" onClick={() => handleResolve(alert)}>
                    <CheckCircle size={12} /> Resolve
                </button>
            )}
        </div>
    )

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-3 gap-4">
                {[['High', '#ef4444'], ['Medium', '#f59e0b'], ['Low', '#64748b']].map(([sev, color]) => (
                    <div key={sev} className="glass-card p-4">
                        <p className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--color-surface-400)' }}>{sev} Priority</p>
                        <p className="text-2xl font-bold" style={{ color }}>{unresolved.filter(a => a.severity === sev).length}</p>
                        <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>unresolved</p>
                    </div>
                ))}
            </div>

            <div>
                <p className="section-title mb-3">Unresolved Alerts ({unresolved.length})</p>
                {isLoading ? <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>Loading...</p>
                    : unresolved.length === 0 ? (
                        <div className="glass-card p-8 text-center">
                            <CheckCircle size={32} className="mx-auto mb-2" style={{ color: '#34d399' }} />
                            <p style={{ color: 'var(--color-surface-300)' }}>All clear! No active alerts for this project.</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--color-surface-500)' }}>If you expected alerts here, the active project may not match the seeded data.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">{unresolved.map(a => <AlertCard key={a.id} alert={a} />)}</div>
                    )
                }
            </div>

            {resolved.length > 0 && (
                <div>
                    <p className="section-title mb-3 opacity-60">Resolved ({resolved.length})</p>
                    <div className="space-y-2 opacity-60">{resolved.slice(0, 10).map(a => <AlertCard key={a.id} alert={a} />)}</div>
                </div>
            )}
        </div>
    )
}
