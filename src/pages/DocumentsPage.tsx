import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle, FileText, ExternalLink } from 'lucide-react'
import { formatDate, generateRecordId } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { DocumentRegister } from '@/types'

const defaultForm = { doc_type: 'Drawing', doc_no: '', description: '', received_date: '', submitted_date: '', reference_id: '', remarks: '' }

export default function DocumentsPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [file, setFile] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['document_register', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('document_register').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false })
            return data as DocumentRegister[]
        },
        enabled: !!activeProject,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        setSaving(true); setError('')
        const doc_id = generateRecordId('DOC')

        let file_url: string | undefined
        let file_name: string | undefined
        let file_size: number | undefined
        let mime_type: string | undefined

        if (file) {
            const path = `projects/${activeProject.id}/${form.doc_type.toLowerCase()}/${Date.now()}_${file.name}`
            const { data: upload, error: uploadError } = await supabase.storage.from('project-documents').upload(path, file)
            if (uploadError) {
                setSaving(false)
                setError(uploadError.message)
                return
            }
            if (upload) {
                const { data: { publicUrl } } = supabase.storage.from('project-documents').getPublicUrl(upload.path)
                file_url = publicUrl
                file_name = file.name
                file_size = file.size
                mime_type = file.type
            } else {
                setSaving(false)
                setError('Document upload failed before a file URL was created.')
                return
            }
        }

        const { error: err } = await supabase.from('document_register').insert([{
            doc_id, project_id: activeProject.id, doc_type: form.doc_type,
            doc_no: form.doc_no || null, description: form.description,
            received_date: form.received_date || null, submitted_date: form.submitted_date || null,
            reference_id: form.reference_id || null, remarks: form.remarks,
            file_url, file_name, file_size, mime_type,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['document_register'] })
        setModalOpen(false); setForm(defaultForm); setFile(null)
    }

    const columns = [
        { key: 'doc_id', header: 'Doc ID', sortable: true },
        { key: 'doc_type', header: 'Type', render: (v: string) => <StatusBadge status={v} /> },
        { key: 'doc_no', header: 'Doc No', render: (v: string) => v ?? '—' },
        { key: 'description', header: 'Description' },
        { key: 'received_date', header: 'Received', render: (v: string) => v ? formatDate(v) : '—' },
        {
            key: 'file_name', header: 'File', render: (_: unknown, row: DocumentRegister) => row.file_url ? (
                <a href={row.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-brand-400)' }} onClick={e => e.stopPropagation()}>
                    <FileText size={13} /> {row.file_name ?? 'View'} <ExternalLink size={11} />
                </a>
            ) : '—'
        },
        { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Document Register</p><p className="section-subtitle">{rows.length} documents</p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Upload Document</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['doc_id', 'doc_type', 'description', 'doc_no']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload Document" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="doc-form" type="submit">Upload</button></>}
            >
                <form id="doc-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div><label className="form-label">Document Type *</label><select className="form-input" value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}><option>Drawing</option><option>Approval</option><option>Certificate</option><option>Invoice</option><option>Report</option><option>Photo</option><option>Other</option></select></div>
                    <div><label className="form-label">Document No</label><input className="form-input" value={form.doc_no} onChange={e => setForm(f => ({ ...f, doc_no: e.target.value }))} /></div>
                    <div className="col-span-2"><label className="form-label">Description *</label><input className="form-input" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                    <div><label className="form-label">Received Date</label><input type="date" className="form-input" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} /></div>
                    <div><label className="form-label">Reference ID</label><input className="form-input" value={form.reference_id} onChange={e => setForm(f => ({ ...f, reference_id: e.target.value }))} placeholder="PO#, Invoice#..." /></div>
                    <div className="col-span-2">
                        <label className="form-label">File Upload (Supabase Storage)</label>
                        <input type="file" className="form-input py-2" onChange={e => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.jpg,.jpeg,.png,.dwg,.xlsx,.docx" />
                        <p className="text-xs mt-1" style={{ color: 'var(--color-surface-400)' }}>Supported: PDF, Images, DWG, Excel, Word</p>
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
