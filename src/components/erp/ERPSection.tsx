import { Plus, Pencil, Trash2 } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'

type Column<T> = {
    key: keyof T | string
    header: string
    render?: {
        bivarianceHack(value: unknown, row: T): React.ReactNode
    }['bivarianceHack']
    sortable?: boolean
    width?: string
}

interface ERPSectionProps<T extends { id: string }> {
    title: string
    subtitle: string
    addLabel: string
    columns: Column<T>[]
    data: T[]
    loading?: boolean
    filterKeys?: (keyof T)[]
    searchPlaceholder?: string
    onAdd: () => void
    onEdit: (record: T) => void
    onDelete?: (record: T) => void
}

export function ERPSection<T extends { id: string }>({
    title,
    subtitle,
    addLabel,
    columns,
    data,
    loading,
    filterKeys,
    searchPlaceholder,
    onAdd,
    onEdit,
    onDelete,
}: ERPSectionProps<T>) {
    return (
        <section className="space-y-3">
            <div className="section-header">
                <div>
                    <p className="section-title">{title}</p>
                    <p className="section-subtitle">{subtitle}</p>
                </div>
                <button className="btn-primary" type="button" onClick={onAdd}>
                    <Plus size={15} />
                    {addLabel}
                </button>
            </div>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                keyExtractor={(record) => record.id}
                filterKeys={filterKeys}
                searchPlaceholder={searchPlaceholder ?? `Search ${title.toLowerCase()}...`}
                actions={(record) => (
                    <div className="flex gap-2">
                        <button
                            className="btn-secondary px-2 py-1 text-xs"
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onEdit(record)
                            }}
                        >
                            <Pencil size={13} />
                            Edit
                        </button>
                        {onDelete ? (
                            <button
                                className="btn-danger px-2 py-1 text-xs"
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onDelete(record)
                                }}
                            >
                                <Trash2 size={13} />
                                Delete
                            </button>
                        ) : null}
                    </div>
                )}
            />
        </section>
    )
}
