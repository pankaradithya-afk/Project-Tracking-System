import { cn, formatStatusLabel, getStatusColor } from '@/lib/utils'

interface StatusBadgeProps {
    status: string
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const label = formatStatusLabel(status)
    return (
        <span className={cn('status-badge', getStatusColor(status), className)}>
            {label}
        </span>
    )
}
