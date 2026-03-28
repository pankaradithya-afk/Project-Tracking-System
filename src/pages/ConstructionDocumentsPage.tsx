import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, FileText, Upload } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { DataTable } from '@/components/common/DataTable'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { formatDate } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { deleteRecord, getDocumentLinkOptions, getDocumentsSnapshot, uploadModuleDocument } from '@/services/constructionErpService'
import type { ModuleDocument } from '@/types/constructionErp'

const defaultForm = {
    module_name: 'Purchase Order',
    record_id: '',
}

export default function ConstructionDocumentsPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const { data: profile } = useCurrentProfile()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [file, setFile] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: documents = [], isLoading } = useQuery({
        queryKey: ['construction-erp-documents', activeProject?.id],
        queryFn: () => getDocumentsSnapshot(activeProject!.id),
        enabled: !!activeProject,
    })
    const { data: linkOptions = [] } = useQuery({
        queryKey: ['construction-erp-document-links', activeProject?.id],
        queryFn: () => getDocumentLinkOptions(activeProject!.id),
        enabled: !!activeProject,
    })

    const filteredLinks = linkOptions.filter((option) => option.moduleName === form.module_name)
    const selectedLink = filteredLinks.find((option) => option.id === form.record_id) ?? null

    const closeModal = () => {
        setModalOpen(false)
        setForm(defaultForm)
        setFile(null)
        setError('')
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!activeProject || !file) {
            setError('Choose a file before uploading.')
            return
        }

        if (!selectedLink) {
            setError('Select the ERP record this document belongs to.')
            return
        }

        setSaving(true)
        setError('')

        try {
            await uploadModuleDocument({
                projectId: activeProject.id,
                moduleName: form.module_name,
                recordId: selectedLink.id,
                recordSystemId: selectedLink.systemId,
                uploadedBy: profile?.id ?? null,
                file,
            })
            await qc.invalidateQueries({ queryKey: ['construction-erp-documents', activeProject.id] })
            closeModal()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Upload failed.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (record: ModuleDocument) => {
        if (!window.confirm('Delete this document record?')) return
        await deleteRecord('module_documents', record.id)
        await qc.invalidateQueries({ queryKey: ['construction-erp-documents', activeProject?.id] })
    }

    if (!activeProject) {
        return <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Select an active project to manage module documents.</p></div>
    }

    return (
        <div className="space-y-6">
            <div className="glass-card p-5">
                <p className="text-sm leading-6" style={{ color: 'var(--color-surface-300)' }}>
                    Upload module-linked documents to Supabase Storage for <strong>{activeProject.name}</strong>. Records stay attached to their ERP module and system reference number.
                </p>
            </div>

            <div className="section-header">
                <div>
                    <p className="section-title">Module Documents</p>
                    <p className="section-subtitle">{documents.length} uploaded files</p>
                </div>
                <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
                    <Upload size={15} />
                    Upload Document
                </button>
            </div>

            <DataTable
                columns={[
                    { key: 'module_name', header: 'Module', sortable: true },
                    { key: 'record_system_id', header: 'Reference', render: (value: string | null) => value ?? 'NA', sortable: true },
                    { key: 'file_name', header: 'File', sortable: true },
                    { key: 'created_at', header: 'Uploaded', render: (value: string) => formatDate(value), sortable: true },
                    {
                        key: 'public_url',
                        header: 'Open',
                        render: (_: unknown, row: ModuleDocument) => (
                            <a href={row.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--color-brand-300)' }}>
                                <ExternalLink size={13} />
                                View
                            </a>
                        ),
                    },
                ]}
                data={documents}
                loading={isLoading}
                keyExtractor={(record) => record.id}
                filterKeys={['module_name', 'record_system_id', 'file_name']}
                searchPlaceholder="Search documents..."
                actions={(record) => (
                    <button className="btn-danger px-2 py-1 text-xs" type="button" onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(record)
                    }}>
                        Delete
                    </button>
                )}
            />

            <Modal
                open={modalOpen}
                onClose={closeModal}
                title="Upload ERP Document"
                loading={saving}
                maxWidth="lg"
                footer={(
                    <>
                        <button className="btn-secondary" type="button" onClick={closeModal}>Cancel</button>
                        <button className="btn-primary" type="submit" form="erp-document-form">Upload</button>
                    </>
                )}
            >
                <form id="erp-document-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error ? <div className="col-span-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>{error}</div> : null}
                    <div>
                        <label className="form-label">Module *</label>
                        <select className="form-input" required value={form.module_name} onChange={(event) => setForm((current) => ({ ...current, module_name: event.target.value, record_id: '' }))}>
                            {['Purchase Request', 'Purchase Order', 'Goods Receipt', 'Daily Progress Report', 'Vendor Contract', 'Vendor Invoice', 'Payment', 'RA Bill'].map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Linked Record *</label>
                        <select className="form-input" required value={form.record_id} onChange={(event) => setForm((current) => ({ ...current, record_id: event.target.value }))}>
                            <option value="">Select record</option>
                            {filteredLinks.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-2 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                        Reference: {selectedLink?.systemId ?? 'Select a record to attach this document.'}
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">File *</label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-4" style={{ borderColor: 'rgba(51,65,85,0.55)' }}>
                            <FileText size={18} style={{ color: 'var(--color-brand-300)' }} />
                            <span className="text-sm" style={{ color: 'var(--color-surface-300)' }}>{file ? file.name : 'Choose document'}</span>
                            <input className="hidden" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                        </label>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
