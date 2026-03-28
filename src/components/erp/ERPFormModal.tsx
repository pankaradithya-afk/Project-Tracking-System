import { Modal } from '@/components/common/Modal'

export type ERPFieldOption = {
    label: string
    value: string
}

export type ERPFieldConfig = {
    name: string
    label: string
    type?: 'text' | 'number' | 'date' | 'select' | 'textarea'
    required?: boolean
    disabled?: boolean
    placeholder?: string
    options?: ERPFieldOption[]
    min?: number
    step?: number
    rows?: number
    colSpan?: 1 | 2
}

interface ERPFormModalProps {
    open: boolean
    title: string
    loading?: boolean
    error?: string
    fields: ERPFieldConfig[]
    values: Record<string, string>
    submitLabel: string
    onClose: () => void
    onChange: (name: string, value: string) => void
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    extraContent?: React.ReactNode
}

export function ERPFormModal({
    open,
    title,
    loading,
    error,
    fields,
    values,
    submitLabel,
    onClose,
    onChange,
    onSubmit,
    extraContent,
}: ERPFormModalProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            maxWidth="xl"
            loading={loading}
            footer={(
                <>
                    <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
                    <button className="btn-primary" form="erp-record-form" type="submit">{submitLabel}</button>
                </>
            )}
        >
            <form id="erp-record-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
                {error ? (
                    <div className="col-span-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>
                        {error}
                    </div>
                ) : null}
                {fields.map((field) => {
                    const value = values[field.name] ?? ''
                    const className = field.colSpan === 2 ? 'col-span-2' : ''

                    if (field.type === 'textarea') {
                        return (
                            <div key={field.name} className={className}>
                                <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
                                <textarea
                                    className="form-input"
                                    rows={field.rows ?? 3}
                                    required={field.required}
                                    disabled={field.disabled}
                                    placeholder={field.placeholder}
                                    value={value}
                                    onChange={(event) => onChange(field.name, event.target.value)}
                                />
                            </div>
                        )
                    }

                    if (field.type === 'select') {
                        return (
                            <div key={field.name} className={className}>
                                <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
                                <select
                                    className="form-input"
                                    required={field.required}
                                    disabled={field.disabled}
                                    value={value}
                                    onChange={(event) => onChange(field.name, event.target.value)}
                                >
                                    <option value="">Select...</option>
                                    {(field.options ?? []).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )
                    }

                    return (
                        <div key={field.name} className={className}>
                            <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
                            <input
                                className="form-input"
                                type={field.type ?? 'text'}
                                required={field.required}
                                disabled={field.disabled}
                                placeholder={field.placeholder}
                                min={field.min}
                                step={field.step}
                                value={value}
                                onChange={(event) => onChange(field.name, event.target.value)}
                            />
                        </div>
                    )
                })}
                {extraContent ? <div className="col-span-2">{extraContent}</div> : null}
            </form>
        </Modal>
    )
}
