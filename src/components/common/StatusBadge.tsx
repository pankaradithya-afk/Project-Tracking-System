import { cn, getStatusColor } from '@/lib/utils'

interface StatusBadgeProps {
    status: string
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <span className={cn('status-badge', getStatusColor(status), className)}>
            {status}
        </span>
    )
}
