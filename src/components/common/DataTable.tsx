import { type ReactNode, useState } from 'react'
import { ChevronUp, ChevronDown, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type RenderFn<T> = {
    bivarianceHack(value: unknown, row: T): ReactNode
}['bivarianceHack']

interface Column<T> {
    key: keyof T | string
    header: string
    render?: RenderFn<T>
    sortable?: boolean
    width?: string
}

interface DataTableProps<T> {
    columns: Column<T>[]
    data: T[]
    loading?: boolean
    emptyMessage?: string
    searchable?: boolean
    searchPlaceholder?: string
    filterKeys?: (keyof T)[]
    onRowClick?: (row: T) => void
    actions?: (row: T) => ReactNode
    keyExtractor: (row: T) => string
}

export function DataTable<T extends object>({
    columns,
    data,
    loading,
    emptyMessage = 'No records found.',
    searchable = true,
    searchPlaceholder = 'Search...',
    filterKeys,
    onRowClick,
    actions,
    keyExtractor,
}: DataTableProps<T>) {
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        else {
            setSortKey(key)
            setSortDir('asc')
        }
    }

    const getCellValue = (row: T, key: keyof T | string): unknown => (row as Record<string, unknown>)[String(key)]

    const filtered = data.filter((row) => {
        if (!search) return true
        const keys = filterKeys ?? (columns.map((c) => c.key) as (keyof T)[])
        return keys.some((key) => {
            const val = getCellValue(row, key)
            return String(val ?? '').toLowerCase().includes(search.toLowerCase())
        })
    })

    const sorted = [...filtered].sort((a, b) => {
        if (!sortKey) return 0
        const av = getCellValue(a, sortKey)
        const bv = getCellValue(b, sortKey)
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
    })

    return (
        <div className="glass-card overflow-hidden">
            {searchable && (
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
                    <Search size={16} style={{ color: 'var(--color-surface-400)' }} />
                    <input
                        className="bg-transparent flex-1 text-sm outline-none"
                        style={{ color: 'var(--color-surface-200)' }}
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Clear</button>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={String(col.key)}
                                    style={{ width: col.width }}
                                    onClick={() => col.sortable && toggleSort(String(col.key))}
                                    className={cn(col.sortable ? 'cursor-pointer select-none' : '')}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && (
                                            <span style={{ color: sortKey === col.key ? 'var(--color-brand-400)' : 'var(--color-surface-500)' }}>
                                                {sortKey === col.key && sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12">
                                    <Loader2 size={24} className="animate-spin mx-auto" style={{ color: 'var(--color-brand-400)' }} />
                                </td>
                            </tr>
                        ) : sorted.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12 text-sm" style={{ color: 'var(--color-surface-400)' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            sorted.map((row) => (
                                <tr
                                    key={keyExtractor(row)}
                                    onClick={() => onRowClick?.(row)}
                                    className={cn(onRowClick ? 'cursor-pointer' : '')}
                                >
                                    {columns.map((col) => (
                                        <td key={String(col.key)}>
                                            {col.render
                                                ? col.render(getCellValue(row, col.key), row)
                                                : String(getCellValue(row, col.key) ?? '—')}
                                        </td>
                                    ))}
                                    {actions && <td>{actions(row)}</td>}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {sorted.length > 0 && (
                <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'rgba(51,65,85,0.3)', color: 'var(--color-surface-400)' }}>
                    Showing {sorted.length} of {data.length} records
                    {search && ` (filtered from ${data.length})`}
                </div>
            )}
        </div>
    )
}
