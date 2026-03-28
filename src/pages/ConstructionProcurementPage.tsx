import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { ERPFormModal, type ERPFieldConfig } from '@/components/erp/ERPFormModal'
import { GoodsReceiptLinesEditor, buildReceiptLinesFromPurchaseOrder, type GoodsReceiptLineForm } from '@/components/erp/GoodsReceiptLinesEditor'
import { PurchaseOrderLinesEditor, type PurchaseOrderLineForm } from '@/components/erp/PurchaseOrderLinesEditor'
import { ERPSection } from '@/components/erp/ERPSection'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { buildOptionLabel, createRecord, deleteRecord, getERPReferenceData, getProcurementSnapshot, saveGoodsReceipt, savePurchaseOrder, toNullable, toNumber, updateRecord } from '@/services/constructionErpService'
import type { GoodsReceiptHeader, InventoryStock, MaterialIssue, PurchaseOrder, PurchaseRequest, SalesOrder } from '@/types/constructionErp'

type SectionKey = 'salesOrders' | 'purchaseRequests' | 'purchaseOrders' | 'goodsReceipts' | 'materialIssues'
type ProcurementFocus = 'all' | 'purchaseRequests' | 'purchaseOrders' | 'goodsReceipts' | 'materialIssues'

const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Closed', value: 'closed' },
]

const emptyForm = {
    sap_ref_no: '',
    client_id: '',
    order_date: '',
    order_value: '0',
    status: 'draft',
    remarks: '',
    cost_code_id: '',
    item_id: '',
    quantity: '',
    required_date: '',
    vendor_id: '',
    purchase_request_id: '',
    delivery_date: '',
    po_id: '',
    received_date: '',
    issued_to: '',
    issue_date: '',
}

export default function ConstructionProcurementPage({ focus = 'all' }: { focus?: ProcurementFocus }) {
    const qc = useQueryClient()
    const { activeProject } = useProjectStore()
    const { data: profile } = useCurrentProfile()
    const [modalSection, setModalSection] = useState<SectionKey | null>(null)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<Record<string, string>>(emptyForm)
    const [poLines, setPoLines] = useState<PurchaseOrderLineForm[]>([{ id: crypto.randomUUID(), item_id: '', quantity: '', rate: '', description: '' }])
    const [receiptLines, setReceiptLines] = useState<GoodsReceiptLineForm[]>(buildReceiptLinesFromPurchaseOrder([]))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data: snapshot, isLoading } = useQuery({
        queryKey: ['construction-erp-procurement', activeProject?.id],
        queryFn: () => getProcurementSnapshot(activeProject!.id),
        enabled: !!activeProject,
    })

    const { data: reference } = useQuery({
        queryKey: ['construction-erp-procurement-reference', activeProject?.id],
        queryFn: () => getERPReferenceData(activeProject?.id),
        enabled: !!activeProject,
    })

    const salesOrders = snapshot?.salesOrders ?? []
    const purchaseRequests = snapshot?.purchaseRequests ?? []
    const purchaseOrders = snapshot?.purchaseOrders ?? []
    const goodsReceipts = snapshot?.goodsReceipts ?? []
    const materialIssues = snapshot?.materialIssues ?? []
    const inventory = snapshot?.inventory ?? []
    const clients = reference?.clients ?? []
    const items = reference?.items ?? []
    const costCodes = reference?.costCodes ?? []
    const vendors = reference?.vendors ?? []

    const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients])
    const itemMap = useMemo(() => new Map(items.map((item) => [item.id, `${item.item_code} - ${item.name}`])), [items])
    const costCodeMap = useMemo(() => new Map(costCodes.map((costCode) => [costCode.id, `${costCode.code} - ${costCode.description}`])), [costCodes])
    const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors])
    const prMap = useMemo(() => new Map(purchaseRequests.map((pr) => [pr.id, pr.system_id])), [purchaseRequests])
    const poMap = useMemo(() => new Map(purchaseOrders.map((po) => [po.id, po.system_id])), [purchaseOrders])

    const selectedPurchaseOrder = useMemo(
        () => purchaseOrders.find((purchaseOrder) => purchaseOrder.id === form.po_id) ?? null,
        [form.po_id, purchaseOrders]
    )

    const selectedPOLines = selectedPurchaseOrder?.purchase_order_lines ?? []
    const showSalesOrders = focus === 'all'
    const showPurchaseRequests = focus === 'all' || focus === 'purchaseRequests'
    const showPurchaseOrders = focus === 'all' || focus === 'purchaseOrders'
    const showGoodsReceipts = focus === 'all' || focus === 'goodsReceipts'
    const showMaterialIssues = focus === 'all' || focus === 'materialIssues'

    const closeModal = () => {
        setModalSection(null)
        setModalMode('create')
        setEditingId(null)
        setForm(emptyForm)
        setPoLines([{ id: crypto.randomUUID(), item_id: '', quantity: '', rate: '', description: '' }])
        setReceiptLines(buildReceiptLinesFromPurchaseOrder([]))
        setError('')
    }

    const setSectionForm = (section: SectionKey, values: Record<string, string>, id?: string) => {
        setModalSection(section)
        setModalMode(id ? 'edit' : 'create')
        setEditingId(id ?? null)
        setForm({ ...emptyForm, ...values })
        setError('')
    }

    const openCreate = (section: SectionKey) => {
        setSectionForm(section, {
            order_date: new Date().toISOString().slice(0, 10),
            required_date: new Date().toISOString().slice(0, 10),
            delivery_date: new Date().toISOString().slice(0, 10),
            received_date: new Date().toISOString().slice(0, 10),
            issue_date: new Date().toISOString().slice(0, 10),
            status: 'draft',
        })
        if (section === 'purchaseOrders') {
            setPoLines([{ id: crypto.randomUUID(), item_id: '', quantity: '', rate: '', description: '' }])
        }
        if (section === 'goodsReceipts') {
            setReceiptLines(buildReceiptLinesFromPurchaseOrder([]))
        }
    }

    const invalidate = async () => {
        await qc.invalidateQueries({ queryKey: ['construction-erp-procurement', activeProject?.id] })
        await qc.invalidateQueries({ queryKey: ['construction-erp-procurement-reference', activeProject?.id] })
        await qc.invalidateQueries({ queryKey: ['construction-erp-dashboard'] })
        await qc.invalidateQueries({ queryKey: ['construction-erp-finance', activeProject?.id] })
    }

    const handleDelete = async (section: SectionKey, id: string) => {
        const tableMap: Record<SectionKey, string> = {
            salesOrders: 'sales_orders',
            purchaseRequests: 'purchase_requests',
            purchaseOrders: 'purchase_orders',
            goodsReceipts: 'grn_headers',
            materialIssues: 'material_issues',
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
            if (modalSection === 'salesOrders') {
                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    project_id: activeProject.id,
                    client_id: form.client_id,
                    order_date: form.order_date,
                    order_value: toNumber(form.order_value),
                    status: form.status,
                    remarks: toNullable(form.remarks),
                    created_by: profile?.id ?? null,
                }
                if (editingId) await updateRecord<SalesOrder>('sales_orders', editingId, payload)
                else await createRecord<SalesOrder>('sales_orders', payload)
            }

            if (modalSection === 'purchaseRequests') {
                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    project_id: activeProject.id,
                    cost_code_id: form.cost_code_id,
                    requested_by: profile?.id ?? null,
                    item_id: form.item_id,
                    quantity: toNumber(form.quantity),
                    required_date: form.required_date,
                    remarks: toNullable(form.remarks),
                    status: form.status,
                }
                if (editingId) await updateRecord<PurchaseRequest>('purchase_requests', editingId, payload)
                else await createRecord<PurchaseRequest>('purchase_requests', payload)
            }

            if (modalSection === 'purchaseOrders') {
                await savePurchaseOrder({
                    id: editingId ?? undefined,
                    sap_ref_no: toNullable(form.sap_ref_no),
                    vendor_id: form.vendor_id,
                    project_id: activeProject.id,
                    cost_code_id: form.cost_code_id,
                    purchase_request_id: toNullable(form.purchase_request_id),
                    delivery_date: toNullable(form.delivery_date),
                    status: form.status as PurchaseOrder['status'],
                    created_by: profile?.id ?? null,
                }, poLines.map((line) => ({
                    item_id: line.item_id,
                    quantity: toNumber(line.quantity),
                    rate: toNumber(line.rate),
                    description: toNullable(line.description),
                })))
            }

            if (modalSection === 'goodsReceipts') {
                if (!selectedPurchaseOrder) throw new Error('Select a purchase order before creating a GRN.')
                const validLines = receiptLines.filter((line) => line.item_id && Number(line.received_qty) > 0)
                if (validLines.length === 0) throw new Error('Add at least one GRN line with a received quantity.')

                await saveGoodsReceipt({
                    id: editingId ?? undefined,
                    sap_ref_no: toNullable(form.sap_ref_no),
                    po_id: selectedPurchaseOrder.id,
                    vendor_id: selectedPurchaseOrder.vendor_id,
                    project_id: activeProject.id,
                    cost_code_id: selectedPurchaseOrder.cost_code_id,
                    received_date: form.received_date,
                    status: form.status as GoodsReceiptHeader['status'],
                    remarks: toNullable(form.remarks),
                    created_by: profile?.id ?? null,
                }, validLines.map((line) => ({
                    item_id: line.item_id,
                    ordered_qty: toNumber(line.ordered_qty),
                    received_qty: toNumber(line.received_qty),
                    accepted_qty: toNumber(line.accepted_qty),
                    store_location: line.store_location,
                    remarks: toNullable(line.remarks),
                })))
            }

            if (modalSection === 'materialIssues') {
                const payload = {
                    sap_ref_no: toNullable(form.sap_ref_no),
                    project_id: activeProject.id,
                    cost_code_id: form.cost_code_id,
                    item_id: form.item_id,
                    quantity: toNumber(form.quantity),
                    issued_to: form.issued_to,
                    issue_date: form.issue_date,
                    remarks: toNullable(form.remarks),
                    status: form.status,
                }
                if (editingId) await updateRecord<MaterialIssue>('material_issues', editingId, payload)
                else await createRecord<MaterialIssue>('material_issues', payload)
            }

            await invalidate()
            closeModal()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to save record.')
        } finally {
            setSaving(false)
        }
    }

    const handleModalChange = (name: string, value: string) => {
        setForm((current) => ({ ...current, [name]: value }))

        if (modalSection === 'goodsReceipts' && name === 'po_id') {
            const nextPurchaseOrder = purchaseOrders.find((purchaseOrder) => purchaseOrder.id === value)
            setReceiptLines(buildReceiptLinesFromPurchaseOrder(nextPurchaseOrder?.purchase_order_lines ?? []))
        }
    }

    const fields: Record<SectionKey, ERPFieldConfig[]> = {
        salesOrders: [
            { name: 'client_id', label: 'Client', type: 'select', required: true, options: clients.map((client) => ({ value: client.id, label: buildOptionLabel(client.client_code, client.name) })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'order_date', label: 'Order Date', type: 'date', required: true },
            { name: 'order_value', label: 'Order Value', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        purchaseRequests: [
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', required: true, options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'item_id', label: 'Item', type: 'select', required: true, options: items.map((item) => ({ value: item.id, label: `${item.item_code} - ${item.name}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'quantity', label: 'Quantity', type: 'number', min: 0.01, step: 0.01, required: true },
            { name: 'required_date', label: 'Required Date', type: 'date', required: true },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        purchaseOrders: [
            { name: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })) },
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', required: true, options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'purchase_request_id', label: 'Linked PR', type: 'select', required: true, options: purchaseRequests.map((pr) => ({ value: pr.id, label: `${pr.system_id} - ${itemMap.get(pr.item_id) ?? 'Item'}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'delivery_date', label: 'Delivery Date', type: 'date' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        goodsReceipts: [
            { name: 'po_id', label: 'Purchase Order', type: 'select', required: true, options: purchaseOrders.map((purchaseOrder) => ({ value: purchaseOrder.id, label: `${purchaseOrder.system_id} - ${vendorMap.get(purchaseOrder.vendor_id) ?? 'Vendor'}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'received_date', label: 'Received Date', type: 'date', required: true },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
        materialIssues: [
            { name: 'cost_code_id', label: 'Cost Code', type: 'select', required: true, options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })) },
            { name: 'item_id', label: 'Item', type: 'select', required: true, options: items.map((item) => ({ value: item.id, label: `${item.item_code} - ${item.name}` })) },
            { name: 'sap_ref_no', label: 'SAP Ref No' },
            { name: 'quantity', label: 'Issue Quantity', type: 'number', min: 0.01, step: 0.01, required: true },
            { name: 'issued_to', label: 'Issued To', required: true },
            { name: 'issue_date', label: 'Issue Date', type: 'date', required: true },
            { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
            { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 },
        ],
    }

    if (!activeProject) {
        return <div className="glass-card p-8 text-center"><AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#f59e0b' }} /><p style={{ color: 'var(--color-surface-300)' }}>Select an active project to manage procurement transactions.</p></div>
    }

    return (
        <div className="space-y-6">
            <div className="glass-card p-5">
                <p className="text-sm leading-6" style={{ color: 'var(--color-surface-300)' }}>
                    Manage the procurement chain for <strong>{activeProject.name}</strong>. PR, PO, GRN, inventory, and approvals all stay linked through project and cost code controls.
                </p>
            </div>

            {showSalesOrders ? (
                <ERPSection
                    title="Sales Orders"
                    subtitle={`${salesOrders.length} client-linked sales orders`}
                    addLabel="New SO"
                    data={salesOrders}
                    loading={isLoading}
                    columns={[
                        { key: 'system_id', header: 'System ID', sortable: true },
                        { key: 'sap_ref_no', header: 'SAP Ref', render: (value: string | null) => value ?? 'NA' },
                        { key: 'client_id', header: 'Client', render: (value: string) => clientMap.get(value) ?? value, sortable: true },
                        { key: 'order_date', header: 'Order Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'order_value', header: 'Order Value', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['system_id', 'sap_ref_no']}
                    onAdd={() => openCreate('salesOrders')}
                    onEdit={(record) => setSectionForm('salesOrders', { sap_ref_no: record.sap_ref_no ?? '', client_id: record.client_id, order_date: record.order_date, order_value: String(record.order_value), status: record.status, remarks: record.remarks ?? '' }, record.id)}
                    onDelete={(record) => void handleDelete('salesOrders', record.id)}
                />
            ) : null}

            {showPurchaseRequests ? (
                <ERPSection
                    title="Purchase Requests"
                    subtitle={`${purchaseRequests.length} requests aligned to project cost codes`}
                    addLabel="New PR"
                    data={purchaseRequests}
                    loading={isLoading}
                    columns={[
                        { key: 'system_id', header: 'System ID', sortable: true },
                        { key: 'sap_ref_no', header: 'SAP Ref', render: (value: string | null) => value ?? 'NA' },
                        { key: 'cost_code_id', header: 'Cost Code', render: (value: string) => costCodeMap.get(value) ?? value, sortable: true },
                        { key: 'item_id', header: 'Item', render: (value: string) => itemMap.get(value) ?? value, sortable: true },
                        { key: 'quantity', header: 'Qty', sortable: true },
                        { key: 'required_date', header: 'Required Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['system_id', 'sap_ref_no']}
                    onAdd={() => openCreate('purchaseRequests')}
                    onEdit={(record) => setSectionForm('purchaseRequests', { sap_ref_no: record.sap_ref_no ?? '', cost_code_id: record.cost_code_id, item_id: record.item_id, quantity: String(record.quantity), required_date: record.required_date, status: record.status, remarks: record.remarks ?? '' }, record.id)}
                    onDelete={(record) => void handleDelete('purchaseRequests', record.id)}
                />
            ) : null}

            {showPurchaseOrders ? (
                <ERPSection
                    title="Purchase Orders"
                    subtitle={`${purchaseOrders.length} vendor-facing purchase orders`}
                    addLabel="New PO"
                    data={purchaseOrders}
                    loading={isLoading}
                    columns={[
                        { key: 'system_id', header: 'System ID', sortable: true },
                        { key: 'sap_ref_no', header: 'SAP Ref', render: (value: string | null) => value ?? 'NA' },
                        { key: 'vendor_id', header: 'Vendor', render: (value: string) => vendorMap.get(value) ?? value, sortable: true },
                        { key: 'cost_code_id', header: 'Cost Code', render: (value: string) => costCodeMap.get(value) ?? value, sortable: true },
                        { key: 'purchase_request_id', header: 'PR Ref', render: (value: string | null) => value ? prMap.get(value) ?? value : 'Direct' },
                        { key: 'purchase_order_lines', header: 'Items', render: (_: unknown, row: PurchaseOrder) => row.purchase_order_lines?.map((line) => itemMap.get(line.item_id) ?? line.item_id).join(', ') ?? 'NA' },
                        { key: 'total_amount', header: 'Total', render: (value: number) => formatCurrency(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['system_id', 'sap_ref_no']}
                    onAdd={() => openCreate('purchaseOrders')}
                    onEdit={(record) => {
                        setSectionForm('purchaseOrders', { sap_ref_no: record.sap_ref_no ?? '', vendor_id: record.vendor_id, cost_code_id: record.cost_code_id, purchase_request_id: record.purchase_request_id ?? '', delivery_date: record.delivery_date ?? '', status: record.status, remarks: '' }, record.id)
                        setPoLines((record.purchase_order_lines ?? []).map((line) => ({ id: line.id, item_id: line.item_id, quantity: String(line.quantity), rate: String(line.rate), description: line.description ?? '' })))
                    }}
                    onDelete={(record) => void handleDelete('purchaseOrders', record.id)}
                />
            ) : null}

            {showGoodsReceipts ? (
                <>
                    <ERPSection
                        title="Goods Receipts"
                        subtitle={`${goodsReceipts.length} GRNs posted against purchase orders`}
                        addLabel="New GRN"
                        data={goodsReceipts}
                        loading={isLoading}
                        columns={[
                            { key: 'system_id', header: 'GRN No', sortable: true },
                            { key: 'sap_ref_no', header: 'SAP Ref', render: (value: string | null) => value ?? 'NA' },
                            { key: 'po_id', header: 'PO', render: (value: string) => poMap.get(value) ?? value, sortable: true },
                            { key: 'vendor_id', header: 'Vendor', render: (value: string) => vendorMap.get(value) ?? value, sortable: true },
                            { key: 'received_date', header: 'Received Date', render: (value: string) => formatDate(value), sortable: true },
                            { key: 'goods_receipts', header: 'Items', render: (_: unknown, row: GoodsReceiptHeader) => String(row.goods_receipts?.length ?? 0) },
                            { key: 'goods_receipts_total', header: 'Accepted Qty', render: (_: unknown, row: GoodsReceiptHeader) => String((row.goods_receipts ?? []).reduce((sum, item) => sum + item.accepted_qty, 0)) },
                            { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                        ]}
                        filterKeys={['system_id', 'sap_ref_no']}
                        onAdd={() => openCreate('goodsReceipts')}
                        onEdit={(record) => {
                            setSectionForm('goodsReceipts', { sap_ref_no: record.sap_ref_no ?? '', po_id: record.po_id, received_date: record.received_date, status: record.status, remarks: record.remarks ?? '' }, record.id)
                            setReceiptLines((record.goods_receipts ?? []).map((line) => ({
                                id: line.id,
                                item_id: line.item_id,
                                ordered_qty: String(line.ordered_qty),
                                received_qty: String(line.received_qty),
                                accepted_qty: String(line.accepted_qty),
                                store_location: line.store_location,
                                remarks: line.remarks ?? '',
                            })))
                        }}
                        onDelete={(record) => void handleDelete('goodsReceipts', record.id)}
                    />

                    <section className="space-y-3">
                        <div className="section-header">
                            <div>
                                <p className="section-title">Inventory Balance</p>
                                <p className="section-subtitle">{inventory.length} auto-refreshed item balances after GRN and issue posting</p>
                            </div>
                        </div>
                        <DataTable
                            columns={[
                                { key: 'item_id', header: 'Item', render: (value: string) => itemMap.get(value) ?? value, sortable: true },
                                { key: 'inward_qty', header: 'Inward Qty', sortable: true },
                                { key: 'outward_qty', header: 'Outward Qty', sortable: true },
                                { key: 'balance_qty', header: 'Balance Qty', sortable: true },
                                { key: 'average_rate', header: 'Avg Rate', render: (value: number) => formatCurrency(value), sortable: true },
                            ]}
                            data={inventory}
                            loading={isLoading}
                            keyExtractor={(record: InventoryStock) => record.id}
                            filterKeys={['item_id']}
                            searchPlaceholder="Search inventory..."
                        />
                    </section>
                </>
            ) : null}

            {showMaterialIssues ? (
                <ERPSection
                    title="Material Issues"
                    subtitle={`${materialIssues.length} stock issue transactions posted to execution`}
                    addLabel="New Issue"
                    data={materialIssues}
                    loading={isLoading}
                    columns={[
                        { key: 'system_id', header: 'Issue No', sortable: true },
                        { key: 'cost_code_id', header: 'Cost Code', render: (value: string) => costCodeMap.get(value) ?? value, sortable: true },
                        { key: 'item_id', header: 'Item', render: (value: string) => itemMap.get(value) ?? value, sortable: true },
                        { key: 'quantity', header: 'Qty', sortable: true },
                        { key: 'issued_to', header: 'Issued To', sortable: true },
                        { key: 'issue_date', header: 'Issue Date', render: (value: string) => formatDate(value), sortable: true },
                        { key: 'status', header: 'Status', render: (value: string) => <StatusBadge status={value} /> },
                    ]}
                    filterKeys={['system_id', 'issued_to']}
                    onAdd={() => openCreate('materialIssues')}
                    onEdit={(record) => setSectionForm('materialIssues', { sap_ref_no: record.sap_ref_no ?? '', cost_code_id: record.cost_code_id, item_id: record.item_id, quantity: String(record.quantity), issued_to: record.issued_to, issue_date: record.issue_date, status: record.status, remarks: record.remarks ?? '' }, record.id)}
                    onDelete={(record) => void handleDelete('materialIssues', record.id)}
                />
            ) : null}

            {showMaterialIssues && !showGoodsReceipts ? (
                <section className="space-y-3">
                    <div className="section-header">
                        <div>
                            <p className="section-title">Inventory Balance</p>
                            <p className="section-subtitle">{inventory.length} auto-refreshed item balances after GRN and issue posting</p>
                        </div>
                    </div>
                    <DataTable
                        columns={[
                            { key: 'item_id', header: 'Item', render: (value: string) => itemMap.get(value) ?? value, sortable: true },
                            { key: 'inward_qty', header: 'Inward Qty', sortable: true },
                            { key: 'outward_qty', header: 'Outward Qty', sortable: true },
                            { key: 'balance_qty', header: 'Balance Qty', sortable: true },
                            { key: 'average_rate', header: 'Avg Rate', render: (value: number) => formatCurrency(value), sortable: true },
                        ]}
                        data={inventory}
                        loading={isLoading}
                        keyExtractor={(record: InventoryStock) => record.id}
                        filterKeys={['item_id']}
                        searchPlaceholder="Search inventory..."
                    />
                </section>
            ) : null}

            {modalSection ? (
                <ERPFormModal
                    open
                    title={`${modalMode === 'edit' ? 'Edit' : 'Create'} ${modalSection === 'salesOrders' ? 'Sales Order' : modalSection === 'purchaseRequests' ? 'Purchase Request' : modalSection === 'purchaseOrders' ? 'Purchase Order' : modalSection === 'goodsReceipts' ? 'Goods Receipt' : 'Material Issue'}`}
                    loading={saving}
                    error={error}
                    values={form}
                    fields={fields[modalSection]}
                    submitLabel={modalMode === 'edit' ? 'Save Changes' : 'Create Record'}
                    onClose={closeModal}
                    onChange={handleModalChange}
                    onSubmit={handleSubmit}
                    extraContent={
                        modalSection === 'purchaseOrders'
                            ? <PurchaseOrderLinesEditor items={items} value={poLines} onChange={setPoLines} />
                            : modalSection === 'goodsReceipts'
                                ? <GoodsReceiptLinesEditor items={items} poLines={selectedPOLines} value={receiptLines} onChange={setReceiptLines} />
                                : null
                    }
                />
            ) : null}
        </div>
    )
}
