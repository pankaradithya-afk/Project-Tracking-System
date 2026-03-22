import { cn, getStatusColor } from '@/lib/utils'

interface StatusBadgeProps {
    status: string
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const label = status.replace(/_/g, ' ')
    return (
        <span className={cn('status-badge', getStatusColor(status), className)}>
            {label}
        </span>
    )
}
