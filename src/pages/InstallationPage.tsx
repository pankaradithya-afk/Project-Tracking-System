import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { DataTable } from '@/components/common/DataTable'
import { Modal } from '@/components/common/Modal'
import { useProjectStore } from '@/stores/projectStore'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, generateRecordId } from '@/lib/utils'
import type { InstallationExecution, BOQContract, BOQSAPBreakup } from '@/types'

const defaultForm = { boq_ref: '', sap_boq_ref: '', execution_type: 'Meter', executed_qty: '', rate: '', resource_type: 'Labor', supervisor: '', certified_by: '', remarks: '' }

export default function InstallationPage() {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['installation_execution', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('installation_execution').select('*').eq('project_id', activeProject.id).order('execution_date', { ascending: false })
            return data as InstallationExecution[]
        },
        enabled: !!activeProject,
    })

    const { data: boqList = [] } = useQuery({
        queryKey: ['boq_for_exec', activeProject?.id],
        queryFn: async () => {
            if (!activeProject) return []
            const { data } = await supabase.from('boq_contract').select('boq_ref, description, contract_qty, uom').eq('project_id', activeProject.id)
            return data as Pick<BOQContract, 'boq_ref' | 'description' | 'contract_qty' | 'uom'>[]
        },
        enabled: !!activeProject,
    })

    const { data: sapList = [] } = useQuery({
        queryKey: ['sap_for_exec', activeProject?.id, form.boq_ref],
        queryFn: async () => {
            if (!activeProject || !form.boq_ref) return []
            const { data } = await supabase.from('boq_sap_breakup').select('sap_boq_ref, description').eq('project_id', activeProject.id).eq('parent_boq_ref', form.boq_ref)
            return data as Pick<BOQSAPBreakup, 'sap_boq_ref' | 'description'>[]
        },
        enabled: !!activeProject && !!form.boq_ref,
    })

    // Calculate already executed to show remaining balance
    const selectedBOQ = boqList.find(b => b.boq_ref === form.boq_ref)
    const executedSoFar = rows.filter(r => r.boq_ref === form.boq_ref).reduce((s, r) => s + r.executed_qty, 0)
    const remainingQty = selectedBOQ ? selectedBOQ.contract_qty - executedSoFar : null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeProject) return
        const execQty = parseFloat(form.executed_qty)
        if (remainingQty !== null && execQty > remainingQty) {
            setError(`Exceeded contract qty! Balance remaining: ${remainingQty?.toLocaleString()}`)
            return
        }
        setSaving(true); setError('')
        const execution_id = generateRecordId('EXEC')
        const { error: err } = await supabase.from('installation_execution').insert([{
            execution_id, project_id: activeProject.id,
            boq_ref: form.boq_ref, sap_boq_ref: form.sap_boq_ref,
            execution_type: form.execution_type, executed_qty: execQty,
            rate: form.rate ? parseFloat(form.rate) : null,
            resource_type: form.resource_type, supervisor: form.supervisor,
            certified_by: form.certified_by, remarks: form.remarks,
        }])
        setSaving(false)
        if (err) { setError(err.message); return }
        qc.invalidateQueries({ queryKey: ['installation_execution'] })
        setModalOpen(false); setForm(defaultForm)
    }

    const totalExecuted = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
    const columns = [
        { key: 'execution_id', header: 'Exec ID', sortable: true, width: '110px' },
        { key: 'execution_date', header: 'Date', render: (v: string) => formatDate(v), sortable: true },
        { key: 'boq_ref', header: 'BOQ Ref', sortable: true },
        { key: 'sap_boq_ref', header: 'SAP Ref', sortable: true },
        { key: 'execution_type', header: 'Type' },
        { key: 'executed_qty', header: 'Executed Qty', render: (v: number) => v?.toLocaleString() },
        { key: 'rate', header: 'Rate', render: (v: number) => v ? formatCurrency(v) : '—' },
        { key: 'amount', header: 'Amount', render: (v: number) => v ? formatCurrency(v) : '—', sortable: true },
        { key: 'resource_type', header: 'Resource' },
        { key: 'supervisor', header: 'Supervisor' },
    ]

    if (!activeProject) return (
        <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Please select an active project first.</p></div>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="section-header">
                <div><p className="section-title">Installation Execution</p><p className="section-subtitle">{rows.length} entries · Total Executed: <strong style={{ color: 'var(--color-brand-300)' }}>{formatCurrency(totalExecuted)}</strong></p></div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Log Execution</button>
            </div>
            <DataTable columns={columns} data={rows} loading={isLoading} keyExtractor={r => r.id} filterKeys={['execution_id', 'boq_ref', 'sap_boq_ref', 'supervisor']} />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Installation Execution" maxWidth="lg" loading={saving}
                footer={<><button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" form="exec-form" type="submit">Save</button></>}
            >
                <form id="exec-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    {error && <div className="col-span-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
                    <div className="col-span-2">
                        <label className="form-label">BOQ Item *</label>
                        <select className="form-input" required value={form.boq_ref} onChange={e => setForm(f => ({ ...f, boq_ref: e.target.value, sap_boq_ref: '' }))}>
                            <option value="">— Select BOQ —</option>
                            {boqList.map(b => <option key={b.boq_ref} value={b.boq_ref}>{b.boq_ref} — {b.description} (Contract: {b.contract_qty} {b.uom})</option>)}
                        </select>
                    </div>
                    {form.boq_ref && remainingQty !== null && (
                        <div className="col-span-2 p-3 rounded-lg" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Balance remaining to execute</p>
                            <p className="text-lg font-bold" style={{ color: remainingQty <= 0 ? '#f87171' : '#34d399' }}>{remainingQty.toLocaleString()} {selectedBOQ?.uom}</p>
                        </div>
                    )}
                    <div>
                        <label className="form-label">SAP Ref *</label>
                        <select className="form-input" required value={form.sap_boq_ref} onChange={e => setForm(f => ({ ...f, sap_boq_ref: e.target.value }))}>
                            <option value="">— Select SAP —</option>
                            {sapList.map(s => <option key={s.sap_boq_ref} value={s.sap_boq_ref}>{s.sap_boq_ref} — {s.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Type *</label>
                        <select className="form-input" value={form.execution_type} onChange={e => setForm(f => ({ ...f, execution_type: e.target.value }))}>
                            <option>Hole</option><option>Round</option><option>LS</option><option>Meter</option><option>Each</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Executed Qty *</label>
                        <input type="number" className="form-input" required min="0.01" max={remainingQty ?? undefined} step="0.01" value={form.executed_qty} onChange={e => setForm(f => ({ ...f, executed_qty: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Rate (₹)</label>
                        <input type="number" className="form-input" min="0" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Resource Type</label>
                        <select className="form-input" value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}>
                            <option>Labor</option><option>Subcontract</option><option>Equipment</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Supervisor</label>
                        <input className="form-input" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Certified By</label>
                        <input className="form-input" value={form.certified_by} onChange={e => setForm(f => ({ ...f, certified_by: e.target.value }))} />
                    </div>
                    <div className="col-span-2"><label className="form-label">Remarks</label><textarea className="form-input" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </form>
            </Modal>
        </div>
    )
}
