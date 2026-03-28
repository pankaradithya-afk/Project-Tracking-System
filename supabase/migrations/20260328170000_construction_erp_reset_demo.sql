-- ============================================================
-- Construction ERP Reset + Structured Demo Lifecycle
-- Wipes operational/demo junk, strengthens ERP automation,
-- and seeds one complete construction project flow.
-- ============================================================

create extension if not exists pgcrypto;

alter type erp_contract_rate_type add value if not exists 'per_litre';
alter type erp_invoice_validation_status add value if not exists 'overbilling';
alter type erp_invoice_validation_status add value if not exists 'underbilling';

do $$
declare
    tbl text;
    tables text[] := array[
        'approvals',
        'module_documents',
        'activity_logs',
        'erp_notifications',
        'payments',
        'vendor_invoices',
        'fuel_logs',
        'machinery_daily_logs',
        'vendor_contracts',
        'expenses',
        'daily_progress_reports',
        'material_issues',
        'inventory_stocks',
        'goods_receipts',
        'grn_headers',
        'delivery_challans',
        'purchase_order_lines',
        'purchase_orders',
        'purchase_requests',
        'sales_orders',
        'ra_bills',
        'project_cost_code_budgets',
        'cost_codes',
        'items',
        'vendors',
        'clients',
        'erp_number_sequences',
        'change_order',
        'change_orders',
        'payment_tracker',
        'invoice_register',
        'labor_equipment_cost',
        'installation_execution',
        'dc_register',
        'warehouse_stock',
        'grn_register',
        'purchase_order',
        'purchase_request',
        'warehouse_planning',
        'boq_sap_breakup',
        'boq_contract',
        'boq_contracts',
        'document_register',
        'alert_log',
        'schedule_milestones',
        'actual_cost',
        'budget',
        'negotiation_logs',
        'quotation_revisions',
        'quotations',
        'cost_components',
        'boq_lines',
        'boq_headers',
        'designs',
        'interactions',
        'vendor_prices',
        'vendor_brand_mapping',
        'assets',
        'labor_rates',
        'materials',
        'customers',
        'material_master',
        'vendor_master',
        'notifications',
        'task_dependencies',
        'tasks',
        'project_stages',
        'project_members',
        'projects'
    ];
begin
    foreach tbl in array tables loop
        if to_regclass('public.' || tbl) is not null then
            execute format('truncate table public.%I restart identity cascade', tbl);
        end if;
    end loop;
end $$;

delete from storage.objects where bucket_id = 'erp-documents';

alter table public.material_issues
    add column if not exists sap_ref_no text,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.daily_progress_reports
    add column if not exists status erp_document_status not null default 'draft';

alter table public.vendor_contracts
    add column if not exists system_id text default public.generate_doc_no('VCT');

alter table public.machinery_daily_logs
    add column if not exists status erp_document_status not null default 'draft';

alter table public.fuel_logs
    add column if not exists status erp_document_status not null default 'draft';

alter table public.ra_bills
    add column if not exists system_id text default public.generate_doc_no('RA');

alter table public.module_documents
    add column if not exists system_id text default public.generate_doc_no('DOC'),
    add column if not exists sap_ref_no text,
    add column if not exists status erp_document_status not null default 'draft';

create unique index if not exists idx_vendor_contracts_system_id on public.vendor_contracts(system_id);
create unique index if not exists idx_ra_bills_system_id on public.ra_bills(system_id);
create unique index if not exists idx_module_documents_system_id on public.module_documents(system_id);

alter table public.vendor_contracts
    alter column cost_code_id set not null,
    alter column rate_type set not null,
    alter column rate set not null,
    alter column system_id set default public.generate_doc_no('VCT');

alter table public.daily_progress_reports
    alter column cost_code_id set not null;

alter table public.machinery_daily_logs
    alter column project_id set not null,
    alter column cost_code_id set not null;

alter table public.fuel_logs
    alter column cost_code_id set not null;

alter table public.vendor_invoices
    alter column cost_code_id set not null;

alter table public.payments
    alter column cost_code_id set not null;

alter table public.projects
    add column if not exists project_value numeric(16, 2) not null default 0;

create or replace function public.refresh_inventory_stock(p_project_id uuid, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_inward numeric(14, 3);
    v_outward numeric(14, 3);
    v_avg_rate numeric(14, 2);
begin
    select
        coalesce(sum(gr.accepted_qty), 0),
        coalesce(
            sum(
                case
                    when gr.accepted_qty > 0 then pol.rate * gr.accepted_qty
                    else 0
                end
            ) / nullif(sum(gr.accepted_qty), 0),
            0
        )
    into v_inward, v_avg_rate
    from public.goods_receipts gr
    left join public.grn_headers gh on gh.id = gr.grn_id
    left join public.purchase_order_lines pol
        on pol.purchase_order_id = coalesce(gh.po_id, gr.po_id)
       and pol.item_id = gr.item_id
    where gr.project_id = p_project_id
      and gr.item_id = p_item_id
      and coalesce(gh.status::text, gr.status::text) in ('approved', 'closed');

    select coalesce(sum(qty), 0)
    into v_outward
    from (
        select dc.quantity as qty
        from public.delivery_challans dc
        where dc.project_id = p_project_id
          and dc.item_id = p_item_id
          and dc.status::text in ('approved', 'closed')
        union all
        select mi.quantity as qty
        from public.material_issues mi
        where mi.project_id = p_project_id
          and mi.item_id = p_item_id
          and mi.status::text in ('approved', 'closed')
    ) movement;

    insert into public.inventory_stocks (
        project_id,
        item_id,
        inward_qty,
        outward_qty,
        balance_qty,
        average_rate,
        updated_at
    )
    values (
        p_project_id,
        p_item_id,
        v_inward,
        v_outward,
        greatest(v_inward - v_outward, 0),
        coalesce(v_avg_rate, 0),
        now()
    )
    on conflict (item_id, project_id) do update
    set inward_qty = excluded.inward_qty,
        outward_qty = excluded.outward_qty,
        balance_qty = excluded.balance_qty,
        average_rate = excluded.average_rate,
        updated_at = now();
end;
$$;

create or replace function public.sync_grn_header_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.goods_receipts
    set po_id = new.po_id,
        vendor_id = new.vendor_id,
        project_id = new.project_id,
        cost_code_id = new.cost_code_id,
        received_date = new.received_date,
        status = new.status,
        updated_at = now()
    where grn_id = new.id;

    return new;
end;
$$;

drop trigger if exists trg_grn_headers_sync_lines on public.grn_headers;
create trigger trg_grn_headers_sync_lines
after update on public.grn_headers
for each row execute function public.sync_grn_header_lines();

create or replace function public.handle_purchase_order_lines_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_purchase_order_id uuid;
    v_record record;
begin
    v_purchase_order_id := coalesce(new.purchase_order_id, old.purchase_order_id);
    perform public.refresh_purchase_order_total(v_purchase_order_id);

    for v_record in
        select distinct gr.project_id, gr.item_id
        from public.goods_receipts gr
        where gr.po_id = v_purchase_order_id
    loop
        perform public.refresh_inventory_stock(v_record.project_id, v_record.item_id);
    end loop;

    return coalesce(new, old);
end;
$$;

create or replace function public.get_available_inventory_qty(p_project_id uuid, p_item_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
    v_balance numeric(14, 3);
begin
    perform public.refresh_inventory_stock(p_project_id, p_item_id);

    select coalesce(balance_qty, 0)
    into v_balance
    from public.inventory_stocks
    where project_id = p_project_id
      and item_id = p_item_id;

    return coalesce(v_balance, 0);
end;
$$;

create or replace function public.validate_material_issue_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_available numeric(14, 3);
    v_existing_qty numeric(14, 3) := 0;
begin
    v_available := public.get_available_inventory_qty(new.project_id, new.item_id);

    if tg_op = 'UPDATE'
       and old.project_id = new.project_id
       and old.item_id = new.item_id then
        v_existing_qty := coalesce(old.quantity, 0);
    end if;

    if coalesce(new.quantity, 0) > v_available + v_existing_qty then
        raise exception 'Insufficient stock for item %. Available: %, requested: %',
            new.item_id,
            v_available + v_existing_qty,
            new.quantity;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_material_issues_validate_balance on public.material_issues;
create trigger trg_material_issues_validate_balance
before insert or update on public.material_issues
for each row execute function public.validate_material_issue_balance();

create or replace function public.set_machinery_log_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rate_type erp_contract_rate_type;
    v_rate numeric(14, 2);
    v_project_id uuid;
    v_cost_code_id uuid;
begin
    select rate_type, rate, project_id, cost_code_id
    into v_rate_type, v_rate, v_project_id, v_cost_code_id
    from public.vendor_contracts
    where id = new.contract_id;

    new.project_id := coalesce(new.project_id, v_project_id);
    new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    new.status := coalesce(new.status, 'draft');
    new.payable_amount := round(
        case
            when v_rate_type = 'hourly' then coalesce(new.working_hours, 0) * coalesce(v_rate, 0)
            when v_rate_type = 'monthly' and coalesce(new.working_hours, 0) > 0 then coalesce(v_rate, 0)
            else coalesce(new.working_hours, 0) * coalesce(v_rate, 0)
        end,
        2
    );

    return new;
end;
$$;

create or replace function public.set_fuel_log_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_cost_code_id uuid;
    v_rate numeric(14, 2);
begin
    select project_id, cost_code_id, coalesce(rate, rate_per_litre, 0)
    into v_project_id, v_cost_code_id, v_rate
    from public.vendor_contracts
    where id = new.contract_id;

    new.project_id := coalesce(new.project_id, v_project_id);
    new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    new.rate := case when coalesce(new.rate, 0) > 0 then new.rate else coalesce(v_rate, 0) end;
    new.status := coalesce(new.status, 'draft');

    return new;
end;
$$;

create or replace function public.calculate_vendor_invoice_amount(
    p_contract_id uuid,
    p_po_id uuid,
    p_invoice_date date
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
    v_contract_type erp_contract_type;
    v_total numeric(16, 2) := 0;
    v_month_start date := date_trunc('month', p_invoice_date)::date;
    v_month_end date := (date_trunc('month', p_invoice_date) + interval '1 month - 1 day')::date;
begin
    if p_po_id is not null then
        select coalesce(sum(gr.accepted_qty * coalesce(pol.rate, 0)), 0)
        into v_total
        from public.goods_receipts gr
        left join public.grn_headers gh on gh.id = gr.grn_id
        left join public.purchase_order_lines pol
            on pol.purchase_order_id = coalesce(gh.po_id, gr.po_id)
           and pol.item_id = gr.item_id
        where coalesce(gh.po_id, gr.po_id) = p_po_id
          and coalesce(gh.received_date, gr.received_date) <= p_invoice_date
          and coalesce(gh.status::text, gr.status::text) in ('approved', 'closed');

        return coalesce(v_total, 0);
    end if;

    if p_contract_id is null then
        return 0;
    end if;

    select contract_type
    into v_contract_type
    from public.vendor_contracts
    where id = p_contract_id;

    if v_contract_type = 'Fuel' then
        select coalesce(sum(total_cost), 0)
        into v_total
        from public.fuel_logs
        where contract_id = p_contract_id
          and log_date between v_month_start and v_month_end
          and status::text in ('approved', 'closed');
    elsif v_contract_type = 'Machinery' then
        select coalesce(sum(payable_amount), 0)
        into v_total
        from public.machinery_daily_logs
        where contract_id = p_contract_id
          and log_date between v_month_start and v_month_end
          and status::text in ('approved', 'closed');
    end if;

    return coalesce(v_total, 0);
end;
$$;

create or replace function public.calculate_vendor_invoice_amount(
    p_contract_id uuid,
    p_invoice_date date
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.calculate_vendor_invoice_amount(p_contract_id, null, p_invoice_date);
end;
$$;

create or replace function public.set_vendor_invoice_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_cost_code_id uuid;
begin
    if new.po_id is not null then
        select project_id, cost_code_id
        into v_project_id, v_cost_code_id
        from public.purchase_orders
        where id = new.po_id;

        new.project_id := coalesce(new.project_id, v_project_id);
        new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    elsif new.contract_id is not null then
        select project_id, cost_code_id
        into v_project_id, v_cost_code_id
        from public.vendor_contracts
        where id = new.contract_id;

        new.project_id := coalesce(new.project_id, v_project_id);
        new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    end if;

    new.calculated_amount := public.calculate_vendor_invoice_amount(new.contract_id, new.po_id, new.invoice_date);
    new.variance := round(coalesce(new.invoice_amount, 0) - coalesce(new.calculated_amount, 0), 2);
    new.validation_status := case
        when new.contract_id is null and new.po_id is null then 'pending'
        when abs(new.variance) <= 0.01 then 'matched'
        when new.variance > 0 then 'overbilling'
        else 'underbilling'
    end;

    return new;
end;
$$;

create or replace function public.notify_invoice_mismatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.validation_status in ('overbilling', 'underbilling', 'mismatch') then
        insert into public.erp_notifications (project_id, module_name, record_id, title, message)
        values (
            new.project_id,
            'Vendor Invoice',
            new.id,
            'Invoice validation warning',
            'Vendor invoice ' || new.system_id || ' has a ' || replace(new.validation_status::text, '_', ' ') || ' variance.'
        );
    end if;

    return new;
end;
$$;

create or replace view public.v_erp_dashboard_project_summary as
select
    p.id as project_id,
    p.name as project_name,
    coalesce((
        select sum(pcb.budget_amount)
        from public.project_cost_code_budgets pcb
        where pcb.project_id = p.id
    ), 0) as budget_amount,
    (
        coalesce((
            select sum(po.total_amount)
            from public.purchase_orders po
            where po.project_id = p.id
        ), 0)
        + coalesce((
            select sum(e.amount)
            from public.expenses e
            where e.project_id = p.id
        ), 0)
    ) as cost_to_date,
    coalesce((
        select count(*)
        from public.purchase_requests pr
        where pr.project_id = p.id
          and pr.status in ('draft', 'submitted')
    ), 0) as pending_pr_count,
    coalesce((
        select count(*)
        from public.purchase_orders po
        where po.project_id = p.id
          and po.status in ('draft', 'submitted', 'approved')
    ), 0) as pending_po_count,
    coalesce((
        select count(*)
        from public.grn_headers gh
        where gh.project_id = p.id
          and gh.status in ('draft', 'submitted')
    ), 0) as pending_grn_count,
    coalesce((
        select count(*)
        from public.vendor_invoices vi
        where vi.project_id = p.id
          and vi.status in ('draft', 'submitted', 'approved')
    ), 0) as pending_invoice_count,
    coalesce((
        select count(*)
        from public.vendor_invoices vi
        left join (
            select invoice_id, sum(amount_paid) as paid_amount
            from public.payments
            where status in ('approved', 'closed')
            group by invoice_id
        ) pay on pay.invoice_id = vi.id
        where vi.project_id = p.id
          and coalesce(pay.paid_amount, 0) < vi.invoice_amount
    ), 0) as pending_payment_count,
    coalesce((
        select sum(vi.invoice_amount)
        from public.vendor_invoices vi
        where vi.project_id = p.id
    ), 0) as cash_outflow,
    coalesce((
        select sum(pay.amount_paid)
        from public.payments pay
        where pay.project_id = p.id
          and pay.status in ('approved', 'closed')
    ), 0) as cash_paid,
    coalesce((
        select count(*)
        from public.daily_progress_reports dpr
        where dpr.project_id = p.id
    ), 0) as dpr_entries,
    coalesce((
        select sum(dpr.quantity_executed)
        from public.daily_progress_reports dpr
        where dpr.project_id = p.id
    ), 0) as dpr_quantity,
    coalesce((
        select count(*)
        from public.vendor_invoices vi
        where vi.project_id = p.id
          and vi.validation_status in ('overbilling', 'underbilling', 'mismatch')
    ), 0) as open_invoice_variance_count
from public.projects p
where p.deleted_at is null;

do $$
declare
    v_owner_profile_id uuid;
    v_client_id uuid;
    v_vendor_material_id uuid;
    v_vendor_machinery_id uuid;
    v_vendor_fuel_id uuid;
    v_project_id uuid;
    v_cost_code_material uuid;
    v_cost_code_labour uuid;
    v_cost_code_machinery uuid;
    v_cost_code_fuel uuid;
    v_item_cement uuid;
    v_item_steel uuid;
    v_item_sand uuid;
    v_item_diesel uuid;
    v_pr_id uuid;
    v_po_id uuid;
    v_grn_id uuid;
    v_contract_machine_id uuid;
    v_contract_fuel_id uuid;
    v_invoice_po_id uuid;
begin
    select p.id
    into v_owner_profile_id
    from public.profiles p
    order by case when p.role = 'admin' then 0 else 1 end, p.created_at
    limit 1;

    if v_owner_profile_id is null then
        raise exception 'No profile exists to own the ERP demo project. Create an authenticated user/profile first.';
    end if;

    insert into public.clients (
        client_code,
        name,
        contact_person,
        phone,
        email,
        address,
        gst_no,
        gst,
        contact_details
    )
    values (
        'CLI-2026-0001',
        'Government Department',
        'Chief Engineer',
        '+91-11-40000001',
        'projects@govdept.example',
        'Irrigation Circle Office, India',
        '07AABCGD0001A1Z5',
        '07AABCGD0001A1Z5',
        jsonb_build_object(
            'contact_person', 'Chief Engineer',
            'phone', '+91-11-40000001',
            'email', 'projects@govdept.example',
            'address', 'Irrigation Circle Office, India'
        )
    )
    returning id into v_client_id;

    insert into public.vendors (
        name,
        type,
        contact_person,
        phone,
        email,
        address,
        payment_terms,
        gst_no,
        gst,
        contact_details
    )
    values
        (
            'ABC Traders',
            'dealer',
            'Amit Bansal',
            '+91-98-10000001',
            'orders@abctraders.example',
            'Warehouse Road, Delhi',
            '30 days',
            '07AABCA0001A1Z1',
            '07AABCA0001A1Z1',
            jsonb_build_object(
                'contact_person', 'Amit Bansal',
                'phone', '+91-98-10000001',
                'email', 'orders@abctraders.example',
                'address', 'Warehouse Road, Delhi',
                'payment_terms', '30 days'
            )
        ),
        (
            'Canal Earthmovers',
            'retailer',
            'Rakesh Singh',
            '+91-98-10000002',
            'ops@canalearthmovers.example',
            'Plant Yard, Jaipur',
            'Monthly',
            '08AABCC0002A1Z2',
            '08AABCC0002A1Z2',
            jsonb_build_object(
                'contact_person', 'Rakesh Singh',
                'phone', '+91-98-10000002',
                'email', 'ops@canalearthmovers.example',
                'address', 'Plant Yard, Jaipur',
                'payment_terms', 'Monthly'
            )
        ),
        (
            'Site Fuel Services',
            'dealer',
            'Neha Verma',
            '+91-98-10000003',
            'billing@sitefuel.example',
            'Fuel Depot, Kota',
            '15 days',
            '08AABCS0003A1Z3',
            '08AABCS0003A1Z3',
            jsonb_build_object(
                'contact_person', 'Neha Verma',
                'phone', '+91-98-10000003',
                'email', 'billing@sitefuel.example',
                'address', 'Fuel Depot, Kota',
                'payment_terms', '15 days'
            )
        );

    select id into v_vendor_material_id from public.vendors where name = 'ABC Traders';
    select id into v_vendor_machinery_id from public.vendors where name = 'Canal Earthmovers';
    select id into v_vendor_fuel_id from public.vendors where name = 'Site Fuel Services';

    insert into public.items (
        item_code,
        name,
        item_type,
        uom,
        unit,
        category,
        standard_rate,
        hsn_code,
        is_active
    )
    values
        ('ITEM-CEM-001', 'Cement', 'material', 'bags', 'bags', 'Material', 420.00, '2523', true),
        ('ITEM-STL-001', 'Steel', 'material', 'kg', 'kg', 'Material', 68.00, '7214', true),
        ('ITEM-SND-001', 'Sand', 'material', 'cum', 'cum', 'Material', 1500.00, '2505', true),
        ('ITEM-DIE-001', 'Diesel', 'material', 'litre', 'litre', 'Fuel', 92.00, '2710', true);

    select id into v_item_cement from public.items where item_code = 'ITEM-CEM-001';
    select id into v_item_steel from public.items where item_code = 'ITEM-STL-001';
    select id into v_item_sand from public.items where item_code = 'ITEM-SND-001';
    select id into v_item_diesel from public.items where item_code = 'ITEM-DIE-001';

    insert into public.cost_codes (code, name, description, category)
    values
        ('CC-MAT', 'Material', 'Material', 'material'),
        ('CC-LAB', 'Labour', 'Labour', 'labour'),
        ('CC-MCH', 'Machinery', 'Machinery', 'machinery'),
        ('CC-FUL', 'Fuel', 'Fuel', 'fuel');

    select id into v_cost_code_material from public.cost_codes where code = 'CC-MAT';
    select id into v_cost_code_labour from public.cost_codes where code = 'CC-LAB';
    select id into v_cost_code_machinery from public.cost_codes where code = 'CC-MCH';
    select id into v_cost_code_fuel from public.cost_codes where code = 'CC-FUL';

    insert into public.projects (
        name,
        description,
        status,
        start_date,
        end_date,
        progress,
        created_by,
        client_id,
        project_value
    )
    values (
        'Irrigation Canal Project - Phase 1',
        'Structured ERP demo project for procurement, stock, issue, DPR, contract billing, invoice validation, and payment flow. Budgeted at INR 5 Cr over a 6 month duration.',
        'current',
        date '2026-03-20',
        date '2026-09-19',
        18,
        v_owner_profile_id,
        v_client_id,
        50000000.00
    )
    returning id into v_project_id;

    insert into public.project_members (project_id, user_id, role)
    select v_project_id, p.id, 'admin'
    from public.profiles p
    on conflict (project_id, user_id) do nothing;

    insert into public.project_cost_code_budgets (project_id, cost_code_id, budget_amount)
    values
        (v_project_id, v_cost_code_material, 22000000.00),
        (v_project_id, v_cost_code_labour, 11000000.00),
        (v_project_id, v_cost_code_machinery, 10000000.00),
        (v_project_id, v_cost_code_fuel, 7000000.00);

    insert into public.purchase_requests (
        project_id,
        cost_code_id,
        requested_by,
        item_id,
        quantity,
        required_date,
        remarks,
        status
    )
    values (
        v_project_id,
        v_cost_code_material,
        v_owner_profile_id,
        v_item_cement,
        100,
        date '2026-03-29',
        'Cement required for canal concrete lining work.',
        'approved'
    )
    returning id into v_pr_id;

    insert into public.purchase_orders (
        vendor_id,
        project_id,
        cost_code_id,
        purchase_request_id,
        delivery_date,
        status,
        created_by
    )
    values (
        v_vendor_material_id,
        v_project_id,
        v_cost_code_material,
        v_pr_id,
        date '2026-03-30',
        'approved',
        v_owner_profile_id
    )
    returning id into v_po_id;

    insert into public.purchase_order_lines (
        purchase_order_id,
        item_id,
        quantity,
        rate,
        description
    )
    values (
        v_po_id,
        v_item_cement,
        100,
        420.00,
        'Cement for canal lining package'
    );

    insert into public.grn_headers (
        po_id,
        vendor_id,
        project_id,
        cost_code_id,
        received_date,
        status,
        remarks,
        created_by
    )
    values (
        v_po_id,
        v_vendor_material_id,
        v_project_id,
        v_cost_code_material,
        date '2026-03-30',
        'approved',
        'Received full cement quantity in good condition.',
        v_owner_profile_id
    )
    returning id into v_grn_id;

    insert into public.goods_receipts (
        grn_id,
        po_id,
        vendor_id,
        project_id,
        cost_code_id,
        received_date,
        item_id,
        ordered_qty,
        received_qty,
        accepted_qty,
        store_location,
        status,
        remarks
    )
    values (
        v_grn_id,
        v_po_id,
        v_vendor_material_id,
        v_project_id,
        v_cost_code_material,
        date '2026-03-30',
        v_item_cement,
        100,
        100,
        100,
        'Main Store',
        'approved',
        'Initial inward posting for cement stock.'
    );

    insert into public.material_issues (
        project_id,
        cost_code_id,
        item_id,
        quantity,
        issued_to,
        issue_date,
        remarks,
        status
    )
    values (
        v_project_id,
        v_cost_code_material,
        v_item_cement,
        50,
        'Canal Zone A',
        date '2026-03-31',
        'Issued to site for concrete work.',
        'approved'
    );

    insert into public.daily_progress_reports (
        project_id,
        cost_code_id,
        report_date,
        activity,
        work_description,
        quantity_executed,
        labour_count,
        machinery_used,
        issues,
        remarks,
        created_by,
        status
    )
    values (
        v_project_id,
        v_cost_code_material,
        date '2026-03-31',
        'Concrete work done',
        'Placed concrete lining using 50 bags of cement on Canal Zone A.',
        50,
        12,
        'Excavator',
        null,
        'Concrete work done for the issued material batch.',
        v_owner_profile_id,
        'approved'
    );

    insert into public.expenses (
        project_id,
        cost_code_id,
        expense_type,
        amount,
        expense_date,
        linked_reference,
        reference_module,
        remarks,
        status,
        created_by
    )
    values (
        v_project_id,
        v_cost_code_labour,
        'Labour payment',
        18500.00,
        date '2026-03-31',
        'LAB-2026-0001',
        'Labour',
        'Concrete gang labour payout for canal lining activity.',
        'approved',
        v_owner_profile_id
    );

    insert into public.vendor_contracts (
        vendor_id,
        project_id,
        cost_code_id,
        contract_type,
        rate_type,
        rate,
        machine_name,
        monthly_rate,
        hourly_rate,
        rate_per_litre,
        start_date,
        end_date,
        terms_conditions,
        terms,
        billing_cycle,
        status
    )
    values (
        v_vendor_machinery_id,
        v_project_id,
        v_cost_code_machinery,
        'Machinery',
        'hourly',
        1500.00,
        'Excavator',
        0,
        1500.00,
        null,
        date '2026-03-20',
        date '2026-09-19',
        'Excavator deployed for canal excavation and support work.',
        'Hourly billing against approved site logs.',
        'monthly',
        'approved'
    )
    returning id into v_contract_machine_id;

    insert into public.vendor_contracts (
        vendor_id,
        project_id,
        cost_code_id,
        contract_type,
        rate_type,
        rate,
        machine_name,
        monthly_rate,
        hourly_rate,
        rate_per_litre,
        start_date,
        end_date,
        terms_conditions,
        terms,
        billing_cycle,
        status
    )
    values (
        v_vendor_fuel_id,
        v_project_id,
        v_cost_code_fuel,
        'Fuel',
        'per_litre',
        92.00,
        'Excavator',
        0,
        null,
        92.00,
        date '2026-03-20',
        date '2026-09-19',
        'Diesel supply for machinery deployed on canal works.',
        'Per litre billing against approved fuel logs.',
        'monthly',
        'approved'
    )
    returning id into v_contract_fuel_id;

    insert into public.machinery_daily_logs (
        contract_id,
        machine_name,
        log_date,
        working_hours,
        idle_hours,
        fuel_consumption,
        operator_name,
        status
    )
    values
        (v_contract_machine_id, 'Excavator', date '2026-03-30', 8, 1, 0, 'Ramesh Kumar', 'approved'),
        (v_contract_machine_id, 'Excavator', date '2026-03-31', 8, 0.5, 0, 'Ramesh Kumar', 'approved');

    insert into public.fuel_logs (
        contract_id,
        project_id,
        cost_code_id,
        log_date,
        machine_name,
        litres_consumed,
        rate,
        status
    )
    values (
        v_contract_fuel_id,
        v_project_id,
        v_cost_code_fuel,
        date '2026-03-31',
        'Excavator',
        200,
        92.00,
        'approved'
    );

    insert into public.vendor_invoices (
        vendor_id,
        project_id,
        cost_code_id,
        po_id,
        invoice_amount,
        invoice_date,
        remarks,
        status
    )
    values (
        v_vendor_material_id,
        v_project_id,
        v_cost_code_material,
        v_po_id,
        42000.00,
        date '2026-03-31',
        'Material invoice against approved GRN quantity.',
        'approved'
    )
    returning id into v_invoice_po_id;

    insert into public.payments (
        invoice_id,
        project_id,
        amount_paid,
        payment_date,
        payment_mode,
        remarks,
        status
    )
    values (
        v_invoice_po_id,
        v_project_id,
        42000.00,
        date '2026-04-01',
        'Bank Transfer',
        'Released against matched vendor invoice.',
        'approved'
    );

    insert into public.vendor_invoices (
        vendor_id,
        project_id,
        cost_code_id,
        contract_id,
        invoice_amount,
        invoice_date,
        remarks,
        status
    )
    values (
        v_vendor_machinery_id,
        v_project_id,
        v_cost_code_machinery,
        v_contract_machine_id,
        25000.00,
        date '2026-03-31',
        'Machinery invoice submitted above calculated working-hour value.',
        'approved'
    );

    insert into public.vendor_invoices (
        vendor_id,
        project_id,
        cost_code_id,
        contract_id,
        invoice_amount,
        invoice_date,
        remarks,
        status
    )
    values (
        v_vendor_fuel_id,
        v_project_id,
        v_cost_code_fuel,
        v_contract_fuel_id,
        18000.00,
        date '2026-03-31',
        'Fuel invoice submitted below calculated litre value.',
        'submitted'
    );

    insert into public.ra_bills (
        project_id,
        client_id,
        bill_date,
        work_done_value,
        previous_billing,
        current_billing,
        retention,
        status
    )
    values (
        v_project_id,
        v_client_id,
        date '2026-04-01',
        125000.00,
        0,
        125000.00,
        5000.00,
        'submitted'
    );
end $$;
