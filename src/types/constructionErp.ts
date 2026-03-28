import type { Project, Vendor } from '@/types'

export type CostCodeCategory = 'material' | 'labour' | 'machinery' | 'fuel' | 'subcontract'
export type DocumentStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'closed'
export type ProcurementStatus = DocumentStatus
export type DeliveryStatus = DocumentStatus
export type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ContractType = 'Machinery' | 'Fuel' | 'Service'
export type ContractRateType = 'monthly' | 'hourly' | 'per_litre' | 'per_unit'
export type BillingCycle = 'monthly' | 'weekly' | 'one_time'
export type InvoiceValidationStatus = 'matched' | 'overbilling' | 'underbilling' | 'mismatch' | 'pending'
export type InvoiceVarianceLabel = 'Match' | 'Overbilling' | 'Underbilling' | 'Pending'
export type PaymentMode = 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI'
export type RABillStatus = 'draft' | 'submitted' | 'certified' | 'paid'

export interface ERPDepartment {
    id: string
    code: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
}

export interface ERPRole {
    id: string
    code: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
}

export interface ERPUserDirectory {
    id: string
    profile_id: string
    employee_code: string | null
    full_name: string
    email: string
    phone: string | null
    role_id: string | null
    department_id: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface ERPClient {
    id: string
    client_code: string
    name: string
    contact_person: string | null
    phone: string | null
    email: string | null
    address: string | null
    gst_no: string | null
    gst?: string | null
    contact_details?: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

export interface ERPItem {
    id: string
    item_code: string
    name: string
    item_type: 'material' | 'service'
    uom: string
    unit?: string | null
    category?: string | null
    standard_rate: number
    hsn_code: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface ERPCostCode {
    id: string
    code: string
    name?: string | null
    description: string
    category: CostCodeCategory
    created_at: string
    updated_at: string
}

export interface ERPProjectBudget {
    id: string
    project_id: string
    cost_code_id: string
    budget_amount: number
    created_at: string
    updated_at: string
}

export interface ERPApproval {
    id: string
    project_id: string
    module: string
    record_id: string
    status: ApprovalStatus
    approved_by: string | null
    action_date: string | null
    remarks: string | null
    created_at: string
    updated_at: string
}

export interface SalesOrder {
    id: string
    system_id: string
    sap_ref_no: string | null
    project_id: string
    client_id: string
    order_date: string
    order_value: number
    status: DocumentStatus
    remarks: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface PurchaseRequest {
    id: string
    system_id: string
    sap_ref_no: string | null
    project_id: string
    cost_code_id: string
    requested_by: string | null
    item_id: string
    quantity: number
    required_date: string
    remarks: string | null
    status: ProcurementStatus
    created_at: string
    updated_at: string
}

export interface PurchaseOrderLine {
    id: string
    purchase_order_id: string
    item_id: string
    quantity: number
    rate: number
    total_amount: number
    description: string | null
    created_at: string
    updated_at: string
}

export interface PurchaseOrder {
    id: string
    system_id: string
    sap_ref_no: string | null
    vendor_id: string
    project_id: string
    cost_code_id: string
    purchase_request_id: string | null
    delivery_date: string | null
    status: ProcurementStatus
    total_amount: number
    created_by: string | null
    created_at: string
    updated_at: string
    purchase_order_lines?: PurchaseOrderLine[]
}

export interface GoodsReceiptItem {
    id: string
    grn_id: string
    system_id: string
    sap_ref_no: string | null
    po_id: string
    vendor_id: string
    project_id: string
    cost_code_id: string
    received_date: string
    item_id: string
    ordered_qty: number
    received_qty: number
    accepted_qty: number
    rejected_qty: number
    store_location: string
    status: ProcurementStatus
    remarks: string | null
    created_at: string
    updated_at: string
}

export interface GoodsReceiptHeader {
    id: string
    system_id: string
    sap_ref_no: string | null
    po_id: string
    vendor_id: string
    project_id: string
    cost_code_id: string
    received_date: string
    status: ProcurementStatus
    remarks: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    goods_receipts?: GoodsReceiptItem[]
}

export interface DeliveryChallan {
    id: string
    system_id: string
    sap_ref_no: string | null
    project_id: string
    cost_code_id: string
    item_id: string
    quantity: number
    dispatch_date: string
    transport_details: string | null
    status: DeliveryStatus
    remarks: string | null
    created_at: string
    updated_at: string
}

export interface InventoryStock {
    id: string
    item_id: string
    project_id: string
    inward_qty: number
    outward_qty: number
    balance_qty: number
    average_rate: number
    created_at: string
    updated_at: string
}

export interface MaterialIssue {
    id: string
    system_id: string
    sap_ref_no: string | null
    project_id: string
    cost_code_id: string
    item_id: string
    quantity: number
    issued_to: string
    issue_date: string
    remarks: string | null
    status: DocumentStatus
    created_at: string
    updated_at: string
}

export interface DailyProgressReport {
    id: string
    system_id: string
    sap_ref_no: string | null
    project_id: string
    cost_code_id: string | null
    boq_line_id: string | null
    report_date: string
    activity: string
    work_description: string
    quantity_executed: number
    labour_count: number
    machinery_used: string | null
    issues: string | null
    remarks: string | null
    photo_url: string | null
    created_by: string | null
    status: DocumentStatus
    created_at: string
    updated_at: string
}

export interface VendorContract {
    id: string
    system_id?: string | null
    contract_id: string
    sap_ref_no: string | null
    vendor_id: string
    project_id: string
    cost_code_id: string | null
    contract_type: ContractType
    rate_type: ContractRateType | null
    rate: number | null
    machine_name: string | null
    monthly_rate: number
    hourly_rate: number | null
    rate_per_litre: number | null
    start_date: string
    end_date: string
    terms_conditions: string | null
    terms: string | null
    billing_cycle: BillingCycle
    status: DocumentStatus
    created_at: string
    updated_at: string
}

export interface MachineryDailyLog {
    id: string
    system_id: string
    sap_ref_no: string | null
    contract_id: string
    project_id: string | null
    cost_code_id: string | null
    machine_name: string
    log_date: string
    working_hours: number
    idle_hours: number
    fuel_consumption: number
    operator_name: string | null
    payable_amount: number
    status: DocumentStatus
    created_at: string
    updated_at: string
}

export interface FuelLog {
    id: string
    system_id: string
    sap_ref_no: string | null
    contract_id: string
    project_id: string
    cost_code_id: string | null
    log_date: string
    machine_name: string
    litres_consumed: number
    rate: number
    total_cost: number
    status: DocumentStatus
    created_at: string
    updated_at: string
}

export interface Expense {
    id: string
    system_id: string
    sap_ref_no: string | null
    project_id: string
    cost_code_id: string
    expense_type: string
    amount: number
    expense_date: string
    linked_reference: string | null
    reference_module: string | null
    remarks: string | null
    status: DocumentStatus
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface VendorInvoice {
    id: string
    system_id: string
    sap_ref_no: string | null
    vendor_id: string
    project_id: string
    cost_code_id: string | null
    contract_id: string | null
    po_id: string | null
    invoice_amount: number
    calculated_amount: number
    variance: number
    invoice_date: string
    validation_status: InvoiceValidationStatus
    status: DocumentStatus
    remarks: string | null
    created_at: string
    updated_at: string
}

export interface Payment {
    id: string
    system_id: string
    sap_ref_no: string | null
    invoice_id: string
    project_id: string
    cost_code_id: string | null
    amount_paid: number
    payment_date: string
    payment_mode: PaymentMode
    status: DocumentStatus
    remarks: string | null
    created_at: string
    updated_at: string
}

export interface RABill {
    id: string
    system_id?: string | null
    project_id: string
    client_id: string | null
    bill_no: string
    sap_ref_no: string | null
    bill_date: string
    work_done_value: number
    previous_billing: number
    current_billing: number
    retention: number
    net_payable: number
    status: RABillStatus
    created_at: string
    updated_at: string
}

export interface ModuleDocument {
    id: string
    system_id?: string | null
    sap_ref_no?: string | null
    project_id: string
    module_name: string
    record_id: string | null
    record_system_id: string | null
    file_name: string
    file_path: string
    public_url: string
    mime_type: string | null
    file_size: number | null
    uploaded_by: string | null
    status?: DocumentStatus
    created_at: string
    updated_at: string
}

export interface ActivityLog {
    id: string
    user_id: string | null
    action: string
    table_name: string
    record_id: string | null
    record_system_id: string | null
    payload: Record<string, unknown> | null
    created_at: string
}

export interface DashboardSummaryRow {
    project_id: string
    project_name: string
    budget_amount: number
    cost_to_date: number
    pending_pr_count: number
    pending_po_count: number
    pending_grn_count: number
    pending_invoice_count: number
    pending_payment_count: number
    cash_outflow: number
    cash_paid: number
    dpr_entries: number
    dpr_quantity: number
    open_invoice_variance_count: number
}

export interface ERPReferenceData {
    projects: Project[]
    vendors: Vendor[]
    clients: ERPClient[]
    items: ERPItem[]
    costCodes: ERPCostCode[]
    users: ERPUserDirectory[]
    departments: ERPDepartment[]
    roles: ERPRole[]
    budgets: ERPProjectBudget[]
    salesOrders: SalesOrder[]
    purchaseRequests: PurchaseRequest[]
    purchaseOrders: PurchaseOrder[]
    vendorContracts: VendorContract[]
    vendorInvoices: VendorInvoice[]
}
