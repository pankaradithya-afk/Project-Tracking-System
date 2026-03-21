import { X, Loader2 } from 'lucide-react'
import { type ReactNode } from 'react'

interface ModalProps {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
    footer?: ReactNode
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    loading?: boolean
}

const maxWidthMap = {
    sm: '28rem',
    md: '36rem',
    lg: '48rem',
    xl: '60rem',
    '2xl': '72rem',
    '3xl': '84rem',
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'md', loading }: ModalProps) {
    if (!open) return null

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="modal-content" style={{ maxWidth: maxWidthMap[maxWidth] }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
                    <h2 className="font-bold text-base" style={{ color: 'var(--color-surface-50)' }}>{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-surface-400)' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 relative">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl z-10" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)' }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-brand-400)' }} />
                        </div>
                    )}
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'rgba(51,65,85,0.5)' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
