import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format a number as Indian Rupee currency
 */
export function formatCurrency(value: number | null | undefined): string {
    if (value == null) return '₹0.00'
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(value)
}

/**
 * Format a date string to a readable format
 */
export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A'
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date))
}

/**
 * Generate a sequence-based reference number
 * e.g., prefix='PR', num=5, padLength=4 => 'PR-0005'
 */
export function generateRefNo(prefix: string, num: number, padLength = 3): string {
    return `${prefix}-${String(num).padStart(padLength, '0')}`
}

/**
 * Generate a collision-resistant record identifier for multi-user writes.
 */
export function generateRecordId(prefix: string): string {
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
    const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()
    return `${prefix}-${timestamp}-${suffix}`
}

/**
 * Generate a project identifier while keeping the current year visible.
 */
export function generateProjectId(): string {
    return `PRJ-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

/**
 * Calculate percentage, safely (avoids divide by zero)
 */
export function safePercent(value: number, total: number): number {
    if (!total || total === 0) return 0
    return Math.min(100, (value / total) * 100)
}

/**
 * Return a status badge color class based on a status string
 */
export function getStatusColor(status: string): string {
    const map: Record<string, string> = {
        Active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        Completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'On Hold': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        planning: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        archived: 'bg-slate-600/20 text-slate-300 border-slate-600/30',
        todo: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        Approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        Draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        Submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        Rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
        'PO Created': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        Open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        Issued: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        Partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        Received: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        Closed: 'bg-slate-600/20 text-slate-300 border-slate-600/30',
        Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
        Certified: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        Paid: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30',
        Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        Accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        High: 'bg-red-500/20 text-red-400 border-red-500/30',
        Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        Low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        Delayed: 'bg-red-500/20 text-red-400 border-red-500/30',
        'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Not Started': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return map[status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export function getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
        low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return map[priority] ?? map.low
}

export function getProjectProgressClass(progress: number): string {
    if (progress >= 100) return 'progress-fill-green'
    if (progress >= 75) return 'progress-fill-blue'
    if (progress >= 50) return 'progress-fill-teal'
    if (progress >= 25) return 'progress-fill-amber'
    return 'progress-fill-red'
}

/**
 * Truncate text to a max length
 */
export function truncate(text: string, length = 50): string {
    if (text.length <= length) return text
    return text.slice(0, length) + '...'
}

