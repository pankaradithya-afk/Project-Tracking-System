import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { ERPFormModal, type ERPFieldConfig } from '@/components/erp/ERPFormModal'
import { ERPSection } from '@/components/erp/ERPSection'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { createRecord, deleteRecord, getERPReferenceData, getExecutionSnapshot, toNullable, toNumber, updateRecord } from '@/services/constructionErpService'
import type { DailyProgressReport, FuelLog, MachineryDailyLog, VendorContract } from '@/types/constructionErp'

type SectionKey = 'dpr' | 'contracts' | 'machineryLogs' | 'fuelLogs'
type ExecutionFocus = 'all' | 'contracts' | 'logs'

const emptyForm = {
    sap_ref_no: '',
    report_date: '',
    activity: '',
    work_description: '',
    quantity_executed: '0',
    labour_count: '0',
    machinery_used: '',
    issues: '',
    photo_url: '',
    cost_code_id: '',
    boq_line_id: '',
    vendor_id: '',
    contract_type: 'Machinery',
    rate_type: 'monthly',
    contract_rate: '0',
    machine_name: '',
    monthly_rate: '0',
    hourly_rate: '',
    rate_per_litre: '',
    start_date: '',
    end_date: '',
    terms_conditions: '',
    terms: '',
    billing_cycle: 'monthly',
    status: 'draft',
    contract_id: '',
    log_date: '',
    working_hours: '0',
    idle_hours: '0',
    fuel_consumption: '0',
    operator_name: '',
    litres_consumed: '0',
    rate: '0',
    log_status: 'draft',
}

const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Closed', value: 'closed' },
]

export default function ConstructionExecutionPage({ focus = 'all' }: { focus?: ExecutionFocus }) {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const { data: profile } = useCurrentProfile()
    const [modalSection, setModalSection] = useState<SectionKey | null>(null)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<Record<string, string>>(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: snapshot, isLoading } = useQuery({
        queryKey: ['construction-erp-execution', activeProject?.id],
        queryFn: () => getExecutionSnapshot(activeProject!.id),
        enabled: !!activeProject,
    })

    const { data: reference } = useQuery({
        queryKey: ['construction-erp-execution-reference', activeProject?.id],
        queryFn: () => getERPReferenceData(activeProject?.id),
        enabled: !!activeProject,
    })

    const dprs = snapshot?.dprs ?? []
    const contracts = snapshot?.contracts ?? []
    const machineryLogs = snapshot?.machineryLogs ?? []
    const fuelLogs = snapshot?.fuelLogs ?? []
    const vendors = reference?.vendors ?? []
    const costCodes = reference?.costCodes ?? []

    const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors])
    const costCodeMap = useMemo(() => new Map(costCodes.map((costCode) => [costCode.id, `${costCode.code} - ${costCode.description}`])), [costCodes])
    const contractMap = useMemo(() => new Map(contracts.map((contract) => [contract.id, contract.contract_id])), [contracts])
    const showContracts = focus === 'all' || focus === 'contracts'
    const showLogs = focus === 'all' || focus === 'logs'
    const showDpr = focus !== 'contracts'

    const closeModal = () => {
        setModalSection(null)
        setModalMode('create')
        setEditingId(null)
        setForm(emptyForm)
        setError('')
    }

    const openSection = (section: SectionKey, values: Record<string, string> = {}, id?: string) => {
        setModalSection(section)
        setModalMode(id ? 'edit' : 'create')
        setEditingId(id ?? null)
        setForm({
            ...emptyForm,
            report_date: new Date().toISOString().slice(0, 10),
            start_date: new Date().toISOString().slice(0, 10),
            end_date: new Date().toISOString().slice(0, 10),
            log_date: new Date().toISOString().slice(0, 10),
            status: 'draft',
            ...values,
        })
        setError('')
    }

    const invalidate = async () => {
        await qc.invalidateQueries({ queryKey: ['construction-erp-execution', activeProject?.id] })
        await qc.invalidateQueries({ queryKey: ['construction-erp-dashboard'] })
    }

    const handleDelete = async (section: SectionKey, id: string) => {
        const tableMap: Record<SectionKey, string> = {
            dpr: 'daily_progress_reports',
            contracts: 'vendor_contracts',
            machineryLogs: 'machinery_daily_logs',
            fuelLogs: 'fuel_logs',
        }
        if (!window.confirm('Delete this record?')) return
        await deleteRecord(tableMap[section], id)
        await invalidate()
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!modalSection || !activeProject) return
        setSaving(true)
        setError('')

        try {
            if (modalSection === 'dpr') {
                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    project_id: activeProject.id,
                    cost_code_id: toNullable(form.cost_code_id),
                    boq_line_id: toNullable(form.boq_line_id),
                    report_date: form.report_date,
                    activity: form.activity,
                    work_description: form.work_description,
                    quantity_executed: toNumber(form.quantity_executed),
                    labour_count: Math.round(toNumber(form.labour_count)),
                    machinery_used: toNullable(form.machinery_used),
                    issues: toNullable(form.issues),
                    remarks: toNullable(form.issues),
                    photo_url: toNullable(form.photo_url),
                    created_by: profile?.id ?? null,
                    status: form.status,
                }
                if (editingId) await updateRecord<DailyProgressReport>('daily_progress_reports', editingId, payload)
                else await createRecord<DailyProgressReport>('daily_progress_reports', payload)
            }

            if (modalSection === 'contracts') {
                const selectedRate = toNumber(form.contract_rate)
                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    vendor_id: form.vendor_id,
                    project_id: activeProject.id,
                    cost_code_id: toNullable(form.cost_code_id),
                    contract_type: form.contract_type,
                    rate_type: form.rate_type,
                    rate: selectedRate,
                    machine_name: toNullable(form.machine_name),
                    monthly_rate: form.rate_type === 'monthly' ? selectedRate : toNumber(form.monthly_rate),
                    hourly_rate: form.rate_type === 'hourly' ? selectedRate : form.hourly_rate ? toNumber(form.hourly_rate) : null,
                    rate_per_litre: form.rate_type === 'per_litre' ? selectedRate : form.rate_per_litre ? toNumber(form.rate_per_litre) : null,
                    start_date: form.start_date,
                    end_date: form.end_date,
                    terms_conditions: toNullable(form.terms_conditions),
                    terms: toNullable(form.terms),
                    billing_cycle: form.billing_cycle,
                    status: form.status,
                }
                if (editingId) await updateRecord<VendorContract>('vendor_contracts', editingId, payload)
                else await createRecord<VendorContract>('vendor_contracts', payload)
            }

            if (modalSection === 'machineryLogs') {
                const payload = {
                    contract_id: form.contract_id,
                    machine_name: form.machine_name,
                    log_date: form.log_date,
                    working_hours: toNumber(form.working_hours),
                    idle_hours: toNumber(form.idle_hours),
                    fuel_consumption: toNumber(form.fuel_consumption),
                    operator_name: toNullable(form.operator_name),
                    status: form.log_status,
                }
                if (editingId) await updateRecord<MachineryDailyLog>('machinery_daily_logs', editingId, payload)
                else await createRecord<MachineryDailyLog>('machinery_daily_logs', payload)
            }

            if (modalSection === 'fuelLogs') {
                const payload = {
                    contract_id: form.contract_id,
                    project_id: activeProject.id,
                    log_date: form.log_date,
                    machine_name: form.machine_name,
                    litres_consumed: toNumber(form.litres_consumed),
                    rate: toNumber(form.rate),
                    status: form.log_status,
                }
                if (editingId) await updateRecord<FuelLog>('fuel_logs', editingId, payload)
                else await createRecord<FuelLog>('fuel_logs', payload)
            }

            await invalidate()
            closeModal()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to save record.')
        } finally {
            setSaving(false)
        }
    }

    const fields: Record<SectionKey, ERPFieldConfig[]> = {
        dpr: [
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'report_date', label: 'Report Date', type: 'date', required: true },
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', required: true, options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'boq_line_id', label: 'BOQ Line ID' },
            { name: 'activity', label: 'Activity', required: true },
            { name: 'work_description', label: 'Work Description', type: 'textarea', colSpan: 2, required: true },
            { name: 'quantity_executed', label: 'Quantity Executed', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'labour_count', label: 'Labour Count', type: 'number', min: 0, step: 1, required: true },
            { name: 'machinery_used', label: 'Machinery Used' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'photo_url', label: 'Photo URL' },
            { name: 'issues', label: 'Issues', type: 'textarea', colSpan: 2 },
        ],
        contracts: [
            { name: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', required: true, options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'contract_type', label: 'Contract Type', type: 'select', required: true, options: [{ label: 'Machinery', value: 'Machinery' }, { label: 'Fuel', value: 'Fuel' }, { label: 'Service', value: 'Service' }] },
            { name: 'rate_type', label: 'Rate Type', type: 'select', required: true, options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Hourly', value: 'hourly' }, { label: 'Per Litre', value: 'per_litre' }] },
            { name: 'contract_rate', label: 'Base Rate', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'machine_name', label: 'Machine / Scope Name' },
            { name: 'monthly_rate', label: 'Monthly Rate', type: 'number', min: 0, step: 0.01 },
            { name: 'hourly_rate', label: 'Hourly Rate', type: 'number', min: 0, step: 0.01 },
            { name: 'rate_per_litre', label: 'Rate / Litre', type: 'number', min: 0, step: 0.01 },
            { name: 'start_date', label: 'Start Date', type: 'date', required: true },
            { name: 'end_date', label: 'End Date', type: 'date', required: true },
            { name: 'billing_cycle', label: 'Billing Cycle', type: 'select', required: true, options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Weekly', value: 'weekly' }, { label: 'One Time', value: 'one_time' }] },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'terms_conditions', label: 'Terms & Conditions', type: 'textarea', colSpan: 2 },
            { name: 'terms', label: 'Billing Terms', type: 'textarea', colSpan: 2 },
        ],
        machineryLogs: [
            { name: 'contract_id', label: 'Contract', type: 'select', required: true, options: contracts.filter((contract) => contract.contract_type === 'Machinery').map((contract) => ({ value: contract.id, label: `${contract.contract_id} - ${vendorMap.get(contract.vendor_id) ?? 'Vendor'}` })) },
            { name: 'machine_name', label: 'Machine Name', required: true },
            { name: 'log_date', label: 'Date', type: 'date', required: true },
            { name: 'working_hours', label: 'Working Hours', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'idle_hours', label: 'Idle Hours', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'fuel_consumption', label: 'Fuel Consumption', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'operator_name', label: 'Operator Name' },
            { name: 'log_status', label: 'Status', type: 'select', required: true, options: statusOptions },
        ],
        fuelLogs: [
            { name: 'contract_id', label: 'Fuel Contract', type: 'select', required: true, options: contracts.filter((contract) => contract.contract_type === 'Fuel').map((contract) => ({ value: contract.id, label: `${contract.contract_id} - ${vendorMap.get(contract.vendor_id) ?? 'Vendor'}` })) },
            { name: 'machine_name', label: 'Machine', required: true },
            { name: 'log_date', label: 'Date', type: 'date', required: true },
            { name: 'litres_consumed', label: 'Litres Consumed', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'rate', label: 'Rate', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'log_status', label: 'Status', type: 'select', required: true, options: statusOptions },
        ],
    }

    if (!activeProject) {
        return <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Select an active project to manage execution and contract logs.</p></div>
    }

    return (
        <div className="space-y-6">
            <div className="glass-card p-5">
                <p className="text-sm leading-6" style={{ color: 'var(--color-surface-300)' }}>
                    Capture daily progress, vendor contracts, machinery utilization, and fuel usage for <strong>{activeProject.name}</strong>. Contract logs drive invoice validation automatically in finance.
                </p>
            </div>

            {showDpr ? (
            <ERPSection
                title="Daily Progress Reports"
                subtitle={`${dprs.length} DPR entries`}
                addLabel="New DPR"
                data={dprs}
                loading={isLoading}
                columns={[
                    { key: 'system_id', header: 'DPR No', sortable: true },
                    { key: 'report_date', header: 'Date', render: (value: string) => formatDate(value), sortable: true },
                    { key: 'cost_code_id', header: 'Cost Code', render: (value: string | null) => value ? costCodeMap.get(value) ?? value : 'NA' },
                    { key: 'activity', header: 'Activity', sortable: true },
                    { key: 'work_description', header: 'Description' },
                    { key: 'quantity_executed', header: 'Qty', sortable: true },
                    { key: 'labour_count', header: 'Labour', sortable: true },
                    { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                ]}
                filterKeys={['activity', 'work_description']}
                onAdd={() => openSection('dpr')}
                onEdit={(record) => openSection('dpr', { sap_ref_no: record.sap_ref_no ?? '', report_date: record.report_date, cost_code_id: record.cost_code_id ?? '', boq_line_id: record.boq_line_id ?? '', activity: record.activity, work_description: record.work_description, quantity_executed: String(record.quantity_executed), labour_count: String(record.labour_count), machinery_used: record.machinery_used ?? '', issues: record.issues ?? '', photo_url: record.photo_url ?? '', status: record.status }, record.id)}
                onDelete={(record) => void handleDelete('dpr', record.id)}
            />
            ) : null}

            {showContracts ? (
            <ERPSection
                title="Vendor Contracts"
                subtitle={`${contracts.length} machinery, fuel, and service contracts`}
                addLabel="New Contract"
                data={contracts}
                loading={isLoading}
                columns={[
                    { key: 'contract_id', header: 'Contract ID', sortable: true },
                    { key: 'sap_ref_no', header: 'SAP Ref', render: (value: string | null) => value ?? 'NA' },
                    { key: 'vendor_id', header: 'Vendor', render: (value: string) => vendorMap.get(value) ?? value, sortable: true },
                    { key: 'contract_type', header: 'Type', render: (value: string) => <StatusBadge status={value} /> },
                    { key: 'cost_code_id', header: 'Cost Code', render: (value: string | null) => value ? costCodeMap.get(value) ?? value : 'NA' },
                    { key: 'rate_type', header: 'Rate Type', render: (value: string | null) => value ? <StatusBadge status={value} /> : 'NA' },
                    { key: 'rate', header: 'Rate', render: (value: number | null) => formatCurrency(value ?? 0), sortable: true },
                    { key: 'start_date', header: 'Start', render: (value: string) => formatDate(value), sortable: true },
                    { key: 'end_date', header: 'End', render: (value: string) => formatDate(value), sortable: true },
                    { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                ]}
                filterKeys={['contract_id', 'machine_name']}
                onAdd={() => openSection('contracts')}
                onEdit={(record) => openSection('contracts', { sap_ref_no: record.sap_ref_no ?? '', vendor_id: record.vendor_id, cost_code_id: record.cost_code_id ?? '', contract_type: record.contract_type, rate_type: record.rate_type ?? 'monthly', contract_rate: String(record.rate ?? 0), machine_name: record.machine_name ?? '', monthly_rate: String(record.monthly_rate), hourly_rate: record.hourly_rate ? String(record.hourly_rate) : '', rate_per_litre: record.rate_per_litre ? String(record.rate_per_litre) : '', start_date: record.start_date, end_date: record.end_date, terms_conditions: record.terms_conditions ?? '', terms: record.terms ?? '', billing_cycle: record.billing_cycle, status: record.status }, record.id)}
                onDelete={(record) => void handleDelete('contracts', record.id)}
            />
            ) : null}

            {showLogs ? (
            <div className="grid gap-6 xl:grid-cols-2">
                <ERPSection
                    title="Machinery Daily Logs"
                    subtitle={`${machineryLogs.length} machine utilization logs`}
                    addLabel="New Machine Log"
                    data={machineryLogs}
                    loading={isLoading}
                    columns={[
                        { key: 'contract_id', header: 'Contract', render: (value: string) => contractMap.get(value) ?? value, sortable: true },
                        { key: 'machine_name', header: 'Machine', sortable: true },
                        { key: 'log_date', header: 'Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'working_hours', header: 'Working Hrs', sortable: true },
                        { key: 'idle_hours', header: 'Idle Hrs', sortable: true },
                        { key: 'payable_amount', header: 'Payable', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['machine_name']}
                    onAdd={() => openSection('machineryLogs')}
                    onEdit={(record) => openSection('machineryLogs', { contract_id: record.contract_id, machine_name: record.machine_name, log_date: record.log_date, working_hours: String(record.working_hours), idle_hours: String(record.idle_hours), fuel_consumption: String(record.fuel_consumption), operator_name: record.operator_name ?? '', log_status: record.status }, record.id)}
                    onDelete={(record) => void handleDelete('machineryLogs', record.id)}
                />

                <ERPSection
                    title="Fuel Logs"
                    subtitle={`${fuelLogs.length} fuel consumption logs`}
                    addLabel="New Fuel Log"
                    data={fuelLogs}
                    loading={isLoading}
                    columns={[
                        { key: 'contract_id', header: 'Contract', render: (value: string) => contractMap.get(value) ?? value, sortable: true },
                        { key: 'machine_name', header: 'Machine', sortable: true },
                        { key: 'log_date', header: 'Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'litres_consumed', header: 'Litres', sortable: true },
                        { key: 'rate', header: 'Rate', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'total_cost', header: 'Total Cost', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['machine_name']}
                    onAdd={() => openSection('fuelLogs')}
                    onEdit={(record) => openSection('fuelLogs', { contract_id: record.contract_id, machine_name: record.machine_name, log_date: record.log_date, litres_consumed: String(record.litres_consumed), rate: String(record.rate), log_status: record.status }, record.id)}
                    onDelete={(record) => void handleDelete('fuelLogs', record.id)}
                />
            </div>
            ) : null}

            {modalSection ? (
                <ERPFormModal
                    open
                    title={`${modalMode === 'edit' ? 'Edit' : 'Create'} ${modalSection === 'dpr' ? 'DPR' : modalSection === 'contracts' ? 'Vendor Contract' : modalSection === 'machineryLogs' ? 'Machinery Log' : 'Fuel Log'}`}
                    loading={saving}
                    error={error}
                    values={form}
                    fields={fields[modalSection]}
                    submitLabel={modalMode === 'edit' ? 'Save Changes' : 'Create Record'}
                    onClose={closeModal}
                    onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
                    onSubmit={handleSubmit}
                />
            ) : null}
        </div>
    )
}
