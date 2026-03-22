import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface KpiCardProps {
    title: string
    value: string | number
    isCurrency?: boolean
    unit?: string
    trend?: number // positive = good, negative = bad
    trendLabel?: string
    accentColor?: 'teal' | 'blue' | 'green' | 'amber' | 'red' | 'purple'
    icon?: React.ReactNode
    loading?: boolean
}

export function KpiCard({
    title,
    value,
    isCurrency = false,
    unit = '',
    trend,
    trendLabel,
    accentColor = 'teal',
    icon,
    loading,
}: KpiCardProps) {
    const displayValue = isCurrency
        ? formatCurrency(typeof value === 'number' ? value : parseFloat(String(value)))
        : `${value}${unit}`

    const trendIcon =
        trend == null ? null : trend > 0 ? (
            <ArrowUp size={12} />
        ) : trend < 0 ? (
            <ArrowDown size={12} />
        ) : (
            <Minus size={12} />
        )

    const trendColor =
        trend == null ? '' : trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : '#94a3b8'

    return (
        <div className={cn('glass-card p-5 glow-brand kpi-card', `kpi-card-${accentColor}`)}>
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-surface-400)' }}>
                        {title}
                    </p>
                    {loading ? (
                        <div className="h-7 w-28 rounded animate-pulse" style={{ background: 'rgba(51,65,85,0.5)' }} />
                    ) : (
                        <p className="text-2xl font-bold whitespace-nowrap leading-none" style={{ color: 'var(--color-surface-50)' }}>
                            {displayValue}
                        </p>
                    )}
                    {trend != null && trendLabel && (
                        <div className="flex items-center gap-1 mt-2" style={{ color: trendColor }}>
                            {trendIcon}
                            <span className="text-xs font-medium">{trendLabel}</span>
                        </div>
                    )}
                </div>
                {icon && (
                    <div className="ml-3 p-2.5 rounded-xl" style={{ background: 'rgba(51,65,85,0.4)' }}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    )
}
