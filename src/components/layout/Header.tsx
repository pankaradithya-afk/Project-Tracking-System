import { Bell, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { useAlertStore } from '@/stores/alertStore'
import { formatCurrency } from '@/lib/utils'

interface HeaderProps {
    title: string
    subtitle?: string
}

export default function Header({ title, subtitle }: HeaderProps) {
    const { activeProject } = useProjectStore()
    const { unreadCount } = useAlertStore()
    const navigate = useNavigate()

    return (
        <header className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ background: 'rgba(15,23,42,0.8)', borderColor: 'rgba(51,65,85,0.5)', backdropFilter: 'blur(12px)' }}>
            {/* Left — Page title */}
            <div>
                <h1 className="font-bold text-lg" style={{ color: 'var(--color-surface-50)' }}>{title}</h1>
                {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>{subtitle}</p>}
            </div>

            {/* Center — Project selector pill */}
            {activeProject && (
                <button
                    onClick={() => navigate('/projects')}
                    className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all hover:border-teal-500/50"
                    style={{ background: 'rgba(20,184,166,0.08)', borderColor: 'rgba(20,184,166,0.25)', color: 'var(--color-brand-300)' }}
                >
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-surface-400)' }}>Active Project:</span>
                    <span className="text-sm font-bold">{activeProject.project_id ?? activeProject.id}</span>
                    <span className="text-xs hidden lg:block truncate max-w-40" style={{ color: 'var(--color-surface-300)' }}>{activeProject.project_name ?? activeProject.name}</span>
                    <span className="text-xs font-bold ml-2" style={{ color: 'var(--color-brand-400)' }}>
                        {activeProject.wo_value != null ? formatCurrency(activeProject.wo_value) : `${activeProject.progress?.toFixed(0) ?? 0}%`}
                    </span>
                    <ChevronDown size={14} />
                </button>
            )}

            {/* Right — Actions */}
            <div className="flex items-center gap-3">
                <button
                    className="relative p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--color-surface-300)' }}
                    onClick={() => navigate('/alerts')}
                    title="View Alerts"
                >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-white text-xs font-bold rounded-full" style={{ background: 'var(--color-danger)', fontSize: '10px' }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </header>
    )
}
