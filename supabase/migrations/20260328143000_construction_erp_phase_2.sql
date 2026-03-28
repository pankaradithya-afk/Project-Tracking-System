-- ============================================================
-- Construction ERP Phase 2
-- Procurement lifecycle, approvals, cost controls, and invoice validation
-- ============================================================

create extension if not exists pgcrypto;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'erp_approval_status') then
        create type erp_approval_status as enum ('draft', 'submitted', 'approved', 'rejected');
    end if;

    if not exists (select 1 from pg_type where typname = 'erp_contract_rate_type') then
        create type erp_contract_rate_type as enum ('monthly', 'hourly', 'per_unit');
    end if;
end $$;

alter type erp_document_status add value if not exists 'submitted';
alter type erp_document_status add value if not exists 'rejected';
alter type erp_delivery_status add value if not exists 'submitted';
alter type erp_delivery_status add value if not exists 'rejected';

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

create or replace function public.generate_erp_system_id(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.generate_doc_no(p_prefix);
end;
$$;

alter table public.clients
    add column if not exists gst text,
    add column if not exists contact_details jsonb;

update public.clients
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

alter table public.vendors
    add column if not exists gst text,
    add column if not exists contact_details jsonb;

update public.vendors
set gst = coalesce(gst, gst_no)
where gst is null;

update public.vendors
set contact_details = jsonb_build_object(
    'contact_person', contact_person,
    'phone', phone,
    'email', email,
    'address', address,
    'payment_terms', payment_terms
)
where contact_details is null;

alter table public.items
    add column if not exists unit text,
    add column if not exists category text;

update public.items
set unit = coalesce(unit, uom)
where unit is null;

update public.items
set category = coalesce(category, initcap(item_type::text))
where category is null;

alter table public.cost_codes
    add column if not exists name text;

update public.cost_codes
set name = coalesce(name, description, code)
where name is null;

alter table public.sales_orders
    alter column system_id set default public.generate_doc_no('SO');

alter table public.purchase_requests
    alter column system_id set default public.generate_doc_no('PR');

alter table public.purchase_orders
    alter column system_id set default public.generate_doc_no('PO');

alter table public.delivery_challans
    alter column system_id set default public.generate_doc_no('DC');

alter table public.material_issues
    alter column system_id set default public.generate_doc_no('MI'),
    add column if not exists sap_ref_no text;

alter table public.vendor_contracts
    alter column contract_id set default public.generate_doc_no('VCT'),
    add column if not exists sap_ref_no text,
    add column if not exists rate_type erp_contract_rate_type,
    add column if not exists rate numeric(14, 2),
    add column if not exists terms text;

update public.vendor_contracts
set rate_type = case
    when coalesce(hourly_rate, 0) > 0 then 'hourly'::erp_contract_rate_type
    when coalesce(rate_per_litre, 0) > 0 then 'per_unit'::erp_contract_rate_type
    else 'monthly'::erp_contract_rate_type
end
where rate_type is null;

update public.vendor_contracts
set rate = case rate_type
    when 'hourly' then coalesce(hourly_rate, monthly_rate, 0)
    when 'per_unit' then coalesce(rate_per_litre, monthly_rate, 0)
    else coalesce(monthly_rate, 0)
end
where rate is null;

update public.vendor_contracts
set terms = coalesce(terms, terms_conditions)
where terms is null;

alter table public.daily_progress_reports
    add column if not exists system_id text,
    add column if not exists sap_ref_no text,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists boq_line_id uuid references public.boq_lines(id) on delete set null,
    add column if not exists remarks text;

update public.daily_progress_reports
set remarks = coalesce(remarks, issues)
where remarks is null;

update public.daily_progress_reports
set system_id = public.generate_doc_no('DPR')
where system_id is null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'daily_progress_reports_system_id_key'
    ) then
        alter table public.daily_progress_reports
            add constraint daily_progress_reports_system_id_key unique (system_id);
    end if;
end $$;

alter table public.machinery_daily_logs
    add column if not exists system_id text,
    add column if not exists sap_ref_no text,
    add column if not exists project_id uuid references public.projects(id) on delete cascade,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict;

update public.machinery_daily_logs
set system_id = public.generate_doc_no('MLOG')
where system_id is null;

update public.machinery_daily_logs mdl
set project_id = vc.project_id,
    cost_code_id = vc.cost_code_id
from public.vendor_contracts vc
where vc.id = mdl.contract_id
  and (mdl.project_id is null or mdl.cost_code_id is null);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'machinery_daily_logs_system_id_key'
    ) then
        alter table public.machinery_daily_logs
            add constraint machinery_daily_logs_system_id_key unique (system_id);
    end if;
end $$;

alter table public.fuel_logs
    add column if not exists system_id text,
    add column if not exists sap_ref_no text,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict;

update public.fuel_logs
set system_id = public.generate_doc_no('FLOG')
where system_id is null;

update public.fuel_logs fl
set cost_code_id = vc.cost_code_id
from public.vendor_contracts vc
where vc.id = fl.contract_id
  and fl.cost_code_id is null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'fuel_logs_system_id_key'
    ) then
        alter table public.fuel_logs
            add constraint fuel_logs_system_id_key unique (system_id);
    end if;
end $$;

alter table public.expenses
    add column if not exists system_id text,
    add column if not exists sap_ref_no text,
    add column if not exists status erp_document_status not null default 'approved';

update public.expenses
set system_id = public.generate_doc_no('EXP')
where system_id is null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'expenses_system_id_key'
    ) then
        alter table public.expenses
            add constraint expenses_system_id_key unique (system_id);
    end if;
end $$;

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

insert into public.grn_headers (
    system_id,
    sap_ref_no,
    po_id,
    vendor_id,
    project_id,
    cost_code_id,
    received_date,
    status,
    remarks,
    created_at,
    updated_at
)
select
    gr.system_id,
    gr.sap_ref_no,
    gr.po_id,
    gr.vendor_id,
    gr.project_id,
    gr.cost_code_id,
    gr.received_date,
    gr.status,
    gr.remarks,
    gr.created_at,
    gr.updated_at
from public.goods_receipts gr
where gr.grn_id is null
on conflict (system_id) do nothing;

update public.goods_receipts gr
set grn_id = gh.id
from public.grn_headers gh
where gr.grn_id is null
  and gh.system_id = gr.system_id;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'goods_receipts_grn_item_unique'
    ) then
        alter table public.goods_receipts
            add constraint goods_receipts_grn_item_unique unique (grn_id, item_id);
    end if;
end $$;

alter table public.vendor_invoices
    alter column system_id set default public.generate_doc_no('INV'),
    add column if not exists po_id uuid references public.purchase_orders(id) on delete set null,
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.payments
    alter column system_id set default public.generate_doc_no('PAY'),
    add column if not exists cost_code_id uuid references public.cost_codes(id) on delete restrict,
    add column if not exists status erp_document_status not null default 'draft';

alter table public.ra_bills
    alter column bill_no set default public.generate_doc_no('RA'),
    add column if not exists sap_ref_no text;

create table if not exists public.approvals (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    module text not null,
    record_id uuid not null,
    status erp_approval_status not null default 'draft',
    approved_by uuid references public.profiles(id) on delete set null,
    action_date timestamptz,
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (module, record_id)
);

create index if not exists idx_grn_headers_project_id on public.grn_headers(project_id);
create index if not exists idx_goods_receipts_grn_id on public.goods_receipts(grn_id);
create index if not exists idx_approvals_project_id on public.approvals(project_id);
create index if not exists idx_approvals_module_record_id on public.approvals(module, record_id);
create index if not exists idx_vendor_invoices_po_id on public.vendor_invoices(po_id);

create or replace function public.enforce_document_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_old_status text := coalesce(old.status::text, 'draft');
    v_new_status text := coalesce(new.status::text, 'draft');
begin
    if tg_op <> 'UPDATE' or v_old_status = v_new_status then
        return new;
    end if;

    if v_old_status = 'draft' and v_new_status in ('submitted', 'rejected', 'draft') then
        return new;
    end if;

    if v_old_status = 'submitted' and v_new_status in ('approved', 'rejected', 'submitted') then
        return new;
    end if;

    if v_old_status = 'approved' and v_new_status in ('approved', 'closed') then
        return new;
    end if;

    if v_old_status = 'rejected' and v_new_status in ('draft', 'submitted', 'rejected') then
        return new;
    end if;

    if v_old_status = 'closed' and v_new_status = 'closed' then
        return new;
    end if;

    raise exception 'Invalid status transition from % to % for %', v_old_status, v_new_status, tg_table_name;
end;
$$;

create or replace function public.sync_approval_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status erp_approval_status;
    v_project_id uuid;
    v_module text := case tg_table_name
        when 'grn_headers' then 'GRN'
        when 'purchase_requests' then 'PR'
        when 'purchase_orders' then 'PO'
        when 'vendor_invoices' then 'Invoice'
        when 'payments' then 'Payment'
        else initcap(replace(tg_table_name, '_', ' '))
    end;
begin
    v_project_id := coalesce(new.project_id, old.project_id);
    v_status := case coalesce(new.status::text, old.status::text, 'draft')
        when 'submitted' then 'submitted'::erp_approval_status
        when 'approved' then 'approved'::erp_approval_status
        when 'rejected' then 'rejected'::erp_approval_status
        when 'closed' then 'approved'::erp_approval_status
        else 'draft'::erp_approval_status
    end;

    insert into public.approvals (
        project_id,
        module,
        record_id,
        status,
        approved_by,
        action_date,
        updated_at
    )
    values (
        v_project_id,
        v_module,
        coalesce(new.id, old.id),
        v_status,
        case when v_status = 'approved' then (select p.id from public.profiles p where p.auth_user_id = auth.uid() limit 1) else null end,
        case when v_status in ('approved', 'rejected') then now() else null end,
        now()
    )
    on conflict (module, record_id) do update
    set project_id = excluded.project_id,
        status = excluded.status,
        approved_by = excluded.approved_by,
        action_date = excluded.action_date,
        updated_at = now();

    return coalesce(new, old);
end;
$$;

create or replace function public.set_machinery_log_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_hourly_rate numeric(14, 2);
    v_monthly_rate numeric(14, 2);
    v_project_id uuid;
    v_cost_code_id uuid;
begin
    select hourly_rate, monthly_rate, project_id, cost_code_id
    into v_hourly_rate, v_monthly_rate, v_project_id, v_cost_code_id
    from public.vendor_contracts
    where id = new.contract_id;

    new.project_id := coalesce(new.project_id, v_project_id);
    new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
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
    select project_id, cost_code_id, coalesce(rate_per_litre, rate, 0)
    into v_project_id, v_cost_code_id, v_rate
    from public.vendor_contracts
    where id = new.contract_id;

    new.project_id := coalesce(new.project_id, v_project_id);
    new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    new.rate := case when coalesce(new.rate, 0) > 0 then new.rate else coalesce(v_rate, 0) end;
    return new;
end;
$$;

drop trigger if exists trg_fuel_logs_defaults on public.fuel_logs;
create trigger trg_fuel_logs_defaults
before insert or update on public.fuel_logs
for each row execute function public.set_fuel_log_defaults();

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
    v_month_start date := date_trunc('month', p_invoice_date)::date;
    v_month_end date := (date_trunc('month', p_invoice_date) + interval '1 month - 1 day')::date;
    v_monthly_rate numeric(14, 2);
    v_total numeric(16, 2);
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
    end if;

    if new.contract_id is not null and new.cost_code_id is null then
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
        else 'mismatch'
    end;

    return new;
end;
$$;

create or replace function public.apply_payment_dimensions()
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
    from public.vendor_invoices
    where id = new.invoice_id;

    new.project_id := coalesce(new.project_id, v_project_id);
    new.cost_code_id := coalesce(new.cost_code_id, v_cost_code_id);
    return new;
end;
$$;

drop trigger if exists trg_payments_apply_dimensions on public.payments;
create trigger trg_payments_apply_dimensions
before insert or update on public.payments
for each row execute function public.apply_payment_dimensions();

create or replace function public.refresh_vendor_invoice_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invoice_amount numeric(16, 2);
    v_paid_amount numeric(16, 2);
begin
    select invoice_amount
    into v_invoice_amount
    from public.vendor_invoices
    where id = p_invoice_id;

    select coalesce(sum(amount_paid), 0)
    into v_paid_amount
    from public.payments
    where invoice_id = p_invoice_id
      and status in ('approved', 'closed');

    update public.vendor_invoices
    set status = case
            when coalesce(v_paid_amount, 0) >= coalesce(v_invoice_amount, 0) and coalesce(v_invoice_amount, 0) > 0 then 'closed'
            when status = 'draft' then 'draft'
            else 'approved'
        end,
        updated_at = now()
    where id = p_invoice_id;
end;
$$;

create or replace function public.handle_payment_status_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.refresh_vendor_invoice_payment_status(coalesce(new.invoice_id, old.invoice_id));
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_payments_refresh_invoice_status on public.payments;
create trigger trg_payments_refresh_invoice_status
after insert or update or delete on public.payments
for each row execute function public.handle_payment_status_refresh();

create or replace function public.touch_linked_vendor_invoices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_contract_id uuid;
    v_po_id uuid;
    v_log_date date;
begin
    if tg_table_name in ('machinery_daily_logs', 'fuel_logs') then
        v_contract_id := coalesce(new.contract_id, old.contract_id);
        v_log_date := coalesce(new.log_date, old.log_date);

        update public.vendor_invoices
        set updated_at = now()
        where contract_id = v_contract_id
          and date_trunc('month', invoice_date) = date_trunc('month', v_log_date);
    elsif tg_table_name = 'goods_receipts' then
        v_po_id := coalesce(new.po_id, old.po_id);

        update public.vendor_invoices
        set updated_at = now()
        where po_id = v_po_id;
    elsif tg_table_name = 'purchase_order_lines' then
        v_po_id := coalesce(new.purchase_order_id, old.purchase_order_id);

        update public.vendor_invoices
        set updated_at = now()
        where po_id = v_po_id;
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_machinery_logs_touch_invoices on public.machinery_daily_logs;
create trigger trg_machinery_logs_touch_invoices
after insert or update or delete on public.machinery_daily_logs
for each row execute function public.touch_linked_vendor_invoices();

drop trigger if exists trg_fuel_logs_touch_invoices on public.fuel_logs;
create trigger trg_fuel_logs_touch_invoices
after insert or update or delete on public.fuel_logs
for each row execute function public.touch_linked_vendor_invoices();

drop trigger if exists trg_goods_receipts_touch_invoices on public.goods_receipts;
create trigger trg_goods_receipts_touch_invoices
after insert or update or delete on public.goods_receipts
for each row execute function public.touch_linked_vendor_invoices();

drop trigger if exists trg_purchase_order_lines_touch_invoices on public.purchase_order_lines;
create trigger trg_purchase_order_lines_touch_invoices
after insert or update or delete on public.purchase_order_lines
for each row execute function public.touch_linked_vendor_invoices();

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

drop trigger if exists trg_purchase_requests_status_guard on public.purchase_requests;
create trigger trg_purchase_requests_status_guard
before update on public.purchase_requests
for each row execute function public.enforce_document_status_transition();

drop trigger if exists trg_purchase_orders_status_guard on public.purchase_orders;
create trigger trg_purchase_orders_status_guard
before update on public.purchase_orders
for each row execute function public.enforce_document_status_transition();

drop trigger if exists trg_grn_headers_status_guard on public.grn_headers;
create trigger trg_grn_headers_status_guard
before update on public.grn_headers
for each row execute function public.enforce_document_status_transition();

drop trigger if exists trg_vendor_invoices_status_guard on public.vendor_invoices;
create trigger trg_vendor_invoices_status_guard
before update on public.vendor_invoices
for each row execute function public.enforce_document_status_transition();

drop trigger if exists trg_payments_status_guard on public.payments;
create trigger trg_payments_status_guard
before update on public.payments
for each row execute function public.enforce_document_status_transition();

drop trigger if exists trg_purchase_requests_approval_sync on public.purchase_requests;
create trigger trg_purchase_requests_approval_sync
after insert or update on public.purchase_requests
for each row execute function public.sync_approval_record();

drop trigger if exists trg_purchase_orders_approval_sync on public.purchase_orders;
create trigger trg_purchase_orders_approval_sync
after insert or update on public.purchase_orders
for each row execute function public.sync_approval_record();

drop trigger if exists trg_grn_headers_approval_sync on public.grn_headers;
create trigger trg_grn_headers_approval_sync
after insert or update on public.grn_headers
for each row execute function public.sync_approval_record();

drop trigger if exists trg_vendor_invoices_approval_sync on public.vendor_invoices;
create trigger trg_vendor_invoices_approval_sync
after insert or update on public.vendor_invoices
for each row execute function public.sync_approval_record();

drop trigger if exists trg_payments_approval_sync on public.payments;
create trigger trg_payments_approval_sync
after insert or update on public.payments
for each row execute function public.sync_approval_record();

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
          and vi.validation_status = 'mismatch'
    ), 0) as open_invoice_variance_count
from public.projects p
where p.deleted_at is null;

alter table public.grn_headers enable row level security;
alter table public.approvals enable row level security;

drop policy if exists "erp_grn_headers_select" on public.grn_headers;
create policy "erp_grn_headers_select" on public.grn_headers
for select using (public.is_project_member(project_id));

drop policy if exists "erp_grn_headers_write" on public.grn_headers;
create policy "erp_grn_headers_write" on public.grn_headers
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

drop policy if exists "erp_approvals_select" on public.approvals;
create policy "erp_approvals_select" on public.approvals
for select using (public.is_project_member(project_id));

drop policy if exists "erp_approvals_write" on public.approvals;
create policy "erp_approvals_write" on public.approvals
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));
