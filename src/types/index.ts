// ============================================================
// CORE DOMAIN TYPES — Irrigation Project Tracking System
// ============================================================

export type ProjectStatus = 'Active' | 'On Hold' | 'Completed'
export type BOQCategory = 'Material' | 'Installation' | 'Earthwork' | 'Equipment'
export type MaterialCategory = 'Raw' | 'Consumable' | 'Equipment' | 'Finished'
export type VendorCategory = 'Material' | 'Service' | 'Subcontract' | 'Equipment'
export type WarehouseLocation = 'WH1' | 'WH2' | 'Site Yard'
export type ReceiptLocation = 'WH1' | 'WH2' | 'Site'
export type PRStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'PO Created'
export type PRPriority = 'High' | 'Medium' | 'Low'
export type PODeliveryStatus = 'Pending' | 'Partial' | 'Received' | 'Closed'
export type POStatus = 'Open' | 'Issued' | 'Partial' | 'Closed' | 'Cancelled'
export type InspectionStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Partial'
export type InvoiceType = 'Material' | 'Service'
export type InvoiceStatus = 'Draft' | 'Submitted' | 'Certified' | 'Paid'
export type PaymentMode = 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI'
export type ChangeType = 'Addition' | 'Deletion' | 'Revision'
export type ApprovalStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
export type DocType = 'Drawing' | 'Approval' | 'Certificate' | 'Invoice' | 'Report' | 'Photo' | 'Other'
export type DocStatus = 'Active' | 'Pending' | 'Approved' | 'Rejected' | 'Revised'
export type AlertCategory = 'Procurement' | 'Billing' | 'Execution' | 'Cost' | 'Schedule' | 'Stock'
export type AlertSeverity = 'High' | 'Medium' | 'Low'
export type ResourceType = 'Labor' | 'Equipment' | 'Subcontract'
export type ExecutionType = 'Hole' | 'Round' | 'LS' | 'Meter' | 'Each'
export type CostType = 'Material' | 'Labor' | 'Equipment' | 'Subcontract' | 'Indirect'

// ---- Tables ----

export interface Project {
    id: string
    project_id: string
    project_name: string
    client: string
    location?: string
    wo_number: string
    wo_date: string
    wo_value: number
    status: ProjectStatus
    created_by?: string
    created_at: string
    updated_at: string
    remarks?: string
}

export interface BOQContract {
    id: string
    project_id: string
    boq_section: string
    boq_ref: string
    description: string
    category: BOQCategory
    uom: string
    contract_qty: number
    contract_rate: number
    contract_value: number
    is_locked: boolean
    created_at: string
    updated_at: string
    remarks?: string
}

export interface MaterialMaster {
    id: string
    material_code: string
    material_description: string
    category?: MaterialCategory
    uom: string
    active_status: boolean
    created_at: string
    remarks?: string
}

export interface BOQSAPBreakup {
    id: string
    project_id: string
    parent_boq_ref: string
    sap_boq_ref: string
    material_code: string
    description?: string
    uom: string
    required_qty: number
    rate?: number
    value?: number
    created_at: string
    updated_at: string
    remarks?: string
}

export interface PurchaseRequest {
    id: string
    pr_no: string
    pr_date: string
    project_id: string
    sap_boq_ref: string
    material_code: string
    pr_qty: number
    uom: string
    required_date: string
    priority: PRPriority
    justification?: string
    status: PRStatus
    requested_by?: string
    approved_by?: string
    approved_at?: string
    created_at: string
    updated_at: string
    remarks?: string
}

export interface WarehousePlanning {
    id: string
    project_id: string
    sap_boq_ref: string
    material_code: string
    warehouse_location: WarehouseLocation
    required_qty: number
    available_warehouse_qty: number
    reserved_qty: number
    net_available_qty: number
    qty_to_procure: number
    action_needed: 'BUY' | 'ISSUE/TRANSFER'
    created_at: string
    updated_at: string
    remarks?: string
}

export interface VendorMaster {
    id: string
    vendor_code: string
    vendor_name: string
    category: VendorCategory
    contact_person?: string
    phone?: string
    email?: string
    address?: string
    gst_no?: string
    pan_no?: string
    payment_terms: number
    performance_rating: number
    active_status: boolean
    created_at: string
    updated_at: string
    remarks?: string
}

export interface PurchaseOrder {
    id: string
    po_no: string
    po_date: string
    pr_ref?: string
    project_id: string
    sap_boq_ref: string
    material_code: string
    vendor_code?: string
    po_qty: number
    po_rate: number
    po_value: number
    tax_amount: number
    freight_amount: number
    total_po_value: number
    expected_delivery?: string
    delivery_status: PODeliveryStatus
    po_status: POStatus
    created_at: string
    updated_at: string
    remarks?: string
}

export interface GRNRegister {
    id: string
    grn_no: string
    grn_date: string
    po_ref: string
    project_id: string
    sap_boq_ref?: string
    material_code?: string
    received_qty: number
    accepted_qty: number
    rejected_qty: number
    inspection_status: InspectionStatus
    receipt_location: ReceiptLocation
    unit_rate?: number
    material_value?: number
    transport_cost: number
    total_grn_value?: number
    created_at: string
    remarks?: string
}

export interface WarehouseStock {
    id: string
    project_id: string
    material_code: string
    location: ReceiptLocation | WarehouseLocation
    current_qty: number
    weighted_avg_cost: number
    last_updated: string
}

export interface DCRegister {
    id: string
    dc_no: string
    dc_date: string
    project_id: string
    sap_boq_ref: string
    material_code: string
    dc_qty: number
    from_location: WarehouseLocation
    to_site: string
    remarks?: string
    created_at: string
}

export interface InstallationExecution {
    id: string
    execution_id: string
    execution_date: string
    project_id: string
    boq_ref: string
    sap_boq_ref: string
    execution_type: ExecutionType
    executed_qty: number
    rate?: number
    amount?: number
    resource_type?: ResourceType
    supervisor?: string
    certified_by?: string
    created_at: string
    remarks?: string
}

export interface LaborEquipmentCost {
    id: string
    entry_id: string
    cost_date: string
    project_id: string
    sap_boq_ref?: string
    resource_type: ResourceType
    resource_name: string
    hours?: number
    quantity?: number
    rate: number
    amount: number
    supervisor?: string
    created_at: string
    remarks?: string
}

export interface InvoiceRegister {
    id: string
    invoice_no: string
    invoice_date: string
    invoice_type: InvoiceType
    project_id: string
    boq_ref?: string
    sap_boq_ref?: string
    dc_ref?: string
    billed_qty: number
    rate?: number
    invoice_value?: number
    gst_amount: number
    total_invoice?: number
    status: InvoiceStatus
    certified_date?: string
    created_at: string
    updated_at: string
    remarks?: string
}

export interface PaymentTracker {
    id: string
    payment_id: string
    invoice_ref: string
    payment_date: string
    payment_amount: number
    payment_mode: PaymentMode
    transaction_ref?: string
    created_at: string
    remarks?: string
}

export interface ScheduleMilestone {
    id: string
    milestone_id: string
    project_id: string
    milestone_name: string
    boq_ref?: string
    planned_start: string
    planned_finish: string
    actual_start?: string
    actual_finish?: string
    completion_percent: number
    delay_days: number
    status: string
    created_at: string
    remarks?: string
}

export interface ChangeOrder {
    id: string
    co_no: string
    co_date: string
    project_id: string
    boq_ref?: string
    change_type: ChangeType
    description: string
    qty_change: number
    rate_change?: number
    value_impact?: number
    approval_status: ApprovalStatus
    approved_by?: string
    approved_at?: string
    created_at: string
    remarks?: string
}

export interface DocumentRegister {
    id: string
    doc_id: string
    project_id: string
    doc_type: DocType
    doc_no?: string
    description: string
    file_url?: string
    file_name?: string
    file_size?: number
    mime_type?: string
    received_date?: string
    submitted_date?: string
    status: DocStatus
    reference_id?: string
    created_at: string
    updated_at: string
    remarks?: string
}

export interface AlertLog {
    id: string
    alert_id: string
    alert_date: string
    project_id: string
    category: AlertCategory
    severity: AlertSeverity
    message: string
    sap_boq_ref?: string
    resolved: boolean
    resolved_date?: string
    resolved_by?: string
    created_at: string
}

export interface Budget {
    id: string
    project_id: string
    sap_boq_ref: string
    cost_category: string
    budget_qty: number
    budget_rate: number
    budget_value: number
    created_at: string
    updated_at: string
    remarks?: string
}

export interface ActualCost {
    id: string
    project_id: string
    sap_boq_ref?: string
    cost_type: CostType
    source_ref: string
    amount: number
    transaction_date: string
    created_at: string
    remarks?: string
}

// ---- View Types ----

export interface BOQTracker {
    boq_ref: string
    description: string
    contract_qty: number
    uom: string
    required_qty: number
    po_qty: number
    dc_qty: number
    installed_qty: number
    billed_qty: number
    balance_to_procure: number
    balance_to_dispatch: number
    balance_to_execute: number
    balance_to_bill: number
    missed_bill_flag: string
    execution_percent: number
    billing_percent: number
}

export interface BudgetVsActual {
    project_id: string
    sap_boq_ref: string
    budget_value: number
    actual_value: number
    variance: number
    variance_percent: number
    status: 'Over Budget' | 'Under Budget' | 'On Budget'
}

// ---- Dashboard KPIs ----
export interface KPIData {
    contractValue: number
    revenueCertified: number
    revenueCollected: number
    actualCost: number
    grossMargin: number
    marginPercent: number
    billableGap: number
    procurementGap: number
    scheduleVariance: number
    dso: number
    pendingAlerts: number
    criticalAlerts: number
}
