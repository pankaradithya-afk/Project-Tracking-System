import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { ERPFormModal, type ERPFieldConfig } from '@/components/erp/ERPFormModal'
import { ERPSection } from '@/components/erp/ERPSection'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { createRecord, deleteRecord, getERPReferenceData, getFinanceSnapshot, toNullable, toNumber, updateRecord } from '@/services/constructionErpService'
import type { Expense, Payment, RABill, VendorInvoice } from '@/types/constructionErp'

type SectionKey = 'expenses' | 'vendorInvoices' | 'payments' | 'raBills'
type FinanceFocus = 'all' | 'vendorInvoices' | 'payments'

const emptyForm = {
    cost_code_id: '',
    expense_type: '',
    amount: '0',
    expense_date: '',
    linked_reference: '',
    reference_module: '',
    remarks: '',
    status: 'draft',
    sap_ref_no: '',
    vendor_id: '',
    contract_id: '',
    po_id: '',
    invoice_status: 'draft',
    invoice_amount: '0',
    invoice_date: '',
    invoice_id: '',
    amount_paid: '0',
    payment_date: '',
    payment_mode: 'Bank Transfer',
    payment_status: 'draft',
    client_id: '',
    bill_date: '',
    work_done_value: '0',
    previous_billing: '0',
    current_billing: '0',
    retention: '0',
    ra_status: 'draft',
}

const documentStatusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Closed', value: 'closed' },
]

export default function ConstructionFinancePage({ focus = 'all' }: { focus?: FinanceFocus }) {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const [modalSection, setModalSection] = useState<SectionKey | null>(null)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<Record<string, string>>(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: snapshot, isLoading } = useQuery({
        queryKey: ['construction-erp-finance', activeProject?.id],
        queryFn: () => getFinanceSnapshot(activeProject!.id),
        enabled: !!activeProject,
    })

    const { data: reference } = useQuery({
        queryKey: ['construction-erp-finance-reference', activeProject?.id],
        queryFn: () => getERPReferenceData(activeProject?.id),
        enabled: !!activeProject,
    })

    const expenses = snapshot?.expenses ?? []
    const vendorInvoices = snapshot?.vendorInvoices ?? []
    const payments = snapshot?.payments ?? []
    const raBills = snapshot?.raBills ?? []
    const vendors = reference?.vendors ?? []
    const clients = reference?.clients ?? []
    const contracts = reference?.vendorContracts ?? []
    const costCodes = reference?.costCodes ?? []

    const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors])
    const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients])
    const contractMap = useMemo(() => new Map(contracts.map((contract) => [contract.id, contract.contract_id])), [contracts])
    const costCodeMap = useMemo(() => new Map(costCodes.map((costCode) => [costCode.id, `${costCode.code} - ${costCode.description}`])), [costCodes])
    const invoiceMap = useMemo(() => new Map(vendorInvoices.map((invoice) => [invoice.id, invoice.system_id])), [vendorInvoices])
    const purchaseOrderMap = useMemo(() => new Map(reference?.purchaseOrders?.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder.system_id]) ?? []), [reference?.purchaseOrders])
    const showExpenses = focus === 'all'
    const showVendorInvoices = focus === 'all' || focus === 'vendorInvoices'
    const showPayments = focus === 'all' || focus === 'payments'
    const showRABills = focus === 'all'
    const getVarianceLabel = (invoice: VendorInvoice) => {
        if (invoice.validation_status === 'pending') return 'Pending'
        if (invoice.validation_status === 'matched' || Math.abs(invoice.variance) <= 0.01) return 'Match'
        if (invoice.validation_status === 'overbilling' || invoice.variance > 0) return 'Overbilling'
        return 'Underbilling'
    }

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
            expense_date: new Date().toISOString().slice(0, 10),
            invoice_date: new Date().toISOString().slice(0, 10),
            payment_date: new Date().toISOString().slice(0, 10),
            bill_date: new Date().toISOString().slice(0, 10),
            status: 'draft',
            invoice_status: 'draft',
            payment_status: 'draft',
            ra_status: 'draft',
            ...values,
        })
        setError('')
    }

    const invalidate = async () => {
        await qc.invalidateQueries({ queryKey: ['construction-erp-finance', activeProject?.id] })
        await qc.invalidateQueries({ queryKey: ['construction-erp-dashboard'] })
    }

    const handleDelete = async (section: SectionKey, id: string) => {
        const tableMap: Record<SectionKey, string> = {
            expenses: 'expenses',
            vendorInvoices: 'vendor_invoices',
            payments: 'payments',
            raBills: 'ra_bills',
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
            if (modalSection === 'expenses') {
                const payload = {
                    project_id: activeProject.id,
                    cost_code_id: form.cost_code_id,
                    sap_ref_no: toNullable(form.sap_ref_no),
                    expense_type: form.expense_type,
                    amount: toNumber(form.amount),
                    expense_date: form.expense_date,
                    linked_reference: toNullable(form.linked_reference),
                    reference_module: toNullable(form.reference_module),
                    remarks: toNullable(form.remarks),
                    status: form.status,
                }
                if (editingId) await updateRecord<Expense>('expenses', editingId, payload)
                else await createRecord<Expense>('expenses', payload)
            }

            if (modalSection === 'vendorInvoices') {
                const linkedToContract = Boolean(form.contract_id)
                const linkedToPurchaseOrder = Boolean(form.po_id)

                if (linkedToContract === linkedToPurchaseOrder) {
                    throw new Error('Link the vendor invoice to exactly one source: either a PO or a contract.')
                }

                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    vendor_id: form.vendor_id,
                    project_id: activeProject.id,
                    cost_code_id: toNullable(form.cost_code_id),
                    contract_id: toNullable(form.contract_id),
                    po_id: toNullable(form.po_id),
                    invoice_amount: toNumber(form.invoice_amount),
                    invoice_date: form.invoice_date,
                    remarks: toNullable(form.remarks),
                    status: form.invoice_status,
                }
                if (editingId) await updateRecord<VendorInvoice>('vendor_invoices', editingId, payload)
                else await createRecord<VendorInvoice>('vendor_invoices', payload)
            }

            if (modalSection === 'payments') {
                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    invoice_id: form.invoice_id,
                    project_id: activeProject.id,
                    cost_code_id: toNullable(form.cost_code_id),
                    amount_paid: toNumber(form.amount_paid),
                    payment_date: form.payment_date,
                    payment_mode: form.payment_mode,
                    remarks: toNullable(form.remarks),
                    status: form.payment_status,
                }
                if (editingId) await updateRecord<Payment>('payments', editingId, payload)
                else await createRecord<Payment>('payments', payload)
            }

            if (modalSection === 'raBills') {
                const payload = {
                    project_id: activeProject.id,
                    client_id: toNullable(form.client_id),
                    bill_date: form.bill_date,
                    work_done_value: toNumber(form.work_done_value),
                    previous_billing: toNumber(form.previous_billing),
                    current_billing: toNumber(form.current_billing),
                    retention: toNumber(form.retention),
                    status: form.ra_status,
                }
                if (editingId) await updateRecord<RABill>('ra_bills', editingId, payload)
                else await createRecord<RABill>('ra_bills', payload)
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
        expenses: [
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', required: true, options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'expense_type', label: 'Expense Type', required: true },
            { name: 'amount', label: 'Amount', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'expense_date', label: 'Expense Date', type: 'date', required: true },
            { name: 'linked_reference', label: 'Linked Reference' },
            { name: 'reference_module', label: 'Reference Module' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: documentStatusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        vendorInvoices: [
            { name: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })) },
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'contract_id', label: 'Contract', type: 'select', options: contracts.map((contract) => ({ value: contract.id, label: `${contract.contract_id} - ${vendorMap.get(contract.vendor_id) ?? 'Vendor'}` })) },
            { name: 'po_id', label: 'PO', type: 'select', options: (reference?.purchaseOrders ?? []).map((purchaseOrder) => ({ value: purchaseOrder.id, label: `${purchaseOrder.system_id} - ${vendorMap.get(purchaseOrder.vendor_id) ?? 'Vendor'}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'invoice_amount', label: 'Invoice Amount', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
            { name: 'invoice_status', label: 'Status', type: 'select', required: true, options: documentStatusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        payments: [
            { name: 'invoice_id', label: 'Invoice', type: 'select', required: true, options: vendorInvoices.map((invoice) => ({ value: invoice.id, label: `${invoice.system_id} - ${formatCurrency(invoice.invoice_amount)}` })) },
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'amount_paid', label: 'Amount Paid', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'payment_date', label: 'Payment Date', type: 'date', required: true },
            { name: 'payment_mode', label: 'Payment Mode', type: 'select', required: true, options: [{ label: 'Bank Transfer', value: 'Bank Transfer' }, { label: 'Cheque', value: 'Cheque' }, { label: 'Cash', value: 'Cash' }, { label: 'UPI', value: 'UPI' }] },
            { name: 'payment_status', label: 'Status', type: 'select', required: true, options: documentStatusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        raBills: [
            { name: 'client_id', label: 'Client', type: 'select', options: clients.map((client) => ({ value: client.id, label: client.name })) },
            { name: 'bill_date', label: 'Bill Date', type: 'date', required: true },
            { name: 'work_done_value', label: 'Work Done Value', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'previous_billing', label: 'Previous Billing', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'current_billing', label: 'Current Billing', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'retention', label: 'Retention', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'ra_status', label: 'Status', type: 'select', required: true, options: [{ label: 'Draft', value: 'draft' }, { label: 'Submitted', value: 'submitted' }, { label: 'Certified', value: 'certified' }, { label: 'Paid', value: 'paid' }] },
        ],
    }

    if (!activeProject) {
        return <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Select an active project to manage finance records.</p></div>
    }

    return (
        <div className="space-y-6">
            <div className="glass-card p-5">
                <p className="text-sm leading-6" style={{ color: 'var(--color-surface-300)' }}>
                    Track project costs, vendor invoices, payment releases, and RA bills for <strong>{activeProject.name}</strong>. Contract-linked vendor invoices are validated against machinery and fuel logs automatically.
                </p>
            </div>

            {showExpenses ? (
            <ERPSection
                title="Expenses"
                subtitle={`${expenses.length} finance and execution expenses`}
                addLabel="New Expense"
                data={expenses}
                loading={isLoading}
                columns={[
                    { key: 'system_id', header: 'System ID', sortable: true },
                    { key: 'expense_date', header: 'Date', render: (value: string) => formatDate(value), sortable: true },
                    { key: 'cost_code_id', header: 'Cost Code', render: (value: string) => costCodeMap.get(value) ?? value, sortable: true },
                    { key: 'expense_type', header: 'Type', sortable: true },
                    { key: 'amount', header: 'Amount', render: (value: number) => formatCurrency(value), sortable: true },
                    { key: 'linked_reference', header: 'Reference', render: (value: string | null) => value ?? 'NA' },
                    { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                ]}
                filterKeys={['expense_type', 'linked_reference']}
                onAdd={() => openSection('expenses')}
                onEdit={(record) => openSection('expenses', { cost_code_id: record.cost_code_id, sap_ref_no: record.sap_ref_no ?? '', expense_type: record.expense_type, amount: String(record.amount), expense_date: record.expense_date, linked_reference: record.linked_reference ?? '', reference_module: record.reference_module ?? '', status: record.status, remarks: record.remarks ?? '' }, record.id)}
                onDelete={(record) => void handleDelete('expenses', record.id)}
            />
            ) : null}

            {showVendorInvoices ? (
            <ERPSection
                title="Vendor Invoices"
                subtitle={`${vendorInvoices.length} invoices with system-side validation`}
                addLabel="New Vendor Invoice"
                data={vendorInvoices}
                loading={isLoading}
                columns={[
                    { key: 'system_id', header: 'System ID', sortable: true },
                    { key: 'vendor_id', header: 'Vendor', render: (value: string) => vendorMap.get(value) ?? value, sortable: true },
                    { key: 'cost_code_id', header: 'Cost Code', render: (value: string | null) => value ? costCodeMap.get(value) ?? value : 'NA' },
                    { key: 'contract_id', header: 'Contract', render: (value: string | null) => value ? contractMap.get(value) ?? value : 'NA' },
                    { key: 'po_id', header: 'PO', render: (value: string | null) => value ? purchaseOrderMap.get(value) ?? value : 'NA' },
                    { key: 'invoice_amount', header: 'Invoice Amount', render: (value: number) => formatCurrency(value), sortable: true },
                    { key: 'calculated_amount', header: 'Calculated', render: (value: number) => formatCurrency(value), sortable: true },
                    {
                        key: 'variance',
                        header: 'Variance',
                        render: (value: number) => (
                            <span style={{ color: value === 0 ? '#34d399' : value > 0 ? '#f87171' : '#fbbf24' }}>
                                {formatCurrency(value)}
                            </span>
                        ),
                        sortable: true,
                    },
                    { key: 'variance_label', header: 'Validation', render: (_: unknown, record: VendorInvoice) => <StatusBadge status={getVarianceLabel(record)} /> },
                    { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                ]}
                filterKeys={['system_id', 'sap_ref_no']}
                onAdd={() => openSection('vendorInvoices')}
                onEdit={(record) => openSection('vendorInvoices', { sap_ref_no: record.sap_ref_no ?? '', vendor_id: record.vendor_id, cost_code_id: record.cost_code_id ?? '', contract_id: record.contract_id ?? '', po_id: record.po_id ?? '', invoice_amount: String(record.invoice_amount), invoice_date: record.invoice_date, invoice_status: record.status, remarks: record.remarks ?? '' }, record.id)}
                onDelete={(record) => void handleDelete('vendorInvoices', record.id)}
            />
            ) : null}

            {(showPayments || showRABills) ? (
            <div className="grid gap-6 xl:grid-cols-2">
                {showPayments ? (
                <ERPSection
                    title="Payments"
                    subtitle={`${payments.length} released vendor payments`}
                    addLabel="New Payment"
                    data={payments}
                    loading={isLoading}
                    columns={[
                        { key: 'system_id', header: 'System ID', sortable: true },
                        { key: 'invoice_id', header: 'Invoice', render: (value: string) => invoiceMap.get(value) ?? value, sortable: true },
                        { key: 'cost_code_id', header: 'Cost Code', render: (value: string | null) => value ? costCodeMap.get(value) ?? value : 'NA' },
                        { key: 'payment_date', header: 'Payment Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'amount_paid', header: 'Amount', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'payment_mode', header: 'Mode', render: (value: string) => <StatusBadge status={value} /> },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['system_id']}
                    onAdd={() => openSection('payments')}
                    onEdit={(record) => openSection('payments', { sap_ref_no: record.sap_ref_no ?? '', invoice_id: record.invoice_id, cost_code_id: record.cost_code_id ?? '', amount_paid: String(record.amount_paid), payment_date: record.payment_date, payment_mode: record.payment_mode, payment_status: record.status, remarks: record.remarks ?? '' }, record.id)}
                    onDelete={(record) => void handleDelete('payments', record.id)}
                />
                ) : null}

                {showRABills ? (
                <ERPSection
                    title="RA Bills"
                    subtitle={`${raBills.length} client-side billing records`}
                    addLabel="New RA Bill"
                    data={raBills}
                    loading={isLoading}
                    columns={[
                        { key: 'bill_no', header: 'Bill No', sortable: true },
                        { key: 'client_id', header: 'Client', render: (value: string | null) => value ? clientMap.get(value) ?? value : 'NA', sortable: true },
                        { key: 'bill_date', header: 'Bill Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'current_billing', header: 'Current Billing', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'retention', header: 'Retention', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'net_payable', header: 'Net Payable', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['bill_no']}
                    onAdd={() => openSection('raBills')}
                    onEdit={(record) => openSection('raBills', { client_id: record.client_id ?? '', bill_date: record.bill_date, work_done_value: String(record.work_done_value), previous_billing: String(record.previous_billing), current_billing: String(record.current_billing), retention: String(record.retention), ra_status: record.status }, record.id)}
                    onDelete={(record) => void handleDelete('raBills', record.id)}
                />
                ) : null}
            </div>
            ) : null}

            {modalSection ? (
                <ERPFormModal
                    open
                    title={`${modalMode === 'edit' ? 'Edit' : 'Create'} ${modalSection === 'expenses' ? 'Expense' : modalSection === 'vendorInvoices' ? 'Vendor Invoice' : modalSection === 'payments' ? 'Payment' : 'RA Bill'}`}
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
