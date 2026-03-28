import { supabase } from '@/lib/supabaseClient'
import type { Project, Vendor } from '@/types'
import type {
    ActivityLog,
    DailyProgressReport,
    DeliveryChallan,
    ERPClient,
    ERPCostCode,
    ERPDepartment,
    ERPItem,
    ERPProjectBudget,
    ERPReferenceData,
    ERPRole,
    ERPUserDirectory,
    Expense,
    FuelLog,
    GoodsReceiptHeader,
    GoodsReceiptItem,
    InventoryStock,
    MachineryDailyLog,
    MaterialIssue,
    ModuleDocument,
    Payment,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    RABill,
    SalesOrder,
    VendorContract,
    VendorInvoice,
    DashboardSummaryRow,
} from '@/types/constructionErp'

export type DocumentLinkOption = {
    id: string
    moduleName: string
    systemId: string
    label: string
}

type Primitive = string | number | boolean | null
type Filter = {
    column: string
    value: Primitive | Primitive[]
    operator?: 'eq' | 'in' | 'gte' | 'lte' | 'is'
}

type ListOptions = {
    select?: string
    filters?: Filter[]
    orderBy?: string
    ascending?: boolean
}

export type PurchaseOrderPayload = Omit<PurchaseOrder, 'id' | 'system_id' | 'total_amount' | 'created_at' | 'updated_at' | 'purchase_order_lines'> & {
    id?: string
}

export type PurchaseOrderLinePayload = Omit<PurchaseOrderLine, 'id' | 'purchase_order_id' | 'total_amount' | 'created_at' | 'updated_at'> & {
    id?: string
}

export type GoodsReceiptHeaderPayload = Omit<GoodsReceiptHeader, 'id' | 'system_id' | 'created_at' | 'updated_at' | 'goods_receipts'> & {
    id?: string
}

export type GoodsReceiptItemPayload = Omit<GoodsReceiptItem, 'id' | 'grn_id' | 'system_id' | 'sap_ref_no' | 'po_id' | 'vendor_id' | 'project_id' | 'cost_code_id' | 'received_date' | 'status' | 'rejected_qty' | 'created_at' | 'updated_at'> & {
    id?: string
}

function applyFilters(query: any, filters: Filter[] = []) {
    return filters.reduce((current, filter) => {
        if (filter.operator === 'in' && Array.isArray(filter.value)) {
            return current.in(filter.column, filter.value)
        }
        if (filter.operator === 'gte') return current.gte(filter.column, filter.value)
        if (filter.operator === 'lte') return current.lte(filter.column, filter.value)
        if (filter.operator === 'is') return current.is(filter.column, filter.value)
        return current.eq(filter.column, filter.value)
    }, query)
}

export async function listRecords<T>(table: string, options: ListOptions = {}): Promise<T[]> {
    const {
        select = '*',
        filters = [],
        orderBy = 'created_at',
        ascending = false,
    } = options

    let query = supabase.from(table).select(select)
    query = applyFilters(query, filters)
    const { data, error } = await query.order(orderBy, { ascending })
    if (error) throw error
    return (data ?? []) as T[]
}

export async function createRecord<T>(table: string, payload: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.from(table).insert(payload).select('*').single()
    if (error) throw error
    return data as T
}

export async function updateRecord<T>(table: string, id: string, payload: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return data as T
}

export async function deleteRecord(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
}

export async function getERPReferenceData(activeProjectId?: string): Promise<ERPReferenceData> {
    const projectScopedFilter = activeProjectId ? [{ column: 'project_id', value: activeProjectId }] : []
    const [
        projects,
        vendors,
        clients,
        items,
        costCodes,
        users,
        departments,
        roles,
        budgets,
        salesOrders,
        purchaseRequests,
        purchaseOrders,
        vendorContracts,
        vendorInvoices,
    ] = await Promise.all([
        listRecords<Project>('projects', { orderBy: 'name', ascending: true }),
        listRecords<Vendor>('vendors', { orderBy: 'name', ascending: true }),
        listRecords<ERPClient>('clients', { orderBy: 'name', ascending: true }),
        listRecords<ERPItem>('items', { orderBy: 'item_code', ascending: true }),
        listRecords<ERPCostCode>('cost_codes', { orderBy: 'code', ascending: true }),
        listRecords<ERPUserDirectory>('users', { orderBy: 'full_name', ascending: true }),
        listRecords<ERPDepartment>('departments', { orderBy: 'name', ascending: true }),
        listRecords<ERPRole>('roles', { orderBy: 'name', ascending: true }),
        listRecords<ERPProjectBudget>('project_cost_code_budgets', { filters: projectScopedFilter }),
        listRecords<SalesOrder>('sales_orders', { filters: projectScopedFilter }),
        listRecords<PurchaseRequest>('purchase_requests', { filters: projectScopedFilter }),
        listRecords<PurchaseOrder>('purchase_orders', {
            select: '*, purchase_order_lines(*)',
            filters: projectScopedFilter,
        }),
        listRecords<VendorContract>('vendor_contracts', { filters: projectScopedFilter }),
        listRecords<VendorInvoice>('vendor_invoices', { filters: projectScopedFilter }),
    ])

    return {
        projects,
        vendors,
        clients,
        items,
        costCodes,
        users,
        departments,
        roles,
        budgets,
        salesOrders,
        purchaseRequests,
        purchaseOrders,
        vendorContracts,
        vendorInvoices,
    }
}

export async function getConstructionDashboardSnapshot() {
    const [summary, recentActivity, invoiceMismatches] = await Promise.all([
        listRecords<DashboardSummaryRow>('v_erp_dashboard_project_summary', {
            orderBy: 'project_name',
            ascending: true,
        }),
        listRecords<ActivityLog>('activity_logs', {
            orderBy: 'created_at',
            ascending: false,
        }),
        listRecords<VendorInvoice>('vendor_invoices', {
            filters: [{ column: 'validation_status', value: 'mismatch' }],
        }),
    ])

    return {
        summary,
        recentActivity: recentActivity.slice(0, 12),
        invoiceMismatches,
    }
}

export async function getMastersSnapshot() {
    const reference = await getERPReferenceData()
    return {
        clients: reference.clients,
        items: reference.items,
        costCodes: reference.costCodes,
        users: reference.users,
        departments: reference.departments,
        roles: reference.roles,
        budgets: reference.budgets,
        projects: reference.projects,
        vendors: reference.vendors,
    }
}

export async function getProcurementSnapshot(projectId: string) {
    const filters = [{ column: 'project_id', value: projectId }]
    const [salesOrders, purchaseRequests, purchaseOrders, goodsReceipts, deliveryChallans, materialIssues, inventory] = await Promise.all([
        listRecords<SalesOrder>('sales_orders', { filters }),
        listRecords<PurchaseRequest>('purchase_requests', { filters }),
        listRecords<PurchaseOrder>('purchase_orders', {
            select: '*, purchase_order_lines(*)',
            filters,
        }),
        listRecords<GoodsReceiptHeader>('grn_headers', {
            select: '*, goods_receipts(*)',
            filters,
        }),
        listRecords<DeliveryChallan>('delivery_challans', { filters }),
        listRecords<MaterialIssue>('material_issues', { filters }),
        listRecords<InventoryStock>('inventory_stocks', { filters, orderBy: 'updated_at', ascending: false }),
    ])

    return {
        salesOrders,
        purchaseRequests,
        purchaseOrders,
        goodsReceipts,
        deliveryChallans,
        materialIssues,
        inventory,
    }
}

export async function getExecutionSnapshot(projectId: string) {
    const filters = [{ column: 'project_id', value: projectId }]
    const [dprs, contracts, fuelLogs] = await Promise.all([
        listRecords<DailyProgressReport>('daily_progress_reports', { filters }),
        listRecords<VendorContract>('vendor_contracts', { filters }),
        listRecords<FuelLog>('fuel_logs', { filters, orderBy: 'log_date', ascending: false }),
    ])

    const machineryLogs = contracts.length > 0
        ? await listRecords<MachineryDailyLog>('machinery_daily_logs', {
            filters: [{ column: 'contract_id', value: contracts.map((contract) => contract.id), operator: 'in' }],
            orderBy: 'log_date',
            ascending: false,
        })
        : []

    return {
        dprs,
        contracts,
        machineryLogs,
        fuelLogs,
    }
}

export async function getFinanceSnapshot(projectId: string) {
    const filters = [{ column: 'project_id', value: projectId }]
    const [expenses, vendorInvoices, payments, raBills] = await Promise.all([
        listRecords<Expense>('expenses', { filters, orderBy: 'expense_date', ascending: false }),
        listRecords<VendorInvoice>('vendor_invoices', { filters, orderBy: 'invoice_date', ascending: false }),
        listRecords<Payment>('payments', { filters, orderBy: 'payment_date', ascending: false }),
        listRecords<RABill>('ra_bills', { filters, orderBy: 'bill_date', ascending: false }),
    ])

    return {
        expenses,
        vendorInvoices,
        payments,
        raBills,
    }
}

export async function getDocumentsSnapshot(projectId: string) {
    return listRecords<ModuleDocument>('module_documents', {
        filters: [{ column: 'project_id', value: projectId }],
        orderBy: 'created_at',
        ascending: false,
    })
}

export async function getDocumentLinkOptions(projectId: string): Promise<DocumentLinkOption[]> {
    const filters = [{ column: 'project_id', value: projectId }]
    const [
        purchaseRequests,
        purchaseOrders,
        goodsReceipts,
        dprs,
        contracts,
        vendorInvoices,
        payments,
        raBills,
    ] = await Promise.all([
        listRecords<PurchaseRequest>('purchase_requests', { filters }),
        listRecords<PurchaseOrder>('purchase_orders', { filters }),
        listRecords<GoodsReceiptHeader>('grn_headers', { filters }),
        listRecords<DailyProgressReport>('daily_progress_reports', { filters }),
        listRecords<VendorContract>('vendor_contracts', { filters }),
        listRecords<VendorInvoice>('vendor_invoices', { filters }),
        listRecords<Payment>('payments', { filters }),
        listRecords<RABill>('ra_bills', { filters }),
    ])

    return [
        ...purchaseRequests.map((record) => ({ id: record.id, moduleName: 'Purchase Request', systemId: record.system_id, label: `${record.system_id} - Purchase Request` })),
        ...purchaseOrders.map((record) => ({ id: record.id, moduleName: 'Purchase Order', systemId: record.system_id, label: `${record.system_id} - Purchase Order` })),
        ...goodsReceipts.map((record) => ({ id: record.id, moduleName: 'Goods Receipt', systemId: record.system_id, label: `${record.system_id} - Goods Receipt` })),
        ...dprs.map((record) => ({ id: record.id, moduleName: 'Daily Progress Report', systemId: record.system_id, label: `${record.system_id} - DPR` })),
        ...contracts.map((record) => ({ id: record.id, moduleName: 'Vendor Contract', systemId: record.contract_id, label: `${record.contract_id} - Contract` })),
        ...vendorInvoices.map((record) => ({ id: record.id, moduleName: 'Vendor Invoice', systemId: record.system_id, label: `${record.system_id} - Vendor Invoice` })),
        ...payments.map((record) => ({ id: record.id, moduleName: 'Payment', systemId: record.system_id, label: `${record.system_id} - Payment` })),
        ...raBills.map((record) => ({ id: record.id, moduleName: 'RA Bill', systemId: record.bill_no, label: `${record.bill_no} - RA Bill` })),
    ]
}

export async function savePurchaseOrder(header: PurchaseOrderPayload, lines: PurchaseOrderLinePayload[]) {
    if (lines.length === 0) throw new Error('At least one PO line is required.')

    const headerPayload = {
        vendor_id: header.vendor_id,
        project_id: header.project_id,
        cost_code_id: header.cost_code_id,
        purchase_request_id: header.purchase_request_id || null,
        delivery_date: header.delivery_date || null,
        sap_ref_no: header.sap_ref_no || null,
        status: header.status,
        created_by: header.created_by || null,
    }

    if (header.id) {
        const { data: order, error: orderError } = await supabase
            .from('purchase_orders')
            .update(headerPayload)
            .eq('id', header.id)
            .select('*')
            .single()

        if (orderError) throw orderError

        const { error: deleteError } = await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', header.id)
        if (deleteError) throw deleteError

        const { error: linesError } = await supabase.from('purchase_order_lines').insert(
            lines.map((line) => ({
                purchase_order_id: header.id,
                item_id: line.item_id,
                quantity: line.quantity,
                rate: line.rate,
                description: line.description || null,
            }))
        )
        if (linesError) throw linesError

        return order as PurchaseOrder
    }

    const { data: order, error: orderError } = await supabase.from('purchase_orders').insert(headerPayload).select('*').single()
    if (orderError) throw orderError

    const { error: linesError } = await supabase.from('purchase_order_lines').insert(
        lines.map((line) => ({
            purchase_order_id: order.id,
            item_id: line.item_id,
            quantity: line.quantity,
            rate: line.rate,
            description: line.description || null,
        }))
    )
    if (linesError) throw linesError

    return order as PurchaseOrder
}

export async function saveGoodsReceipt(header: GoodsReceiptHeaderPayload, items: GoodsReceiptItemPayload[]) {
    if (items.length === 0) throw new Error('At least one GRN item is required.')

    const headerPayload = {
        sap_ref_no: header.sap_ref_no || null,
        po_id: header.po_id,
        vendor_id: header.vendor_id,
        project_id: header.project_id,
        cost_code_id: header.cost_code_id,
        received_date: header.received_date,
        status: header.status,
        remarks: header.remarks || null,
        created_by: header.created_by || null,
    }

    if (header.id) {
        const { data: receipt, error: headerError } = await supabase
            .from('grn_headers')
            .update(headerPayload)
            .eq('id', header.id)
            .select('*')
            .single()

        if (headerError) throw headerError

        const { error: deleteError } = await supabase.from('goods_receipts').delete().eq('grn_id', header.id)
        if (deleteError) throw deleteError

        const { error: itemsError } = await supabase.from('goods_receipts').insert(
            items.map((item) => ({
                grn_id: header.id,
                po_id: header.po_id,
                vendor_id: header.vendor_id,
                project_id: header.project_id,
                cost_code_id: header.cost_code_id,
                received_date: header.received_date,
                item_id: item.item_id,
                ordered_qty: item.ordered_qty,
                received_qty: item.received_qty,
                accepted_qty: item.accepted_qty,
                store_location: item.store_location,
                status: header.status,
                remarks: item.remarks || header.remarks || null,
            }))
        )
        if (itemsError) throw itemsError

        return receipt as GoodsReceiptHeader
    }

    const { data: receipt, error: headerError } = await supabase.from('grn_headers').insert(headerPayload).select('*').single()
    if (headerError) throw headerError

    const { error: itemsError } = await supabase.from('goods_receipts').insert(
        items.map((item) => ({
            grn_id: receipt.id,
            po_id: header.po_id,
            vendor_id: header.vendor_id,
            project_id: header.project_id,
            cost_code_id: header.cost_code_id,
            received_date: header.received_date,
            item_id: item.item_id,
            ordered_qty: item.ordered_qty,
            received_qty: item.received_qty,
            accepted_qty: item.accepted_qty,
            store_location: item.store_location,
            status: header.status,
            remarks: item.remarks || header.remarks || null,
        }))
    )
    if (itemsError) throw itemsError

    return receipt as GoodsReceiptHeader
}

export async function uploadModuleDocument(params: {
    projectId: string
    moduleName: string
    recordId?: string | null
    recordSystemId?: string | null
    uploadedBy?: string | null
    file: File
}) {
    const safeName = params.file.name.replace(/\s+/g, '-')
    const path = `projects/${params.projectId}/${params.moduleName.toLowerCase()}/${Date.now()}-${safeName}`

    const { data: upload, error: uploadError } = await supabase.storage.from('erp-documents').upload(path, params.file)
    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage.from('erp-documents').getPublicUrl(upload.path)

    const { data, error } = await supabase.from('module_documents').insert({
        project_id: params.projectId,
        module_name: params.moduleName,
        record_id: params.recordId ?? null,
        record_system_id: params.recordSystemId ?? null,
        file_name: params.file.name,
        file_path: upload.path,
        public_url: publicUrlData.publicUrl,
        mime_type: params.file.type || null,
        file_size: params.file.size,
        uploaded_by: params.uploadedBy ?? null,
    }).select('*').single()

    if (error) throw error
    return data as ModuleDocument
}

export function toNumber(value: string) {
    return Number(value || '0')
}

export function toNullable(value: string) {
    const nextValue = value.trim()
    return nextValue ? nextValue : null
}

export function buildOptionLabel(primary: string, secondary?: string | null) {
    return secondary ? `${primary} - ${secondary}` : primary
}
