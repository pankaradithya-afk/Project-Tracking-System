-- ============================================================
-- FULL BUSINESS DATA RESET
-- Removes lifecycle data end-to-end:
-- Enquiries -> Estimation/BOQ/SAP -> Execution -> Billing -> Reports
-- Keeps auth users and profiles intact.
-- Safe to run before loading fresh production data.
-- ============================================================

begin;

do $$
declare
    tbl text;
    tables text[] := array[
        -- CRM / pre-sales
        'negotiation_logs',
        'quotation_revisions',
        'quotations',
        'cost_components',
        'boq_contracts',
        'boq_lines',
        'boq_headers',
        'designs',
        'interactions',
        'customers',

        -- execution / legacy project chain
        'change_order',
        'change_orders',
        'payment_tracker',
        'payments',
        'invoice_register',
        'ra_bills',
        'labor_equipment_cost',
        'installation_execution',
        'dc_register',
        'warehouse_stock',
        'grn_register',
        'purchase_order',
        'purchase_orders',
        'purchase_request',
        'purchase_requests',
        'warehouse_planning',
        'boq_sap_breakup',
        'boq_contract',
        'document_register',
        'alert_log',
        'schedule_milestones',
        'actual_cost',
        'budget',

        -- project management shell
        'notifications',
        'task_dependencies',
        'tasks',
        'project_stages',
        'project_members',
        'projects',

        -- master/business data also cleared for a completely fresh start
        'vendor_prices',
        'vendor_brand_mapping',
        'assets',
        'labor_rates',
        'materials',
        'vendors',
        'material_master',
        'vendor_master'
    ];
begin
    foreach tbl in array tables loop
        if to_regclass('public.' || tbl) is not null then
            execute format('truncate table public.%I restart identity cascade', tbl);
        end if;
    end loop;
end $$;

commit;
