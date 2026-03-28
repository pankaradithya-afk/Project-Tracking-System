// ============================================================
// CORE DOMAIN TYPES - Irrigation Project Tracking System
// ============================================================

export type ProjectLifecycleStatus = 'enquiry' | 'upcoming' | 'current' | 'finished' | 'archived'
export type LegacyProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectStatus = ProjectLifecycleStatus | LegacyProjectStatus
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type UserRole = 'admin' | 'member' | 'viewer'
export type CustomerCompanyType = 'private' | 'govt' | 'consultant'
export type ERPProjectType = 'golf' | 'cricket' | 'football'
export type InteractionMode = 'call' | 'meeting' | 'email'
export type DesignType = 'concept' | 'detailed' | 'ifc'
export type DesignApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ERPBOQLineCategory = 'material' | 'labor' | 'lumpsum'
export type CostComponentType = 'material' | 'import_duty' | 'freight' | 'labor' | 'overheads' | 'margin'
export type QuotationStatus = 'draft' | 'submitted' | 'revised' | 'approved'
export type ERPVendorType = 'manufacturer' | 'dealer' | 'retailer'
export type ERPAssetType = 'equipment' | 'tool'
export type AssetOwnership = 'owned' | 'hired'
export type LaborSkillLevel = 'unskilled' | 'semi_skilled' | 'skilled' | 'specialist'

export interface User {
    id: string
    auth_user_id: string
    full_name: string | null
    email: string
    role: UserRole
    avatar_url: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface ProjectMember {
    id: string
    project_id: string
    user_id: string
    role: UserRole
    joined_at: string
    user?: User
}

export interface TaskDependency {
    id: string
    task_id: string
    dependency_task_id: string
    created_at: string
    dependency_task?: Task
}

export interface ProjectStage {
    id: string
    name: string
    description: string | null
    sort_order: number
    is_default: boolean
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Notification {
    id: string
    user_id: string
    project_id: string | null
    task_id: string | null
    type: 'task_assigned' | 'task_completed' | 'deadline_approaching' | 'project_updated' | 'system'
    title: string
    message: string
    read_at: string | null
    created_at: string
    project?: Project
    task?: Task
}

export interface Project {
    id: string
    name: string
    description: string | null
    status: ProjectStatus
    start_date: string
    end_date: string | null
    progress: number
    created_by: string
    created_at: string
    updated_at: string
    deleted_at: string | null
    archived_at: string | null
    team_members?: ProjectMember[]
    tasks?: Task[]
    task_count?: number
    completed_task_count?: number
    upcoming_deadline_count?: number
    // Legacy fields kept for existing pages while we migrate.
    project_id?: string
    project_name?: string
    client?: string
    client_contact?: string
    location?: string
    wo_number?: string
    wo_date?: string
    wo_value?: number
    scope_of_works?: string
    team_plan?: string
    work_plan?: string
    wo_received_date?: string
    order_value?: number
    remarks?: string
}

export interface Task {
    id: string
    project_id: string
    title: string
    description: string | null
    status: TaskStatus
    priority: TaskPriority
    assigned_to: string | null
    due_date: string | null
    completed_at: string | null
    sort_order: number
    created_by: string
    created_at: string
    updated_at: string
    deleted_at: string | null
    assignee?: User
    dependencies?: TaskDependency[]
    dependent_tasks?: TaskDependency[]
}

export interface Customer {
    id: string
    client_name: string
    company_type: CustomerCompanyType
    contact_person: string | null
    phone: string | null
    email: string | null
    address: string | null
    gst_no: string | null
    payment_behavior: string | null
    credit_period: number
    created_at: string
    updated_at: string
}

export interface Interaction {
    id: string
    project_id: string
    interaction_date: string
    mode: InteractionMode
    discussion_summary: string
    action_required: string | null
    responsible_person_id: string | null
    created_at: string
    updated_at: string
    responsible_person?: User | null
}

export interface Design {
    id: string
    project_id: string
    version_no: number
    designer_id: string | null
    design_type: DesignType
    approval_status: DesignApprovalStatus
    is_final_ifc: boolean
    is_locked: boolean
    finalized_at: string | null
    created_at: string
    updated_at: string
    designer?: User | null
}

export interface BOQHeader {
    id: string
    project_id: string
    design_id: string
    version_no: number
    prepared_by: string | null
    boq_date: string
    created_at: string
    updated_at: string
}

export interface BOQLine {
    id: string
    boq_header_id: string
    line_no: number
    material_id: string | null
    description: string | null
    category: ERPBOQLineCategory
    qty: number
    uom: string
    rate: number
    amount: number
    sap_breakup_required: boolean
    created_at: string
    updated_at: string
    material?: Material | null
}

export interface CostComponent {
    id: string
    boq_line_id: string
    component_type: CostComponentType
    component_amount: number
    created_at: string
    updated_at: string
}

export interface Quotation {
    id: string
    project_id: string
    design_id: string
    version_no: number
    total_cost: number
    quoted_value: number
    margin_percent: number
    validity_date: string | null
    status: QuotationStatus
    approved_at: string | null
    created_at: string
    updated_at: string
    design?: Design
}

export interface QuotationRevision {
    id: string
    quotation_id: string
    revision_no: number
    previous_quoted_value: number | null
    revised_quoted_value: number
    commercial_impact: number
    final_agreed_value: number | null
    revision_reason: string | null
    revised_by: string | null
    revision_date: string
    created_at: string
    updated_at: string
}

export interface NegotiationLog {
    id: string
    quotation_id: string
    discussion_date: string
    discussion_summary: string
    commercial_impact: number
    proposed_value: number | null
    agreed_value: number | null
    next_action: string | null
    logged_by: string | null
    created_at: string
    updated_at: string
}

export interface Material {
    id: string
    code: string
    description: string
    category: 'raw' | 'consumable' | 'equipment' | 'finished'
    uom: string
    standard_cost: number
    created_at: string
    updated_at: string
}

export interface Vendor {
    id: string
    name: string
    type: ERPVendorType
    contact_person: string | null
    phone: string | null
    email: string | null
    address: string | null
    payment_terms: string | null
    gst_no: string | null
    created_at: string
    updated_at: string
}

export interface VendorBrandMapping {
    id: string
    vendor_id: string
    brand_name: string
    dealer_type: string | null
    territory: string | null
    created_at: string
    updated_at: string
}

export interface VendorPrice {
    id: string
    vendor_id: string
    material_code: string
    base_price: number
    discount: number
    net_price: number
    created_at: string
    updated_at: string
}

export interface Asset {
    id: string
    asset_code: string
    asset_name: string
    asset_type: ERPAssetType
    ownership: AssetOwnership
    current_project_id: string | null
    created_at: string
    updated_at: string
}

export interface LaborRate {
    id: string
    category: string
    skill_level: LaborSkillLevel
    daily_rate: number
    created_at: string
    updated_at: string
}

export interface BOQContractExecution {
    id: string
    project_id: string
    quotation_id: string
    design_id: string
    boq_line_id: string
    contract_version_no: number
    line_no: number
    material_id: string | null
    description: string | null
    category: ERPBOQLineCategory
    qty: number
    uom: string
    rate: number
    amount: number
    sap_breakup_required: boolean
    locked_at: string
    created_at: string
    updated_at: string
}
export type BOQItemType = 'regular' | 'lumpsum'
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

export interface BOQItem {
    id: string
    system_id: string
    sap_ref_no: string
    project_id: string
    cost_code_id: string
    cost_code?: string
    item_id: string
    item_code?: string
    item_name?: string
    boq_ref: string
    boq_section: string
    line_no: number
    category: BOQCategory
    item_type: BOQItemType
    description: string
    quantity: number
    uom: string
    rate: number
    amount: number
    breakup_count?: number
    breakup_amount?: number
    breakup_matches?: boolean
    created_at: string
    updated_at: string
}

export interface BOQLumpsumBreakupLine {
    id: string
    system_id: string
    boq_item_id: string
    project_id: string
    cost_code_id: string
    cost_code?: string
    material_item_id: string
    material_item_code?: string
    material_item_name?: string
    line_no: number
    sap_ref_no: string
    description: string
    quantity: number
    uom: string
    rate: number
    amount: number
    boq_ref?: string
    boq_section?: string
    boq_description?: string
    boq_amount?: number
    breakup_total?: number
    variance?: number
    created_at: string
    updated_at: string
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
    project_id: string
    category: AlertCategory
    severity: AlertSeverity
    message: string
    sap_boq_ref?: string
    resolved: boolean
    resolved_date?: string
    resolved_by?: string
    created_at: string
    alert_id?: string
    alert_date?: string
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
