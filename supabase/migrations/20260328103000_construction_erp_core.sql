-- ============================================================
-- Construction ERP Core
-- Multi-project construction ERP extension for Supabase
-- ============================================================

create extension if not exists pgcrypto;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'erp_cost_code_category') then
        create type erp_cost_code_category as enum ('material', 'labour', 'machinery', 'fuel', 'subcontract');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_document_status') then
        create type erp_document_status as enum ('draft', 'approved', 'closed');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_delivery_status') then
        create type erp_delivery_status as enum ('draft', 'approved', 'closed');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_contract_type') then
        create type erp_contract_type as enum ('Machinery', 'Fuel', 'Service');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_billing_cycle') then
        create type erp_billing_cycle as enum ('monthly', 'weekly', 'one_time');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_invoice_validation_status') then
        create type erp_invoice_validation_status as enum ('matched', 'mismatch', 'pending');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_payment_mode') then
        create type erp_payment_mode as enum ('Bank Transfer', 'Cheque', 'Cash', 'UPI');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_item_type') then
        create type erp_item_type as enum ('material', 'service');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_ra_bill_status') then
        create type erp_ra_bill_status as enum ('draft', 'submitted', 'certified', 'paid');
    end if;
end $$;

create table if not exists public.erp_number_sequences (
    prefix text not null,
    sequence_year integer not null,
    last_value integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (prefix, sequence_year)
);

create or replace function public.generate_erp_system_id(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_year integer := extract(year from timezone('Asia/Calcutta', now()));
    v_next integer;
begin
    insert into public.erp_number_sequences (prefix, sequence_year, last_value)
    values (upper(p_prefix), v_year, 0)
    on conflict (prefix, sequence_year) do nothing;

    update public.erp_number_sequences
    set last_value = last_value + 1,
        updated_at = now()
    where prefix = upper(p_prefix)
      and sequence_year = v_year
    returning last_value into v_next;

    return upper(p_prefix) || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null unique,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles
    add column if not exists department_id uuid references public.departments(id) on delete set null,
    add column if not exists role_id uuid references public.roles(id) on delete set null;

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles(id) on delete cascade,
    employee_code text unique,
    full_name text not null,
    email text not null,
    phone text,
    role_id uuid references public.roles(id) on delete set null,
    department_id uuid references public.departments(id) on delete set null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    client_code text not null unique,
    name text not null unique,
    contact_person text,
    phone text,
    email text,
    address text,
    gst_no text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.items (
    id uuid primary key default gen_random_uuid(),
    item_code text not null unique,
    name text not null,
    item_type erp_item_type not null default 'material',
    uom text not null,
    standard_rate numeric(14, 2) not null default 0 check (standard_rate >= 0),
    hsn_code text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.cost_codes (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    description text not null,
    category erp_cost_code_category not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.project_cost_code_budgets (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete cascade,
    budget_amount numeric(16, 2) not null default 0 check (budget_amount >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, cost_code_id)
);

alter table public.projects
    add column if not exists client_id uuid references public.clients(id) on delete set null;

create table if not exists public.sales_orders (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('SO'),
    sap_ref_no text,
    project_id uuid not null references public.projects(id) on delete cascade,
    client_id uuid not null references public.clients(id) on delete restrict,
    order_date date not null default current_date,
    order_value numeric(16, 2) not null default 0 check (order_value >= 0),
    status erp_document_status not null default 'draft',
    remarks text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.purchase_requests (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('PR'),
    sap_ref_no text,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    requested_by uuid references public.profiles(id) on delete set null,
    item_id uuid not null references public.items(id) on delete restrict,
    quantity numeric(14, 3) not null check (quantity > 0),
    required_date date not null,
    remarks text,
    status erp_document_status not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('PO'),
    sap_ref_no text,
    vendor_id uuid not null references public.vendors(id) on delete restrict,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    purchase_request_id uuid references public.purchase_requests(id) on delete set null,
    delivery_date date,
    status erp_document_status not null default 'draft',
    total_amount numeric(16, 2) not null default 0 check (total_amount >= 0),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_lines (
    id uuid primary key default gen_random_uuid(),
    purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
    item_id uuid not null references public.items(id) on delete restrict,
    quantity numeric(14, 3) not null check (quantity > 0),
    rate numeric(14, 2) not null check (rate >= 0),
    total_amount numeric(16, 2) generated always as (quantity * rate) stored,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.goods_receipts (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('GRN'),
    sap_ref_no text,
    po_id uuid not null references public.purchase_orders(id) on delete cascade,
    vendor_id uuid not null references public.vendors(id) on delete restrict,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    received_date date not null default current_date,
    item_id uuid not null references public.items(id) on delete restrict,
    ordered_qty numeric(14, 3) not null default 0 check (ordered_qty >= 0),
    received_qty numeric(14, 3) not null check (received_qty >= 0),
    accepted_qty numeric(14, 3) not null check (accepted_qty >= 0),
    rejected_qty numeric(14, 3) generated always as (greatest(received_qty - accepted_qty, 0::numeric)) stored,
    store_location text not null,
    status erp_document_status not null default 'draft',
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint goods_receipts_qty_check check (accepted_qty <= received_qty)
);

create table if not exists public.delivery_challans (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('DC'),
    sap_ref_no text,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    item_id uuid not null references public.items(id) on delete restrict,
    quantity numeric(14, 3) not null check (quantity > 0),
    dispatch_date date not null default current_date,
    transport_details text,
    status erp_delivery_status not null default 'draft',
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.inventory_stocks (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.items(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    inward_qty numeric(14, 3) not null default 0,
    outward_qty numeric(14, 3) not null default 0,
    balance_qty numeric(14, 3) not null default 0,
    average_rate numeric(14, 2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (item_id, project_id)
);

create table if not exists public.material_issues (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('MI'),
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    item_id uuid not null references public.items(id) on delete restrict,
    quantity numeric(14, 3) not null check (quantity > 0),
    issued_to text not null,
    issue_date date not null default current_date,
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.daily_progress_reports (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    report_date date not null default current_date,
    activity text not null,
    work_description text not null,
    quantity_executed numeric(14, 3) not null default 0,
    labour_count integer not null default 0 check (labour_count >= 0),
    machinery_used text,
    issues text,
    photo_url text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vendor_contracts (
    id uuid primary key default gen_random_uuid(),
    contract_id text not null unique default public.generate_erp_system_id('VCT'),
    vendor_id uuid not null references public.vendors(id) on delete restrict,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid references public.cost_codes(id) on delete set null,
    contract_type erp_contract_type not null,
    machine_name text,
    monthly_rate numeric(14, 2) not null default 0 check (monthly_rate >= 0),
    hourly_rate numeric(14, 2) check (hourly_rate >= 0),
    rate_per_litre numeric(14, 2) check (rate_per_litre >= 0),
    start_date date not null,
    end_date date not null,
    terms_conditions text,
    billing_cycle erp_billing_cycle not null default 'monthly',
    status erp_document_status not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint vendor_contracts_date_check check (end_date >= start_date)
);

create table if not exists public.machinery_daily_logs (
    id uuid primary key default gen_random_uuid(),
    contract_id uuid not null references public.vendor_contracts(id) on delete cascade,
    machine_name text not null,
    log_date date not null default current_date,
    working_hours numeric(10, 2) not null default 0 check (working_hours >= 0),
    idle_hours numeric(10, 2) not null default 0 check (idle_hours >= 0),
    fuel_consumption numeric(10, 2) not null default 0 check (fuel_consumption >= 0),
    operator_name text,
    payable_amount numeric(14, 2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.fuel_logs (
    id uuid primary key default gen_random_uuid(),
    contract_id uuid not null references public.vendor_contracts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    log_date date not null default current_date,
    machine_name text not null,
    litres_consumed numeric(10, 2) not null check (litres_consumed >= 0),
    rate numeric(14, 2) not null check (rate >= 0),
    total_cost numeric(16, 2) generated always as (litres_consumed * rate) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    expense_type text not null,
    amount numeric(16, 2) not null check (amount >= 0),
    expense_date date not null default current_date,
    linked_reference text,
    reference_module text,
    remarks text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vendor_invoices (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('INV'),
    sap_ref_no text,
    vendor_id uuid not null references public.vendors(id) on delete restrict,
    project_id uuid not null references public.projects(id) on delete cascade,
    contract_id uuid references public.vendor_contracts(id) on delete set null,
    invoice_amount numeric(16, 2) not null default 0 check (invoice_amount >= 0),
    calculated_amount numeric(16, 2) not null default 0,
    variance numeric(16, 2) not null default 0,
    invoice_date date not null default current_date,
    validation_status erp_invoice_validation_status not null default 'pending',
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_erp_system_id('PAY'),
    sap_ref_no text,
    invoice_id uuid not null references public.vendor_invoices(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    amount_paid numeric(16, 2) not null check (amount_paid >= 0),
    payment_date date not null default current_date,
    payment_mode erp_payment_mode not null,
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ra_bills (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    client_id uuid references public.clients(id) on delete set null,
    bill_no text not null unique default public.generate_erp_system_id('RA'),
    bill_date date not null default current_date,
    work_done_value numeric(16, 2) not null default 0 check (work_done_value >= 0),
    previous_billing numeric(16, 2) not null default 0 check (previous_billing >= 0),
    current_billing numeric(16, 2) not null default 0 check (current_billing >= 0),
    retention numeric(16, 2) not null default 0 check (retention >= 0),
    net_payable numeric(16, 2) generated always as (greatest(current_billing - retention, 0::numeric)) stored,
    status erp_ra_bill_status not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.module_documents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    module_name text not null,
    record_id uuid,
    record_system_id text,
    file_name text not null,
    file_path text not null unique,
    public_url text not null,
    mime_type text,
    file_size bigint,
    uploaded_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    action text not null,
    table_name text not null,
    record_id uuid,
    record_system_id text,
    payload jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.erp_notifications (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade,
    module_name text not null,
    record_id uuid,
    title text not null,
    message text not null,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_users_profile_id on public.users(profile_id);
create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_project_cost_code_budgets_project_id on public.project_cost_code_budgets(project_id);
create index if not exists idx_sales_orders_project_id on public.sales_orders(project_id);
create index if not exists idx_purchase_requests_project_id on public.purchase_requests(project_id);
create index if not exists idx_purchase_orders_project_id on public.purchase_orders(project_id);
create index if not exists idx_purchase_order_lines_po_id on public.purchase_order_lines(purchase_order_id);
create index if not exists idx_goods_receipts_project_id on public.goods_receipts(project_id);
create index if not exists idx_delivery_challans_project_id on public.delivery_challans(project_id);
create index if not exists idx_inventory_stocks_project_id on public.inventory_stocks(project_id);
create index if not exists idx_material_issues_project_id on public.material_issues(project_id);
create index if not exists idx_daily_progress_reports_project_id on public.daily_progress_reports(project_id);
create index if not exists idx_vendor_contracts_project_id on public.vendor_contracts(project_id);
create index if not exists idx_machinery_daily_logs_contract_id on public.machinery_daily_logs(contract_id);
create index if not exists idx_fuel_logs_project_id on public.fuel_logs(project_id);
create index if not exists idx_expenses_project_id on public.expenses(project_id);
create index if not exists idx_vendor_invoices_project_id on public.vendor_invoices(project_id);
create index if not exists idx_payments_project_id on public.payments(project_id);
create index if not exists idx_ra_bills_project_id on public.ra_bills(project_id);
create index if not exists idx_module_documents_project_id on public.module_documents(project_id);

create or replace function public.refresh_purchase_order_total(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.purchase_orders
    set total_amount = coalesce((
        select sum(pol.total_amount)
        from public.purchase_order_lines pol
        where pol.purchase_order_id = p_purchase_order_id
    ), 0),
        updated_at = now()
    where id = p_purchase_order_id;
end;
$$;

create or replace function public.handle_purchase_order_lines_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_purchase_order_id uuid;
begin
    v_purchase_order_id := coalesce(new.purchase_order_id, old.purchase_order_id);
    perform public.refresh_purchase_order_total(v_purchase_order_id);
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_purchase_order_lines_refresh_total on public.purchase_order_lines;
create trigger trg_purchase_order_lines_refresh_total
after insert or update or delete on public.purchase_order_lines
for each row execute function public.handle_purchase_order_lines_change();

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
    left join public.purchase_order_lines pol
        on pol.purchase_order_id = gr.po_id
       and pol.item_id = gr.item_id
    where gr.project_id = p_project_id
      and gr.item_id = p_item_id;

    select coalesce(sum(qty), 0)
    into v_outward
    from (
        select dc.quantity as qty
        from public.delivery_challans dc
        where dc.project_id = p_project_id
          and dc.item_id = p_item_id
        union all
        select mi.quantity as qty
        from public.material_issues mi
        where mi.project_id = p_project_id
          and mi.item_id = p_item_id
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

create or replace function public.handle_inventory_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_item_id uuid;
begin
    v_project_id := coalesce(new.project_id, old.project_id);
    v_item_id := coalesce(new.item_id, old.item_id);

    if v_project_id is not null and v_item_id is not null then
        perform public.refresh_inventory_stock(v_project_id, v_item_id);
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_goods_receipts_inventory_refresh on public.goods_receipts;
create trigger trg_goods_receipts_inventory_refresh
after insert or update or delete on public.goods_receipts
for each row execute function public.handle_inventory_refresh();

drop trigger if exists trg_delivery_challans_inventory_refresh on public.delivery_challans;
create trigger trg_delivery_challans_inventory_refresh
after insert or update or delete on public.delivery_challans
for each row execute function public.handle_inventory_refresh();

drop trigger if exists trg_material_issues_inventory_refresh on public.material_issues;
create trigger trg_material_issues_inventory_refresh
after insert or update or delete on public.material_issues
for each row execute function public.handle_inventory_refresh();

create or replace function public.set_machinery_log_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_hourly_rate numeric(14, 2);
    v_monthly_rate numeric(14, 2);
begin
    select hourly_rate, monthly_rate
    into v_hourly_rate, v_monthly_rate
    from public.vendor_contracts
    where id = new.contract_id;

    new.payable_amount := round(
        case
            when coalesce(v_hourly_rate, 0) > 0 then coalesce(new.working_hours, 0) * v_hourly_rate
            when coalesce(new.working_hours, 0) > 0 then coalesce(v_monthly_rate, 0)
            else 0
        end,
        2
    );
    return new;
end;
$$;

drop trigger if exists trg_machinery_daily_logs_payable on public.machinery_daily_logs;
create trigger trg_machinery_daily_logs_payable
before insert or update on public.machinery_daily_logs
for each row execute function public.set_machinery_log_amount();

create or replace function public.calculate_vendor_invoice_amount(p_contract_id uuid, p_invoice_date date)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
    v_contract_type erp_contract_type;
    v_month_start date := date_trunc('month', p_invoice_date)::date;
    v_month_end date := (date_trunc('month', p_invoice_date) + interval '1 month - 1 day')::date;
    v_monthly_rate numeric(14, 2);
    v_total numeric(16, 2);
begin
    if p_contract_id is null then
        return 0;
    end if;

    select contract_type, monthly_rate
    into v_contract_type, v_monthly_rate
    from public.vendor_contracts
    where id = p_contract_id;

    if v_contract_type = 'Fuel' then
        select coalesce(sum(total_cost), 0)
        into v_total
        from public.fuel_logs
        where contract_id = p_contract_id
          and log_date between v_month_start and v_month_end;
    elsif v_contract_type = 'Machinery' then
        select case
            when exists (
                select 1
                from public.machinery_daily_logs mdl
                where mdl.contract_id = p_contract_id
                  and mdl.log_date between v_month_start and v_month_end
            ) and exists (
                select 1
                from public.vendor_contracts vc
                where vc.id = p_contract_id
                  and coalesce(vc.hourly_rate, 0) = 0
            ) then coalesce(v_monthly_rate, 0)
            else coalesce(sum(payable_amount), 0)
        end
        into v_total
        from public.machinery_daily_logs
        where contract_id = p_contract_id
          and log_date between v_month_start and v_month_end;
    else
        v_total := coalesce(v_monthly_rate, 0);
    end if;

    return coalesce(v_total, 0);
end;
$$;

create or replace function public.set_vendor_invoice_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.calculated_amount := public.calculate_vendor_invoice_amount(new.contract_id, new.invoice_date);
    new.variance := round(coalesce(new.invoice_amount, 0) - coalesce(new.calculated_amount, 0), 2);
    new.validation_status := case
        when new.contract_id is null then 'pending'
        when abs(new.variance) <= 0.01 then 'matched'
        else 'mismatch'
    end;
    return new;
end;
$$;

drop trigger if exists trg_vendor_invoices_validation on public.vendor_invoices;
create trigger trg_vendor_invoices_validation
before insert or update on public.vendor_invoices
for each row execute function public.set_vendor_invoice_validation();

create or replace function public.notify_invoice_mismatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.validation_status = 'mismatch' then
        insert into public.erp_notifications (project_id, module_name, record_id, title, message)
        values (
            new.project_id,
            'Vendor Invoice',
            new.id,
            'Invoice variance detected',
            'Vendor invoice ' || new.system_id || ' differs from calculated log value.'
        );
    end if;
    return new;
end;
$$;

drop trigger if exists trg_vendor_invoices_notify on public.vendor_invoices;
create trigger trg_vendor_invoices_notify
after insert or update on public.vendor_invoices
for each row execute function public.notify_invoice_mismatch();

create or replace function public.record_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_payload jsonb;
    v_record_id uuid;
    v_system_id text;
begin
    if tg_op = 'DELETE' then
        v_payload := to_jsonb(old);
        v_record_id := old.id;
    else
        v_payload := to_jsonb(new);
        v_record_id := new.id;
    end if;

    v_system_id := coalesce(
        v_payload ->> 'system_id',
        v_payload ->> 'contract_id',
        v_payload ->> 'bill_no',
        v_payload ->> 'record_system_id'
    );

    insert into public.activity_logs (user_id, action, table_name, record_id, record_system_id, payload)
    values (
        (select p.id from public.profiles p where p.auth_user_id = auth.uid() limit 1),
        lower(tg_op),
        tg_table_name,
        v_record_id,
        v_system_id,
        v_payload
    );

    return coalesce(new, old);
end;
$$;

do $$
declare
    tbl text;
    log_tables text[] := array[
        'sales_orders',
        'purchase_requests',
        'purchase_orders',
        'goods_receipts',
        'delivery_challans',
        'material_issues',
        'daily_progress_reports',
        'vendor_contracts',
        'machinery_daily_logs',
        'fuel_logs',
        'expenses',
        'vendor_invoices',
        'payments',
        'ra_bills',
        'module_documents'
    ];
begin
    foreach tbl in array log_tables loop
        execute format('drop trigger if exists trg_%I_activity_log on public.%I', tbl, tbl);
        execute format(
            'create trigger trg_%I_activity_log after insert or update or delete on public.%I for each row execute function public.record_activity_log()',
            tbl,
            tbl
        );
    end loop;
end $$;

do $$
declare
    tbl text;
    tracked_tables text[] := array[
        'erp_number_sequences',
        'roles',
        'departments',
        'users',
        'clients',
        'items',
        'cost_codes',
        'project_cost_code_budgets',
        'sales_orders',
        'purchase_requests',
        'purchase_orders',
        'purchase_order_lines',
        'goods_receipts',
        'delivery_challans',
        'inventory_stocks',
        'material_issues',
        'daily_progress_reports',
        'vendor_contracts',
        'machinery_daily_logs',
        'fuel_logs',
        'expenses',
        'vendor_invoices',
        'payments',
        'ra_bills',
        'module_documents'
    ];
begin
    foreach tbl in array tracked_tables loop
        execute format('drop trigger if exists trg_%I_updated_at on public.%I', tbl, tbl);
        execute format(
            'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
            tbl,
            tbl
        );
    end loop;
end $$;

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
        from public.purchase_orders po
        where po.project_id = p.id
          and po.status <> 'closed'
    ), 0) as pending_po_count,
    coalesce((
        select count(*)
        from public.vendor_invoices vi
        left join (
            select invoice_id, sum(amount_paid) as paid_amount
            from public.payments
            group by invoice_id
        ) pay on pay.invoice_id = vi.id
        where vi.project_id = p.id
          and coalesce(pay.paid_amount, 0) < vi.invoice_amount
    ), 0) as pending_payment_count,
    coalesce((
        select count(*)
        from public.daily_progress_reports dpr
        where dpr.project_id = p.id
    ), 0) as dpr_entries,
    coalesce((
        select count(*)
        from public.vendor_invoices vi
        where vi.project_id = p.id
          and vi.validation_status = 'mismatch'
    ), 0) as open_invoice_variance_count
from public.projects p
where p.deleted_at is null;

insert into storage.buckets (id, name, public)
values ('erp-documents', 'erp-documents', true)
on conflict (id) do nothing;

insert into public.roles (code, name, description)
values
    ('admin', 'Administrator', 'Full ERP access'),
    ('member', 'Member', 'Operational ERP access'),
    ('viewer', 'Viewer', 'Read-only ERP access')
on conflict (code) do nothing;

insert into public.departments (code, name, description)
values
    ('COMM', 'Commercial', 'Sales, billing, and client coordination'),
    ('PROC', 'Procurement', 'Purchasing, vendor coordination, and stores'),
    ('EXEC', 'Execution', 'Site execution and daily progress tracking'),
    ('FIN', 'Finance', 'Invoices, payments, and cost control')
on conflict (code) do nothing;

insert into public.users (profile_id, employee_code, full_name, email, role_id, department_id, is_active)
select
    p.id,
    'EMP-' || upper(substr(replace(p.id::text, '-', ''), 1, 6)),
    coalesce(p.full_name, p.email, 'User'),
    p.email,
    r.id,
    d.id,
    p.is_active
from public.profiles p
left join public.roles r on r.code = p.role::text
left join public.departments d on d.code = 'EXEC'
on conflict (profile_id) do update
set full_name = excluded.full_name,
    email = excluded.email,
    role_id = coalesce(public.users.role_id, excluded.role_id),
    department_id = coalesce(public.users.department_id, excluded.department_id),
    is_active = excluded.is_active,
    updated_at = now();

update public.profiles p
set role_id = r.id
from public.roles r
where p.role_id is null
  and r.code = p.role::text;

update public.profiles
set department_id = (
    select d.id
    from public.departments d
    where d.code = 'EXEC'
)
where department_id is null;

insert into public.clients (client_code, name, contact_person, phone, email, address, gst_no)
select
    'CLI-' || lpad(row_number() over (order by c.client_name)::text, 4, '0'),
    c.client_name,
    c.contact_person,
    c.phone,
    c.email,
    c.address,
    c.gst_no
from public.customers c
on conflict (name) do nothing;

insert into public.items (item_code, name, item_type, uom, standard_rate)
select
    m.code,
    m.description,
    'material'::erp_item_type,
    m.uom,
    coalesce(m.standard_cost, 0)
from public.materials m
on conflict (item_code) do nothing;

alter table public.roles enable row level security;
alter table public.departments enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.items enable row level security;
alter table public.cost_codes enable row level security;
alter table public.project_cost_code_budgets enable row level security;
alter table public.sales_orders enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.delivery_challans enable row level security;
alter table public.inventory_stocks enable row level security;
alter table public.material_issues enable row level security;
alter table public.daily_progress_reports enable row level security;
alter table public.vendor_contracts enable row level security;
alter table public.machinery_daily_logs enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.expenses enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.payments enable row level security;
alter table public.ra_bills enable row level security;
alter table public.module_documents enable row level security;
alter table public.activity_logs enable row level security;
alter table public.erp_notifications enable row level security;

drop policy if exists "erp_roles_select" on public.roles;
create policy "erp_roles_select" on public.roles for select using (auth.uid() is not null);
drop policy if exists "erp_roles_write" on public.roles;
create policy "erp_roles_write" on public.roles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_departments_select" on public.departments;
create policy "erp_departments_select" on public.departments for select using (auth.uid() is not null);
drop policy if exists "erp_departments_write" on public.departments;
create policy "erp_departments_write" on public.departments for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_users_select" on public.users;
create policy "erp_users_select" on public.users for select using (auth.uid() is not null);
drop policy if exists "erp_users_write" on public.users;
create policy "erp_users_write" on public.users for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_clients_select" on public.clients;
create policy "erp_clients_select" on public.clients for select using (auth.uid() is not null);
drop policy if exists "erp_clients_write" on public.clients;
create policy "erp_clients_write" on public.clients for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_items_select" on public.items;
create policy "erp_items_select" on public.items for select using (auth.uid() is not null);
drop policy if exists "erp_items_write" on public.items;
create policy "erp_items_write" on public.items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_cost_codes_select" on public.cost_codes;
create policy "erp_cost_codes_select" on public.cost_codes for select using (auth.uid() is not null);
drop policy if exists "erp_cost_codes_write" on public.cost_codes;
create policy "erp_cost_codes_write" on public.cost_codes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_project_budgets_select" on public.project_cost_code_budgets;
create policy "erp_project_budgets_select" on public.project_cost_code_budgets
for select using (public.is_project_member(project_id));
drop policy if exists "erp_project_budgets_write" on public.project_cost_code_budgets;
create policy "erp_project_budgets_write" on public.project_cost_code_budgets
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

do $$
declare
    tbl text;
    tables_with_project text[] := array[
        'sales_orders',
        'purchase_requests',
        'purchase_orders',
        'goods_receipts',
        'delivery_challans',
        'inventory_stocks',
        'material_issues',
        'daily_progress_reports',
        'vendor_contracts',
        'fuel_logs',
        'expenses',
        'vendor_invoices',
        'payments',
        'ra_bills',
        'module_documents',
        'erp_notifications'
    ];
begin
    foreach tbl in array tables_with_project loop
        execute format('drop policy if exists %I on public.%I', 'erp_' || tbl || '_select', tbl);
        execute format(
            'create policy %I on public.%I for select using (public.is_project_member(project_id))',
            'erp_' || tbl || '_select',
            tbl
        );
        execute format('drop policy if exists %I on public.%I', 'erp_' || tbl || '_write', tbl);
        execute format(
            'create policy %I on public.%I for all using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id))',
            'erp_' || tbl || '_write',
            tbl
        );
    end loop;
end $$;

drop policy if exists "erp_purchase_order_lines_select" on public.purchase_order_lines;
create policy "erp_purchase_order_lines_select" on public.purchase_order_lines
for select using (
    exists (
        select 1
        from public.purchase_orders po
        where po.id = purchase_order_id
          and public.is_project_member(po.project_id)
    )
);

drop policy if exists "erp_purchase_order_lines_write" on public.purchase_order_lines;
create policy "erp_purchase_order_lines_write" on public.purchase_order_lines
for all using (
    exists (
        select 1
        from public.purchase_orders po
        where po.id = purchase_order_id
          and public.is_project_admin(po.project_id)
    )
)
with check (
    exists (
        select 1
        from public.purchase_orders po
        where po.id = purchase_order_id
          and public.is_project_admin(po.project_id)
    )
);

drop policy if exists "erp_machinery_logs_select" on public.machinery_daily_logs;
create policy "erp_machinery_logs_select" on public.machinery_daily_logs
for select using (
    exists (
        select 1
        from public.vendor_contracts vc
        where vc.id = public.machinery_daily_logs.contract_id
          and public.is_project_member(vc.project_id)
    )
);

drop policy if exists "erp_machinery_logs_write" on public.machinery_daily_logs;
create policy "erp_machinery_logs_write" on public.machinery_daily_logs
for all using (
    exists (
        select 1
        from public.vendor_contracts vc
        where vc.id = public.machinery_daily_logs.contract_id
          and public.is_project_admin(vc.project_id)
    )
)
with check (
    exists (
        select 1
        from public.vendor_contracts vc
        where vc.id = public.machinery_daily_logs.contract_id
          and public.is_project_admin(vc.project_id)
    )
);

drop policy if exists "erp_activity_logs_select" on public.activity_logs;
create policy "erp_activity_logs_select" on public.activity_logs for select using (auth.uid() is not null);
drop policy if exists "erp_activity_logs_write" on public.activity_logs;
create policy "erp_activity_logs_write" on public.activity_logs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "erp_storage_select" on storage.objects;
create policy "erp_storage_select" on storage.objects
for select using (bucket_id = 'erp-documents' and auth.uid() is not null);

drop policy if exists "erp_storage_write" on storage.objects;
create policy "erp_storage_write" on storage.objects
for all using (bucket_id = 'erp-documents' and public.is_admin())
with check (bucket_id = 'erp-documents' and public.is_admin());
