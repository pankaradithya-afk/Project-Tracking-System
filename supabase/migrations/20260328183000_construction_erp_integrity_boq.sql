-- ============================================================
-- Construction ERP Integrity + BOQ Lumpsum Support
-- Cleans partial records, enforces critical links, introduces
-- SAP-style BOQ breakup tables, and reseeds one complete demo.
-- ============================================================

create extension if not exists pgcrypto;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'erp_document_status') then
        create type erp_document_status as enum ('draft', 'submitted', 'approved', 'rejected', 'closed');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_payment_mode') then
        create type erp_payment_mode as enum ('Bank Transfer', 'Cheque', 'Cash', 'UPI');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_billing_cycle') then
        create type erp_billing_cycle as enum ('monthly', 'weekly', 'one_time');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_contract_type') then
        create type erp_contract_type as enum ('Machinery', 'Fuel', 'Service');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_contract_rate_type') then
        create type erp_contract_rate_type as enum ('monthly', 'hourly', 'per_unit');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_invoice_validation_status') then
        create type erp_invoice_validation_status as enum ('matched', 'mismatch', 'pending');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_ra_bill_status') then
        create type erp_ra_bill_status as enum ('draft', 'submitted', 'certified', 'paid');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_boq_item_type') then
        create type erp_boq_item_type as enum ('regular', 'lumpsum');
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

create or replace function public.generate_doc_no(p_prefix text)
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

    return upper(p_prefix) || '-' || v_year::text || '-' || lpad(v_next::text, 5, '0');
end;
$$;

alter type erp_contract_rate_type add value if not exists 'per_litre';
alter type erp_invoice_validation_status add value if not exists 'overbilling';
alter type erp_invoice_validation_status add value if not exists 'underbilling';

create table if not exists public.grn_headers (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_doc_no('GRN'),
    sap_ref_no text,
    po_id uuid not null references public.purchase_orders(id) on delete cascade,
    vendor_id uuid not null references public.vendors(id) on delete restrict,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    received_date date not null default current_date,
    status erp_document_status not null default 'draft',
    remarks text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.goods_receipts
    add column if not exists grn_id uuid references public.grn_headers(id) on delete cascade;

-- Bootstrap phase-2 columns when this migration runs on a partially upgraded schema.
alter table public.material_issues
    add column if not exists sap_ref_no text,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.daily_progress_reports
    add column if not exists system_id text default public.generate_doc_no('DPR'),
    add column if not exists sap_ref_no text,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists remarks text,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.vendor_contracts
    add column if not exists system_id text default public.generate_doc_no('VCT'),
    add column if not exists sap_ref_no text,
    add column if not exists rate_type erp_contract_rate_type,
    add column if not exists rate numeric(14, 2),
    add column if not exists terms text;

alter table public.machinery_daily_logs
    add column if not exists system_id text default public.generate_doc_no('MLOG'),
    add column if not exists sap_ref_no text,
    add column if not exists project_id uuid references public.projects(id) on delete cascade,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.fuel_logs
    add column if not exists system_id text default public.generate_doc_no('FLOG'),
    add column if not exists sap_ref_no text,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.expenses
    add column if not exists system_id text default public.generate_doc_no('EXP'),
    add column if not exists sap_ref_no text,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.vendor_invoices
    add column if not exists po_id uuid references public.purchase_orders(id) on delete set null,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.payments
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.ra_bills
    add column if not exists system_id text default public.generate_doc_no('RA'),
    add column if not exists sap_ref_no text;

alter table public.module_documents
    add column if not exists system_id text default public.generate_doc_no('DOC'),
    add column if not exists sap_ref_no text,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.projects
    add column if not exists project_value numeric(16, 2) not null default 0;

alter table public.boq_contract
    add column if not exists updated_at timestamptz not null default now();

alter table public.boq_sap_breakup
    add column if not exists updated_at timestamptz not null default now();

alter table public.clients
    add column if not exists gst text,
    add column if not exists contact_details jsonb;

alter table public.vendors
    add column if not exists gst text,
    add column if not exists contact_details jsonb;

alter table public.items
    add column if not exists unit text,
    add column if not exists category text;

alter table public.cost_codes
    add column if not exists name text;

update public.clients
set gst = coalesce(gst, gst_no)
where gst is null;

update public.vendors
set gst = coalesce(gst, gst_no)
where gst is null;

update public.clients
set contact_details = jsonb_build_object(
    'contact_person', contact_person,
    'phone', phone,
    'email', email,
    'address', address
)
where contact_details is null;

update public.vendors
set contact_details = jsonb_build_object(
    'contact_person', contact_person,
    'phone', phone,
    'email', email,
    'address', address,
    'payment_terms', payment_terms
)
where contact_details is null;

update public.items
set unit = coalesce(unit, uom)
where unit is null;

update public.items
set category = coalesce(category, initcap(item_type::text))
where category is null;

update public.cost_codes
set name = coalesce(name, description, code)
where name is null;

update public.vendor_contracts
set rate_type = case
    when coalesce(hourly_rate, 0) > 0 then 'hourly'::erp_contract_rate_type
    when coalesce(rate_per_litre, 0) > 0 then 'per_litre'::erp_contract_rate_type
    else 'monthly'::erp_contract_rate_type
end
where rate_type is null;

update public.vendor_contracts
set rate = case
    when rate_type = 'hourly' then coalesce(hourly_rate, monthly_rate, 0)
    when rate_type = 'per_litre' then coalesce(rate_per_litre, monthly_rate, 0)
    else coalesce(monthly_rate, 0)
end
where rate is null;

update public.vendor_contracts
set terms = coalesce(terms, terms_conditions)
where terms is null;

update public.daily_progress_reports
set remarks = coalesce(remarks, issues)
where remarks is null;

update public.daily_progress_reports
set system_id = public.generate_doc_no('DPR')
where system_id is null or btrim(system_id) = '';

update public.machinery_daily_logs
set system_id = public.generate_doc_no('MLOG')
where system_id is null or btrim(system_id) = '';

update public.machinery_daily_logs mdl
set project_id = vc.project_id,
    cost_code_id = vc.cost_code_id
from public.vendor_contracts vc
where vc.id = mdl.contract_id
  and (mdl.project_id is null or mdl.cost_code_id is null);

update public.fuel_logs
set system_id = public.generate_doc_no('FLOG')
where system_id is null or btrim(system_id) = '';

update public.fuel_logs fl
set project_id = vc.project_id,
    cost_code_id = vc.cost_code_id
from public.vendor_contracts vc
where vc.id = fl.contract_id
  and (fl.project_id is null or fl.cost_code_id is null);

update public.expenses
set system_id = public.generate_doc_no('EXP')
where system_id is null or btrim(system_id) = '';

update public.vendor_invoices vi
set project_id = po.project_id,
    cost_code_id = po.cost_code_id
from public.purchase_orders po
where vi.po_id = po.id
  and (vi.project_id is null or vi.cost_code_id is null);

update public.vendor_invoices vi
set project_id = vc.project_id,
    cost_code_id = vc.cost_code_id
from public.vendor_contracts vc
where vi.contract_id = vc.id
  and (vi.project_id is null or vi.cost_code_id is null);

update public.payments pay
set project_id = vi.project_id,
    cost_code_id = vi.cost_code_id
from public.vendor_invoices vi
where vi.id = pay.invoice_id
  and (pay.project_id is null or pay.cost_code_id is null);

-- ------------------------------------------------------------
-- Step 1: Remove incomplete and unlinked ERP records
-- ------------------------------------------------------------

delete from public.payments
where invoice_id is null
   or project_id is null
   or amount_paid is null
   or payment_date is null
   or payment_mode is null
   or cost_code_id is null;

delete from public.vendor_invoices
where vendor_id is null
   or project_id is null
   or invoice_amount is null
   or invoice_date is null
   or cost_code_id is null
   or (po_id is null and contract_id is null);

delete from public.fuel_logs
where contract_id is null
   or project_id is null
   or cost_code_id is null
   or log_date is null
   or machine_name is null
   or btrim(machine_name) = ''
   or litres_consumed is null
   or rate is null;

delete from public.machinery_daily_logs
where contract_id is null
   or project_id is null
   or cost_code_id is null
   or log_date is null
   or machine_name is null
   or btrim(machine_name) = ''
   or working_hours is null
   or idle_hours is null
   or fuel_consumption is null;

delete from public.vendor_contracts
where vendor_id is null
   or project_id is null
   or cost_code_id is null
   or contract_type is null
   or rate_type is null
   or rate is null
   or start_date is null
   or end_date is null;

delete from public.daily_progress_reports
where project_id is null
   or cost_code_id is null
   or report_date is null
   or activity is null
   or btrim(activity) = ''
   or work_description is null
   or btrim(work_description) = ''
   or quantity_executed is null
   or labour_count is null;

delete from public.material_issues
where project_id is null
   or cost_code_id is null
   or item_id is null
   or quantity is null
   or issue_date is null
   or issued_to is null
   or btrim(issued_to) = '';

delete from public.goods_receipts
where grn_id is null
   or po_id is null
   or vendor_id is null
   or project_id is null
   or cost_code_id is null
   or item_id is null
   or received_date is null
   or ordered_qty is null
   or received_qty is null
   or accepted_qty is null
   or store_location is null
   or btrim(store_location) = '';

delete from public.grn_headers
where po_id is null
   or vendor_id is null
   or project_id is null
   or cost_code_id is null
   or received_date is null;

delete from public.purchase_order_lines
where purchase_order_id is null
   or item_id is null
   or quantity is null
   or rate is null;

delete from public.purchase_orders
where vendor_id is null
   or project_id is null
   or cost_code_id is null
   or purchase_request_id is null;

delete from public.purchase_requests
where project_id is null
   or cost_code_id is null
   or item_id is null
   or quantity is null
   or required_date is null;

delete from public.purchase_orders po
where not exists (
    select 1
    from public.purchase_requests pr
    where pr.id = po.purchase_request_id
);

delete from public.grn_headers gh
where not exists (
    select 1
    from public.purchase_orders po
    where po.id = gh.po_id
);

delete from public.vendor_invoices vi
where (vi.po_id is not null and not exists (select 1 from public.purchase_orders po where po.id = vi.po_id))
   or (vi.contract_id is not null and not exists (select 1 from public.vendor_contracts vc where vc.id = vi.contract_id));

delete from public.payments pay
where not exists (
    select 1
    from public.vendor_invoices vi
    where vi.id = pay.invoice_id
);

-- ------------------------------------------------------------
-- Step 2: Backfill reference ids and enforce critical integrity
-- ------------------------------------------------------------

create or replace function public.ensure_document_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prefix text;
begin
    case tg_table_name
        when 'sales_orders' then v_prefix := 'SO';
        when 'purchase_requests' then v_prefix := 'PR';
        when 'purchase_orders' then v_prefix := 'PO';
        when 'grn_headers' then v_prefix := 'GRN';
        when 'material_issues' then v_prefix := 'MI';
        when 'daily_progress_reports' then v_prefix := 'DPR';
        when 'expenses' then v_prefix := 'EXP';
        when 'vendor_invoices' then v_prefix := 'INV';
        when 'payments' then v_prefix := 'PAY';
        when 'machinery_daily_logs' then v_prefix := 'MLOG';
        when 'fuel_logs' then v_prefix := 'FLOG';
        when 'module_documents' then v_prefix := 'DOC';
        when 'boq_items' then v_prefix := 'BOQ';
        when 'boq_lumpsum_breakups' then v_prefix := 'BQB';
        else v_prefix := null;
    end case;

    if tg_table_name = 'vendor_contracts' then
        new.system_id := coalesce(nullif(btrim(new.system_id), ''), nullif(btrim(new.contract_id), ''), public.generate_doc_no('VCT'));
        new.contract_id := coalesce(nullif(btrim(new.contract_id), ''), new.system_id);
        new.sap_ref_no := coalesce(nullif(btrim(new.sap_ref_no), ''), new.system_id);
        return new;
    end if;

    if tg_table_name = 'ra_bills' then
        new.system_id := coalesce(nullif(btrim(new.system_id), ''), nullif(btrim(new.bill_no), ''), public.generate_doc_no('RA'));
        new.bill_no := coalesce(nullif(btrim(new.bill_no), ''), new.system_id);
        new.sap_ref_no := coalesce(nullif(btrim(new.sap_ref_no), ''), new.system_id);
        return new;
    end if;

    if tg_table_name = 'module_documents' then
        new.system_id := coalesce(nullif(btrim(new.system_id), ''), public.generate_doc_no('DOC'));
        new.sap_ref_no := coalesce(nullif(btrim(new.sap_ref_no), ''), new.system_id);
        return new;
    end if;

    if v_prefix is not null then
        new.system_id := coalesce(nullif(btrim(new.system_id), ''), public.generate_doc_no(v_prefix));
    end if;

    new.sap_ref_no := coalesce(nullif(btrim(new.sap_ref_no), ''), new.system_id);

    return new;
end;
$$;

update public.sales_orders
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.purchase_requests
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.purchase_orders
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.grn_headers
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.material_issues
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.daily_progress_reports
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.expenses
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.vendor_contracts
set system_id = coalesce(nullif(btrim(system_id), ''), nullif(btrim(contract_id), ''), public.generate_doc_no('VCT'))
where system_id is null or btrim(system_id) = '';

update public.vendor_contracts
set contract_id = coalesce(nullif(btrim(contract_id), ''), system_id)
where contract_id is null or btrim(contract_id) = '';

update public.vendor_contracts
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id, contract_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.machinery_daily_logs
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.fuel_logs
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.vendor_invoices
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.payments
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.ra_bills
set system_id = coalesce(nullif(btrim(system_id), ''), nullif(btrim(bill_no), ''), public.generate_doc_no('RA'))
where system_id is null or btrim(system_id) = '';

update public.ra_bills
set sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id, bill_no)
where sap_ref_no is null or btrim(sap_ref_no) = '';

update public.module_documents
set system_id = coalesce(nullif(btrim(system_id), ''), public.generate_doc_no('DOC')),
    sap_ref_no = coalesce(nullif(btrim(sap_ref_no), ''), system_id)
where system_id is null
   or btrim(system_id) = ''
   or sap_ref_no is null
   or btrim(sap_ref_no) = '';

alter table public.purchase_orders
    alter column purchase_request_id set not null;

alter table public.purchase_requests
    alter column sap_ref_no set not null;

alter table public.purchase_orders
    alter column sap_ref_no set not null;

alter table public.grn_headers
    alter column sap_ref_no set not null;

alter table public.material_issues
    alter column sap_ref_no set not null;

alter table public.daily_progress_reports
    alter column sap_ref_no set not null;

alter table public.vendor_contracts
    alter column system_id set not null,
    alter column sap_ref_no set not null;

alter table public.machinery_daily_logs
    alter column sap_ref_no set not null;

alter table public.fuel_logs
    alter column sap_ref_no set not null;

alter table public.expenses
    alter column sap_ref_no set not null;

alter table public.vendor_invoices
    alter column sap_ref_no set not null;

alter table public.payments
    alter column sap_ref_no set not null;

alter table public.ra_bills
    alter column system_id set not null,
    alter column sap_ref_no set not null;

alter table public.module_documents
    alter column system_id set not null,
    alter column sap_ref_no set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'vendor_invoices_link_check'
    ) then
        alter table public.vendor_invoices
            add constraint vendor_invoices_link_check
            check (
                (case when po_id is not null then 1 else 0 end)
              + (case when contract_id is not null then 1 else 0 end) = 1
            );
    end if;
end $$;

do $$
declare
    tbl text;
    ref_tables text[] := array[
        'sales_orders',
        'purchase_requests',
        'purchase_orders',
        'grn_headers',
        'material_issues',
        'daily_progress_reports',
        'expenses',
        'vendor_contracts',
        'machinery_daily_logs',
        'fuel_logs',
        'vendor_invoices',
        'payments',
        'ra_bills',
        'module_documents'
    ];
begin
    foreach tbl in array ref_tables loop
        execute format('drop trigger if exists trg_%I_ensure_refs on public.%I', tbl, tbl);
        execute format(
            'create trigger trg_%I_ensure_refs before insert or update on public.%I for each row execute function public.ensure_document_references()',
            tbl,
            tbl
        );
    end loop;
end $$;

-- ------------------------------------------------------------
-- Step 3: BOQ items with mandatory lumpsum breakup
-- ------------------------------------------------------------

create table if not exists public.boq_items (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_doc_no('BOQ'),
    sap_ref_no text not null,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    item_id uuid not null references public.items(id) on delete restrict,
    boq_ref text not null,
    boq_section text not null,
    line_no integer not null check (line_no > 0),
    category text not null check (category in ('Material', 'Installation', 'Earthwork', 'Equipment')),
    item_type erp_boq_item_type not null,
    description text not null,
    quantity numeric(14, 3) not null check (quantity > 0),
    uom text not null,
    rate numeric(16, 2) not null check (rate > 0),
    amount numeric(16, 2) generated always as (round(quantity * rate, 2)) stored,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, boq_ref),
    unique (project_id, line_no),
    unique (project_id, sap_ref_no),
    constraint boq_items_ref_check check (btrim(boq_ref) <> ''),
    constraint boq_items_section_check check (btrim(boq_section) <> ''),
    constraint boq_items_desc_check check (btrim(description) <> ''),
    constraint boq_items_uom_check check (btrim(uom) <> '')
);

create table if not exists public.boq_lumpsum_breakups (
    id uuid primary key default gen_random_uuid(),
    system_id text not null unique default public.generate_doc_no('BQB'),
    boq_item_id uuid not null references public.boq_items(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    cost_code_id uuid not null references public.cost_codes(id) on delete restrict,
    material_item_id uuid not null references public.items(id) on delete restrict,
    line_no integer not null check (line_no > 0),
    sap_ref_no text not null,
    description text not null,
    quantity numeric(14, 3) not null check (quantity > 0),
    uom text not null,
    rate numeric(16, 2) not null check (rate > 0),
    amount numeric(16, 2) generated always as (round(quantity * rate, 2)) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (boq_item_id, line_no),
    unique (project_id, sap_ref_no),
    constraint boq_breakups_desc_check check (btrim(description) <> ''),
    constraint boq_breakups_uom_check check (btrim(uom) <> '')
);

alter table public.daily_progress_reports
    add column if not exists boq_item_id uuid references public.boq_items(id) on delete set null,
    add column if not exists material_issue_id uuid references public.material_issues(id) on delete set null;

create or replace function public.apply_boq_breakup_dimensions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_cost_code_id uuid;
begin
    select project_id, cost_code_id
    into v_project_id, v_cost_code_id
    from public.boq_items
    where id = new.boq_item_id;

    new.project_id := v_project_id;
    new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    new.system_id := coalesce(nullif(btrim(new.system_id), ''), public.generate_doc_no('BQB'));
    new.sap_ref_no := coalesce(nullif(btrim(new.sap_ref_no), ''), new.system_id);

    return new;
end;
$$;

drop trigger if exists trg_boq_breakups_dimensions on public.boq_lumpsum_breakups;
create trigger trg_boq_breakups_dimensions
before insert or update on public.boq_lumpsum_breakups
for each row execute function public.apply_boq_breakup_dimensions();

create or replace function public.assert_boq_lumpsum_integrity(p_boq_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item_type erp_boq_item_type;
    v_item_amount numeric(16, 2);
    v_breakup_count integer;
    v_breakup_total numeric(16, 2);
begin
    select item_type, amount
    into v_item_type, v_item_amount
    from public.boq_items
    where id = p_boq_item_id;

    if not found then
        return;
    end if;

    select count(*), coalesce(sum(amount), 0)
    into v_breakup_count, v_breakup_total
    from public.boq_lumpsum_breakups
    where boq_item_id = p_boq_item_id;

    if v_item_type = 'lumpsum' then
        if v_breakup_count = 0 then
            raise exception 'Lumpsum BOQ item % must contain at least one breakup line.', p_boq_item_id;
        end if;

        if abs(coalesce(v_item_amount, 0) - coalesce(v_breakup_total, 0)) > 0.01 then
            raise exception 'Lumpsum BOQ item % amount % must match breakup total %.', p_boq_item_id, v_item_amount, v_breakup_total;
        end if;
    elsif v_breakup_count > 0 then
        raise exception 'Regular BOQ item % cannot contain breakup lines.', p_boq_item_id;
    end if;
end;
$$;

create or replace function public.validate_boq_lumpsum_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_boq_item_id uuid;
begin
    if tg_table_name = 'boq_items' then
        v_boq_item_id := coalesce(new.id, old.id);
    else
        v_boq_item_id := coalesce(new.boq_item_id, old.boq_item_id);
    end if;

    perform public.assert_boq_lumpsum_integrity(v_boq_item_id);
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_boq_items_integrity on public.boq_items;
create constraint trigger trg_boq_items_integrity
after insert or update on public.boq_items
deferrable initially deferred
for each row execute function public.validate_boq_lumpsum_integrity();

drop trigger if exists trg_boq_breakups_integrity on public.boq_lumpsum_breakups;
create constraint trigger trg_boq_breakups_integrity
after insert or update or delete on public.boq_lumpsum_breakups
deferrable initially deferred
for each row execute function public.validate_boq_lumpsum_integrity();

create or replace function public.sync_legacy_boq_snapshot(p_boq_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item public.boq_items%rowtype;
begin
    select *
    into v_item
    from public.boq_items
    where id = p_boq_item_id;

    if not found then
        return;
    end if;

    insert into public.boq_contract (
        project_id,
        boq_ref,
        boq_section,
        description,
        category,
        uom,
        contract_qty,
        contract_rate,
        is_locked,
        remarks
    )
    values (
        v_item.project_id,
        v_item.boq_ref,
        v_item.boq_section,
        v_item.description,
        v_item.category,
        v_item.uom,
        v_item.quantity,
        v_item.rate,
        true,
        'Synced from boq_items'
    )
    on conflict (project_id, boq_ref) do update
    set boq_section = excluded.boq_section,
        description = excluded.description,
        category = excluded.category,
        uom = excluded.uom,
        contract_qty = excluded.contract_qty,
        contract_rate = excluded.contract_rate,
        is_locked = true,
        remarks = excluded.remarks,
        updated_at = now();

    delete from public.boq_sap_breakup
    where project_id = v_item.project_id
      and parent_boq_ref = v_item.boq_ref;

    if v_item.item_type = 'regular' then
        insert into public.boq_sap_breakup (
            project_id,
            parent_boq_ref,
            sap_boq_ref,
            material_code,
            description,
            uom,
            required_qty,
            rate,
            remarks
        )
        select
            v_item.project_id,
            v_item.boq_ref,
            v_item.sap_ref_no,
            it.item_code,
            v_item.description,
            v_item.uom,
            v_item.quantity,
            v_item.rate,
            'Synced from boq_items'
        from public.items it
        where it.id = v_item.item_id;
    else
        insert into public.boq_sap_breakup (
            project_id,
            parent_boq_ref,
            sap_boq_ref,
            material_code,
            description,
            uom,
            required_qty,
            rate,
            remarks
        )
        select
            v_item.project_id,
            v_item.boq_ref,
            blb.sap_ref_no,
            it.item_code,
            blb.description,
            blb.uom,
            blb.quantity,
            blb.rate,
            'Synced from boq_lumpsum_breakups'
        from public.boq_lumpsum_breakups blb
        join public.items it on it.id = blb.material_item_id
        where blb.boq_item_id = v_item.id
        order by blb.line_no;
    end if;
end;
$$;

create or replace function public.handle_boq_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_boq_item_id uuid;
    v_project_id uuid;
    v_boq_ref text;
begin
    if tg_table_name = 'boq_items' then
        v_boq_item_id := coalesce(new.id, old.id);
    else
        v_boq_item_id := coalesce(new.boq_item_id, old.boq_item_id);
    end if;

    if tg_table_name = 'boq_items' and tg_op = 'DELETE' then
        delete from public.boq_contract
        where project_id = old.project_id
          and boq_ref = old.boq_ref;

        delete from public.boq_sap_breakup
        where project_id = old.project_id
          and parent_boq_ref = old.boq_ref;

        return old;
    end if;

    if tg_table_name = 'boq_lumpsum_breakups' and tg_op = 'DELETE' then
        select project_id, boq_ref
        into v_project_id, v_boq_ref
        from public.boq_items
        where id = old.boq_item_id;

        if v_project_id is not null then
            delete from public.boq_sap_breakup
            where project_id = v_project_id
              and parent_boq_ref = v_boq_ref;
        end if;
    end if;

    perform public.sync_legacy_boq_snapshot(v_boq_item_id);
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_boq_items_sync on public.boq_items;
create trigger trg_boq_items_sync
after insert or update or delete on public.boq_items
for each row execute function public.handle_boq_sync();

drop trigger if exists trg_boq_breakups_sync on public.boq_lumpsum_breakups;
create trigger trg_boq_breakups_sync
after insert or update or delete on public.boq_lumpsum_breakups
for each row execute function public.handle_boq_sync();

create or replace function public.create_boq_item_with_breakups(
    p_project_id uuid,
    p_cost_code_id uuid,
    p_item_id uuid,
    p_boq_ref text,
    p_boq_section text,
    p_category text,
    p_item_type erp_boq_item_type,
    p_description text,
    p_quantity numeric,
    p_uom text,
    p_rate numeric,
    p_breakups jsonb default '[]'::jsonb,
    p_sap_ref_no text default null,
    p_created_by uuid default null
)
returns public.boq_items
language plpgsql
security definer
set search_path = public
as $$
declare
    v_line_no integer;
    v_boq_item public.boq_items%rowtype;
    v_breakup jsonb;
    v_breakup_line integer := 0;
begin
    if not public.is_project_admin(p_project_id) then
        raise exception 'Only project admins can create BOQ items.';
    end if;

    select coalesce(max(line_no), 0) + 1
    into v_line_no
    from public.boq_items
    where project_id = p_project_id;

    insert into public.boq_items (
        sap_ref_no,
        project_id,
        cost_code_id,
        item_id,
        boq_ref,
        boq_section,
        line_no,
        category,
        item_type,
        description,
        quantity,
        uom,
        rate,
        created_by
    )
    values (
        coalesce(nullif(btrim(p_sap_ref_no), ''), public.generate_doc_no('BOQ')),
        p_project_id,
        p_cost_code_id,
        p_item_id,
        p_boq_ref,
        p_boq_section,
        v_line_no,
        p_category,
        p_item_type,
        p_description,
        p_quantity,
        p_uom,
        p_rate,
        p_created_by
    )
    returning * into v_boq_item;

    if p_item_type = 'lumpsum' then
        if jsonb_typeof(coalesce(p_breakups, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_breakups, '[]'::jsonb)) = 0 then
            raise exception 'Lumpsum BOQ items require breakup rows.';
        end if;

        for v_breakup in
            select value
            from jsonb_array_elements(p_breakups)
        loop
            v_breakup_line := v_breakup_line + 1;

            insert into public.boq_lumpsum_breakups (
                boq_item_id,
                project_id,
                cost_code_id,
                material_item_id,
                line_no,
                sap_ref_no,
                description,
                quantity,
                uom,
                rate
            )
            values (
                v_boq_item.id,
                p_project_id,
                coalesce((v_breakup ->> 'cost_code_id')::uuid, p_cost_code_id),
                (v_breakup ->> 'material_item_id')::uuid,
                v_breakup_line,
                coalesce(nullif(btrim(v_breakup ->> 'sap_ref_no'), ''), public.generate_doc_no('BQB')),
                coalesce(nullif(btrim(v_breakup ->> 'description'), ''), p_description),
                (v_breakup ->> 'quantity')::numeric,
                v_breakup ->> 'uom',
                (v_breakup ->> 'rate')::numeric
            );
        end loop;
    end if;

    perform public.assert_boq_lumpsum_integrity(v_boq_item.id);

    select *
    into v_boq_item
    from public.boq_items
    where id = v_boq_item.id;

    return v_boq_item;
end;
$$;

create or replace view public.v_boq_item_summary as
select
    bi.id,
    bi.system_id,
    bi.sap_ref_no,
    bi.project_id,
    bi.cost_code_id,
    cc.code as cost_code,
    bi.item_id,
    it.item_code,
    it.name as item_name,
    bi.boq_ref,
    bi.boq_section,
    bi.line_no,
    bi.category,
    bi.item_type,
    bi.description,
    bi.quantity,
    bi.uom,
    bi.rate,
    bi.amount,
    coalesce(count(blb.id), 0)::integer as breakup_count,
    coalesce(sum(blb.amount), 0)::numeric(16, 2) as breakup_amount,
    case
        when bi.item_type = 'regular' then true
        else coalesce(count(blb.id), 0) > 0 and abs(coalesce(sum(blb.amount), 0) - bi.amount) <= 0.01
    end as breakup_matches,
    bi.created_at,
    bi.updated_at
from public.boq_items bi
join public.cost_codes cc on cc.id = bi.cost_code_id
join public.items it on it.id = bi.item_id
left join public.boq_lumpsum_breakups blb on blb.boq_item_id = bi.id
group by bi.id, cc.code, it.item_code, it.name;

create or replace view public.v_boq_lumpsum_breakup_details as
select
    blb.id,
    blb.system_id,
    blb.boq_item_id,
    blb.project_id,
    blb.cost_code_id,
    cc.code as cost_code,
    blb.material_item_id,
    it.item_code as material_item_code,
    it.name as material_item_name,
    blb.line_no,
    blb.sap_ref_no,
    blb.description,
    blb.quantity,
    blb.uom,
    blb.rate,
    blb.amount,
    bi.boq_ref,
    bi.boq_section,
    bi.category,
    bi.description as boq_description,
    bi.amount as boq_amount,
    coalesce(sum(blb.amount) over (partition by blb.boq_item_id), 0)::numeric(16, 2) as breakup_total,
    (bi.amount - coalesce(sum(blb.amount) over (partition by blb.boq_item_id), 0))::numeric(16, 2) as variance,
    blb.created_at,
    blb.updated_at
from public.boq_lumpsum_breakups blb
join public.boq_items bi on bi.id = blb.boq_item_id
join public.cost_codes cc on cc.id = blb.cost_code_id
join public.items it on it.id = blb.material_item_id;

create or replace view public.v_erp_integrity_checks as
select
    p.id as project_id,
    p.name as project_name,
    not exists (
        select 1
        from public.purchase_orders po
        left join public.purchase_requests pr on pr.id = po.purchase_request_id
        where po.project_id = p.id
          and pr.id is null
    )
    and not exists (
        select 1
        from public.grn_headers gh
        left join public.purchase_orders po on po.id = gh.po_id
        where gh.project_id = p.id
          and po.id is null
    ) as pr_po_grn_fully_linked,
    not exists (
        select 1
        from public.inventory_stocks s
        left join (
            select
                gr.item_id,
                gr.project_id,
                coalesce(sum(gr.accepted_qty), 0)
                - (
                    coalesce((select sum(quantity) from public.material_issues mi where mi.project_id = gr.project_id and mi.item_id = gr.item_id and mi.status in ('approved', 'closed')), 0)
                    + coalesce((select sum(quantity) from public.delivery_challans dc where dc.project_id = gr.project_id and dc.item_id = gr.item_id and dc.status in ('approved', 'closed')), 0)
                ) as expected_balance
            from public.goods_receipts gr
            where gr.project_id = p.id
              and gr.status in ('approved', 'closed')
            group by gr.item_id, gr.project_id
        ) calc
            on calc.project_id = s.project_id
           and calc.item_id = s.item_id
        where s.project_id = p.id
          and abs(coalesce(s.balance_qty, 0) - greatest(coalesce(calc.expected_balance, 0), 0)) > 0.01
    ) as stock_equals_grn_minus_issue,
    not exists (
        select 1
        from public.v_boq_item_summary bis
        where bis.project_id = p.id
          and bis.item_type = 'lumpsum'
          and bis.breakup_matches = false
    ) as boq_lumpsum_matches_breakup,
    not exists (
        select 1
        from public.vendor_invoices vi
        where vi.project_id = p.id
          and abs(coalesce(vi.invoice_amount, 0) - coalesce(vi.calculated_amount, 0)) > 0.01
    ) as invoice_matches_log_calculation,
    not exists (
        select 1
        from public.purchase_requests pr
        where pr.project_id = p.id
          and (
              pr.sap_ref_no is null or btrim(pr.sap_ref_no) = ''
              or pr.project_id is null
              or pr.cost_code_id is null
              or pr.item_id is null
              or pr.quantity is null
          )
        union all
        select 1
        from public.purchase_orders po
        where po.project_id = p.id
          and (
              po.sap_ref_no is null or btrim(po.sap_ref_no) = ''
              or po.project_id is null
              or po.cost_code_id is null
              or po.purchase_request_id is null
              or po.vendor_id is null
          )
        union all
        select 1
        from public.grn_headers gh
        where gh.project_id = p.id
          and (
              gh.sap_ref_no is null or btrim(gh.sap_ref_no) = ''
              or gh.po_id is null
              or gh.vendor_id is null
              or gh.cost_code_id is null
          )
        union all
        select 1
        from public.vendor_invoices vi
        where vi.project_id = p.id
          and (
              vi.sap_ref_no is null or btrim(vi.sap_ref_no) = ''
              or vi.cost_code_id is null
              or (vi.po_id is null and vi.contract_id is null)
              or vi.invoice_amount is null
          )
        union all
        select 1
        from public.payments pay
        where pay.project_id = p.id
          and (
              pay.sap_ref_no is null or btrim(pay.sap_ref_no) = ''
              or pay.invoice_id is null
              or pay.cost_code_id is null
              or pay.amount_paid is null
          )
    ) as no_empty_critical_fields
from public.projects p
where p.deleted_at is null;

-- ------------------------------------------------------------
-- Step 4: Policies, audit, and updated_at wiring
-- ------------------------------------------------------------

alter table public.boq_items enable row level security;
alter table public.boq_lumpsum_breakups enable row level security;

drop policy if exists "erp_boq_items_select" on public.boq_items;
create policy "erp_boq_items_select" on public.boq_items
for select using (public.is_project_member(project_id));

drop policy if exists "erp_boq_items_write" on public.boq_items;
create policy "erp_boq_items_write" on public.boq_items
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

drop policy if exists "erp_boq_breakups_select" on public.boq_lumpsum_breakups;
create policy "erp_boq_breakups_select" on public.boq_lumpsum_breakups
for select using (public.is_project_member(project_id));

drop policy if exists "erp_boq_breakups_write" on public.boq_lumpsum_breakups;
create policy "erp_boq_breakups_write" on public.boq_lumpsum_breakups
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

drop trigger if exists trg_boq_items_updated_at on public.boq_items;
create trigger trg_boq_items_updated_at
before update on public.boq_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_boq_breakups_updated_at on public.boq_lumpsum_breakups;
create trigger trg_boq_breakups_updated_at
before update on public.boq_lumpsum_breakups
for each row execute function public.set_updated_at();

drop trigger if exists trg_boq_items_activity_log on public.boq_items;
create trigger trg_boq_items_activity_log
after insert or update or delete on public.boq_items
for each row execute function public.record_activity_log();

drop trigger if exists trg_boq_breakups_activity_log on public.boq_lumpsum_breakups;
create trigger trg_boq_breakups_activity_log
after insert or update or delete on public.boq_lumpsum_breakups
for each row execute function public.record_activity_log();

-- ------------------------------------------------------------
-- Step 5: Seed one clean, fully linked demo project lifecycle
-- ------------------------------------------------------------

do $$
declare
    v_project_id uuid;
    v_owner_profile_id uuid;
    v_client_id uuid;
    v_project_lookup_column text;
    v_project_exists boolean;
    v_project_has_deleted_at boolean;
    v_project_has_created_at boolean;
    v_project_insert_columns text[] := array[]::text[];
    v_project_insert_values text[] := array[]::text[];
    v_project_insert_sql text;
    v_vendor_material_id uuid;
    v_vendor_machinery_id uuid;
    v_vendor_fuel_id uuid;
    v_cost_code_material uuid;
    v_cost_code_labour uuid;
    v_cost_code_machinery uuid;
    v_cost_code_fuel uuid;
    v_item_cement uuid;
    v_item_steel uuid;
    v_item_diesel uuid;
    v_item_labour uuid;
    v_item_excavator uuid;
    v_item_earthwork uuid;
    v_boq_cement_id uuid;
    v_boq_earthwork_id uuid;
    v_pr_id uuid;
    v_po_id uuid;
    v_grn_id uuid;
    v_issue_id uuid;
    v_contract_machine_id uuid;
    v_contract_fuel_id uuid;
    v_material_invoice_id uuid;
    v_machine_invoice_id uuid;
    v_fuel_invoice_id uuid;
begin
    select p.id
    into v_owner_profile_id
    from public.profiles p
    order by case when p.role = 'admin' then 0 else 1 end, p.created_at
    limit 1;

    if v_owner_profile_id is null then
        raise exception 'No profile exists to own the ERP demo project. Create a user/profile first.';
    end if;

    select id into v_client_id from public.clients where client_code = 'CLI-2026-0001' limit 1;

    if v_client_id is null then
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
    end if;

    select case
        when exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'name'
        ) then 'name'
        when exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'project_name'
        ) then 'project_name'
        else null
    end
    into v_project_lookup_column;

    if v_project_lookup_column is null then
        raise exception 'public.projects must contain either a name or project_name column for demo seeding.';
    end if;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'projects'
          and column_name = 'deleted_at'
    )
    into v_project_has_deleted_at;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'projects'
          and column_name = 'created_at'
    )
    into v_project_has_created_at;

    execute format(
        'select exists (select 1 from public.projects where %I = %L%s)',
        v_project_lookup_column,
        'Irrigation Canal Project - Phase 1',
        case when v_project_has_deleted_at then ' and deleted_at is null' else '' end
    )
    into v_project_exists;

    if not v_project_exists then
        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'project_id'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'project_id');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('PRJ-ICP-2026-0001'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'project_name'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'project_name');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('Irrigation Canal Project - Phase 1'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'client'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'client');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('Government Department'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'location'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'location');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('Irrigation Circle Office, India'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'wo_number'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'wo_number');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('WO-ICP-2026-0001'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'wo_date'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'wo_date');
            v_project_insert_values := array_append(v_project_insert_values, 'date ''2026-03-20''');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'wo_value'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'wo_value');
            v_project_insert_values := array_append(v_project_insert_values, '50000000.00');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'name'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'name');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('Irrigation Canal Project - Phase 1'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'description'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'description');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('Structured ERP demo project with complete BOQ, procurement, stock, DPR, contract billing, invoice validation, and payment flow.'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'status'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'status');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('current'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'start_date'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'start_date');
            v_project_insert_values := array_append(v_project_insert_values, 'date ''2026-03-20''');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'end_date'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'end_date');
            v_project_insert_values := array_append(v_project_insert_values, 'date ''2026-09-19''');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'progress'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'progress');
            v_project_insert_values := array_append(v_project_insert_values, '22');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'remarks'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'remarks');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal('Structured ERP demo project with complete BOQ, procurement, stock, DPR, contract billing, invoice validation, and payment flow.'));
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'created_by'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'created_by');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal(v_owner_profile_id::text) || '::uuid');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'client_id'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'client_id');
            v_project_insert_values := array_append(v_project_insert_values, quote_literal(v_client_id::text) || '::uuid');
        end if;

        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'projects'
              and column_name = 'project_value'
        ) then
            v_project_insert_columns := array_append(v_project_insert_columns, 'project_value');
            v_project_insert_values := array_append(v_project_insert_values, '50000000.00');
        end if;

        v_project_insert_sql := format(
            'insert into public.projects (%s) values (%s)',
            array_to_string(v_project_insert_columns, ', '),
            array_to_string(v_project_insert_values, ', ')
        );

        execute v_project_insert_sql;
    end if;

    execute format(
        'select id from public.projects where %I = %L order by %s limit 1',
        v_project_lookup_column,
        'Irrigation Canal Project - Phase 1',
        case when v_project_has_created_at then 'created_at desc, id desc' else 'id desc' end
    )
    into v_project_id;

    insert into public.project_members (project_id, user_id, role)
    select v_project_id, p.id, 'admin'
    from public.profiles p
    on conflict (project_id, user_id) do nothing;

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
        )
    on conflict (name) do update
    set type = excluded.type,
        contact_person = excluded.contact_person,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        payment_terms = excluded.payment_terms,
        gst_no = excluded.gst_no,
        gst = excluded.gst,
        contact_details = excluded.contact_details,
        updated_at = now();

    insert into public.items (item_code, name, item_type, uom, unit, category, standard_rate, hsn_code, is_active)
    values
        ('ITEM-CEM-001', 'Cement', 'material', 'bags', 'bags', 'Material', 420.00, '2523', true),
        ('ITEM-STL-001', 'Steel', 'material', 'kg', 'kg', 'Material', 68.00, '7214', true),
        ('ITEM-DIE-001', 'Diesel', 'material', 'litre', 'litre', 'Fuel', 90.00, '2710', true),
        ('ITEM-LAB-001', 'Earthwork Labour', 'service', 'day', 'day', 'Service', 800.00, '9985', true),
        ('ITEM-EXC-001', 'Excavator Hiring', 'service', 'hour', 'hour', 'Service', 1500.00, '9973', true),
        ('ITEM-EWK-001', 'Earthwork Excavation', 'service', 'LS', 'LS', 'Service', 500000.00, '9954', true)
    on conflict (item_code) do update
    set name = excluded.name,
        item_type = excluded.item_type,
        uom = excluded.uom,
        unit = excluded.unit,
        category = excluded.category,
        standard_rate = excluded.standard_rate,
        hsn_code = excluded.hsn_code,
        is_active = true,
        updated_at = now();

    insert into public.cost_codes (code, name, description, category)
    values
        ('CC-MAT', 'Material', 'Material', 'material'),
        ('CC-LAB', 'Labour', 'Labour', 'labour'),
        ('CC-MCH', 'Machinery', 'Machinery', 'machinery'),
        ('CC-FUL', 'Fuel', 'Fuel', 'fuel')
    on conflict (code) do update
    set name = excluded.name,
        description = excluded.description,
        category = excluded.category,
        updated_at = now();

    insert into public.items (item_code, name, item_type, uom, unit, category, standard_rate, hsn_code, is_active)
    values
        ('ITEM-LAB-001', 'Earthwork Labour', 'service', 'day', 'day', 'Service', 800.00, '9985', true),
        ('ITEM-EXC-001', 'Excavator Hiring', 'service', 'hour', 'hour', 'Service', 1500.00, '9973', true),
        ('ITEM-EWK-001', 'Earthwork Excavation', 'service', 'LS', 'LS', 'Service', 500000.00, '9954', true)
    on conflict (item_code) do update
    set name = excluded.name,
        standard_rate = excluded.standard_rate,
        uom = excluded.uom,
        unit = excluded.unit,
        category = excluded.category,
        is_active = true,
        updated_at = now();

    update public.items
    set standard_rate = 90.00
    where item_code = 'ITEM-DIE-001';

    select id into v_vendor_material_id from public.vendors where name = 'ABC Traders' limit 1;
    select id into v_vendor_machinery_id from public.vendors where name = 'Canal Earthmovers' limit 1;
    select id into v_vendor_fuel_id from public.vendors where name = 'Site Fuel Services' limit 1;

    select id into v_cost_code_material from public.cost_codes where code = 'CC-MAT' limit 1;
    select id into v_cost_code_labour from public.cost_codes where code = 'CC-LAB' limit 1;
    select id into v_cost_code_machinery from public.cost_codes where code = 'CC-MCH' limit 1;
    select id into v_cost_code_fuel from public.cost_codes where code = 'CC-FUL' limit 1;

    select id into v_item_cement from public.items where item_code = 'ITEM-CEM-001' limit 1;
    select id into v_item_steel from public.items where item_code = 'ITEM-STL-001' limit 1;
    select id into v_item_diesel from public.items where item_code = 'ITEM-DIE-001' limit 1;
    select id into v_item_labour from public.items where item_code = 'ITEM-LAB-001' limit 1;
    select id into v_item_excavator from public.items where item_code = 'ITEM-EXC-001' limit 1;
    select id into v_item_earthwork from public.items where item_code = 'ITEM-EWK-001' limit 1;

    if v_vendor_material_id is null or v_vendor_machinery_id is null or v_vendor_fuel_id is null then
        raise exception 'Required vendor masters were not created successfully for the ERP demo seed.';
    end if;

    if v_cost_code_material is null or v_cost_code_labour is null or v_cost_code_machinery is null or v_cost_code_fuel is null then
        raise exception 'Required cost codes were not created successfully for the ERP demo seed.';
    end if;

    if v_item_cement is null or v_item_steel is null or v_item_diesel is null or v_item_labour is null or v_item_excavator is null or v_item_earthwork is null then
        raise exception 'Required item masters were not created successfully for the ERP demo seed.';
    end if;

    delete from public.project_cost_code_budgets where project_id = v_project_id;
    delete from public.payments where project_id = v_project_id;
    delete from public.vendor_invoices where project_id = v_project_id;
    delete from public.fuel_logs where project_id = v_project_id;
    delete from public.machinery_daily_logs where project_id = v_project_id;
    delete from public.vendor_contracts where project_id = v_project_id;
    delete from public.expenses where project_id = v_project_id;
    delete from public.daily_progress_reports where project_id = v_project_id;
    delete from public.material_issues where project_id = v_project_id;
    delete from public.inventory_stocks where project_id = v_project_id;
    delete from public.goods_receipts where project_id = v_project_id;
    delete from public.grn_headers where project_id = v_project_id;
    delete from public.purchase_order_lines where purchase_order_id in (select id from public.purchase_orders where project_id = v_project_id);
    delete from public.purchase_orders where project_id = v_project_id;
    delete from public.purchase_requests where project_id = v_project_id;
    delete from public.ra_bills where project_id = v_project_id;
    delete from public.boq_lumpsum_breakups where project_id = v_project_id;
    delete from public.boq_items where project_id = v_project_id;

    insert into public.project_cost_code_budgets (project_id, cost_code_id, budget_amount)
    values
        (v_project_id, v_cost_code_material, 22000000.00),
        (v_project_id, v_cost_code_labour, 11000000.00),
        (v_project_id, v_cost_code_machinery, 10000000.00),
        (v_project_id, v_cost_code_fuel, 7000000.00);

    insert into public.boq_items (
        sap_ref_no,
        project_id,
        cost_code_id,
        item_id,
        boq_ref,
        boq_section,
        line_no,
        category,
        item_type,
        description,
        quantity,
        uom,
        rate,
        created_by
    )
    values
        ('SAP-CEM-001', v_project_id, v_cost_code_material, v_item_cement, 'BOQ-ICP-001', 'Concrete Works', 1, 'Material', 'regular', 'Cement for canal lining', 100, 'bags', 420.00, v_owner_profile_id),
        ('SAP-STL-001', v_project_id, v_cost_code_material, v_item_steel, 'BOQ-ICP-002', 'Reinforcement', 2, 'Material', 'regular', 'Steel for structural reinforcement', 5000, 'kg', 68.00, v_owner_profile_id),
        ('SAP-EWK-001', v_project_id, v_cost_code_machinery, v_item_earthwork, 'BOQ-ICP-003', 'Earthwork', 3, 'Earthwork', 'lumpsum', 'Earthwork Excavation', 1, 'LS', 500000.00, v_owner_profile_id);

    select id into v_boq_cement_id from public.boq_items where project_id = v_project_id and boq_ref = 'BOQ-ICP-001';
    select id into v_boq_earthwork_id from public.boq_items where project_id = v_project_id and boq_ref = 'BOQ-ICP-003';

    insert into public.boq_lumpsum_breakups (
        boq_item_id,
        project_id,
        cost_code_id,
        material_item_id,
        line_no,
        sap_ref_no,
        description,
        quantity,
        uom,
        rate
    )
    values
        (v_boq_earthwork_id, v_project_id, v_cost_code_fuel, v_item_diesel, 1, 'SAP-EWK-001-A', 'Diesel for excavation spread', 500, 'litre', 90.00),
        (v_boq_earthwork_id, v_project_id, v_cost_code_labour, v_item_labour, 2, 'SAP-EWK-001-B', 'Earthwork labour crew', 100, 'day', 800.00),
        (v_boq_earthwork_id, v_project_id, v_cost_code_machinery, v_item_excavator, 3, 'SAP-EWK-001-C', 'Excavator deployment', 250, 'hour', 1500.00);

    insert into public.purchase_requests (
        sap_ref_no,
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
        'SAP-CEM-001',
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
        sap_ref_no,
        vendor_id,
        project_id,
        cost_code_id,
        purchase_request_id,
        delivery_date,
        status,
        created_by
    )
    values (
        'SAP-CEM-001',
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
        sap_ref_no,
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
        'SAP-CEM-001',
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
        sap_ref_no,
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
        'SAP-CEM-001',
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
        sap_ref_no,
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
        'SAP-CEM-001',
        v_project_id,
        v_cost_code_material,
        v_item_cement,
        50,
        'Canal Zone A',
        date '2026-03-31',
        'Issued to site for concrete work.',
        'approved'
    )
    returning id into v_issue_id;

    insert into public.daily_progress_reports (
        sap_ref_no,
        project_id,
        cost_code_id,
        boq_item_id,
        material_issue_id,
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
        'SAP-CEM-001',
        v_project_id,
        v_cost_code_material,
        v_boq_cement_id,
        v_issue_id,
        date '2026-03-31',
        'Concrete lining',
        'Placed concrete lining using 50 bags of cement on Canal Zone A.',
        50,
        12,
        'Excavator',
        'No field issues reported.',
        'Concrete work logged against issued stock.',
        v_owner_profile_id,
        'approved'
    );

    insert into public.expenses (
        sap_ref_no,
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
        'SAP-LAB-001',
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
        sap_ref_no,
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
        'SAP-EWK-001-C',
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
        date '2026-03-27',
        date '2026-09-19',
        'Excavator deployed for canal excavation.',
        'Hourly billing against approved site logs.',
        'monthly',
        'approved'
    )
    returning id into v_contract_machine_id;

    insert into public.vendor_contracts (
        sap_ref_no,
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
        'SAP-EWK-001-A',
        v_vendor_fuel_id,
        v_project_id,
        v_cost_code_fuel,
        'Fuel',
        'per_litre',
        90.00,
        'Excavator',
        0,
        null,
        90.00,
        date '2026-03-27',
        date '2026-09-19',
        'Diesel supply for excavation spread.',
        'Per litre billing against approved fuel logs.',
        'monthly',
        'approved'
    )
    returning id into v_contract_fuel_id;

    insert into public.machinery_daily_logs (
        sap_ref_no,
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
        ('SAP-EWK-001-C', v_contract_machine_id, 'Excavator', date '2026-03-27', 8, 0.5, 100, 'Ramesh Kumar', 'approved'),
        ('SAP-EWK-001-C', v_contract_machine_id, 'Excavator', date '2026-03-28', 8, 0.5, 100, 'Ramesh Kumar', 'approved'),
        ('SAP-EWK-001-C', v_contract_machine_id, 'Excavator', date '2026-03-29', 8, 0.5, 100, 'Ramesh Kumar', 'approved'),
        ('SAP-EWK-001-C', v_contract_machine_id, 'Excavator', date '2026-03-30', 8, 0.5, 100, 'Ramesh Kumar', 'approved'),
        ('SAP-EWK-001-C', v_contract_machine_id, 'Excavator', date '2026-03-31', 8, 0.5, 100, 'Ramesh Kumar', 'approved');

    insert into public.fuel_logs (
        sap_ref_no,
        contract_id,
        project_id,
        cost_code_id,
        log_date,
        machine_name,
        litres_consumed,
        rate,
        status
    )
    values
        ('SAP-EWK-001-A', v_contract_fuel_id, v_project_id, v_cost_code_fuel, date '2026-03-27', 'Excavator', 100, 90.00, 'approved'),
        ('SAP-EWK-001-A', v_contract_fuel_id, v_project_id, v_cost_code_fuel, date '2026-03-28', 'Excavator', 100, 90.00, 'approved'),
        ('SAP-EWK-001-A', v_contract_fuel_id, v_project_id, v_cost_code_fuel, date '2026-03-29', 'Excavator', 100, 90.00, 'approved'),
        ('SAP-EWK-001-A', v_contract_fuel_id, v_project_id, v_cost_code_fuel, date '2026-03-30', 'Excavator', 100, 90.00, 'approved'),
        ('SAP-EWK-001-A', v_contract_fuel_id, v_project_id, v_cost_code_fuel, date '2026-03-31', 'Excavator', 100, 90.00, 'approved');

    insert into public.vendor_invoices (
        sap_ref_no,
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
        'SAP-CEM-001',
        v_vendor_material_id,
        v_project_id,
        v_cost_code_material,
        v_po_id,
        42000.00,
        date '2026-03-31',
        'Material invoice against approved GRN quantity.',
        'approved'
    )
    returning id into v_material_invoice_id;

    insert into public.vendor_invoices (
        sap_ref_no,
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
        'SAP-EWK-001-C',
        v_vendor_machinery_id,
        v_project_id,
        v_cost_code_machinery,
        v_contract_machine_id,
        60000.00,
        date '2026-03-31',
        'Machinery invoice matched to 5 days x 8 hours x INR 1,500.',
        'approved'
    )
    returning id into v_machine_invoice_id;

    insert into public.vendor_invoices (
        sap_ref_no,
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
        'SAP-EWK-001-A',
        v_vendor_fuel_id,
        v_project_id,
        v_cost_code_fuel,
        v_contract_fuel_id,
        45000.00,
        date '2026-03-31',
        'Fuel invoice matched to 500 litres at INR 90.',
        'approved'
    )
    returning id into v_fuel_invoice_id;

    insert into public.payments (
        sap_ref_no,
        invoice_id,
        project_id,
        amount_paid,
        payment_date,
        payment_mode,
        remarks,
        status
    )
    values
        ('SAP-CEM-001', v_material_invoice_id, v_project_id, 42000.00, date '2026-04-01', 'Bank Transfer', 'Released against matched material invoice.', 'approved'),
        ('SAP-EWK-001-C', v_machine_invoice_id, v_project_id, 60000.00, date '2026-04-02', 'Bank Transfer', 'Released against approved machinery invoice.', 'approved'),
        ('SAP-EWK-001-A', v_fuel_invoice_id, v_project_id, 45000.00, date '2026-04-02', 'Bank Transfer', 'Released against approved fuel invoice.', 'approved');

    insert into public.ra_bills (
        sap_ref_no,
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
        'SAP-RA-001',
        v_project_id,
        v_client_id,
        date '2026-04-01',
        125000.00,
        0,
        125000.00,
        5000.00,
        'submitted'
    );

    perform public.refresh_inventory_stock(v_project_id, v_item_cement);

    update public.projects
    set progress = 24,
        project_value = 50000000.00,
        updated_at = now()
    where id = v_project_id;
end $$;
