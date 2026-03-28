-- ============================================================
-- ERP PHASE 1 MIGRATION
-- CRM + Estimation/Design + Master Data
-- Compatible with the existing Supabase auth/profiles schema
-- ============================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ------------------------------------------------------------
-- Enum migration for the existing projects.status column
-- ------------------------------------------------------------
do $$
begin
    if exists (
        select 1
        from pg_type t
        join pg_enum e on e.enumtypid = t.oid
        where t.typname = 'project_status'
          and e.enumlabel = 'planning'
    ) and not exists (
        select 1 from pg_type where typname = 'project_status_legacy'
    ) then
        alter type project_status rename to project_status_legacy;
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'project_status') then
        create type project_status as enum ('enquiry', 'upcoming', 'current', 'finished', 'archived');
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'customer_company_type') then
        create type customer_company_type as enum ('private', 'govt', 'consultant');
    end if;

    if not exists (select 1 from pg_type where typname = 'project_type') then
        create type project_type as enum ('golf', 'cricket', 'football');
    end if;

    if not exists (select 1 from pg_type where typname = 'interaction_mode') then
        create type interaction_mode as enum ('call', 'meeting', 'email');
    end if;

    if not exists (select 1 from pg_type where typname = 'design_type') then
        create type design_type as enum ('concept', 'detailed', 'ifc');
    end if;

    if not exists (select 1 from pg_type where typname = 'design_approval_status') then
        create type design_approval_status as enum ('draft', 'submitted', 'approved', 'rejected');
    end if;

    if not exists (select 1 from pg_type where typname = 'boq_line_category') then
        create type boq_line_category as enum ('material', 'labor', 'lumpsum');
    end if;

    if not exists (select 1 from pg_type where typname = 'cost_component_type') then
        create type cost_component_type as enum ('material', 'import_duty', 'freight', 'labor', 'overheads', 'margin');
    end if;

    if not exists (select 1 from pg_type where typname = 'quotation_status') then
        create type quotation_status as enum ('draft', 'submitted', 'revised', 'approved');
    end if;

    if not exists (select 1 from pg_type where typname = 'material_category') then
        create type material_category as enum ('raw', 'consumable', 'equipment', 'finished');
    end if;

    if not exists (select 1 from pg_type where typname = 'vendor_type') then
        create type vendor_type as enum ('manufacturer', 'dealer', 'retailer');
    end if;

    if not exists (select 1 from pg_type where typname = 'asset_type') then
        create type asset_type as enum ('equipment', 'tool');
    end if;

    if not exists (select 1 from pg_type where typname = 'asset_ownership') then
        create type asset_ownership as enum ('owned', 'hired');
    end if;

    if not exists (select 1 from pg_type where typname = 'labor_skill_level') then
        create type labor_skill_level as enum ('unskilled', 'semi_skilled', 'skilled', 'specialist');
    end if;
end $$;

-- ------------------------------------------------------------
-- CRM & Pre-Sales
-- ------------------------------------------------------------
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    client_name text not null,
    company_type customer_company_type not null,
    contact_person text,
    phone text,
    email text,
    address text,
    gst_no text,
    payment_behavior text,
    credit_period integer not null default 0 check (credit_period >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'projects'
          and column_name = 'status'
          and udt_name = 'project_status_legacy'
    ) then
        alter table public.projects alter column status drop default;
        alter table public.projects
            alter column status type project_status
            using (
                case status::text
                    when 'planning' then 'enquiry'
                    when 'active' then 'current'
                    when 'on_hold' then 'upcoming'
                    when 'completed' then 'finished'
                    when 'archived' then 'archived'
                    else coalesce(status::text, 'enquiry')
                end
            )::project_status;
    end if;
end $$;

alter table public.projects
    alter column status set default 'enquiry',
    alter column start_date drop not null;

alter table public.projects
    add column if not exists customer_id uuid references public.customers(id) on delete set null,
    add column if not exists project_type project_type,
    add column if not exists scope_type text,
    add column if not exists internal_owner_id uuid references public.profiles(id) on delete set null;

create table if not exists public.interactions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    interaction_date timestamptz not null default now(),
    mode interaction_mode not null,
    discussion_summary text not null,
    action_required text,
    responsible_person_id uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Master Data
-- ------------------------------------------------------------
create table if not exists public.materials (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    description text not null,
    category material_category not null default 'raw',
    uom text not null,
    standard_cost numeric(14, 2) not null default 0 check (standard_cost >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    type vendor_type not null,
    contact_person text,
    phone text,
    email text,
    address text,
    payment_terms text,
    gst_no text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vendor_brand_mapping (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null references public.vendors(id) on delete cascade,
    brand_name text not null,
    dealer_type text,
    territory text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (vendor_id, brand_name, territory)
);

create table if not exists public.vendor_prices (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid not null references public.vendors(id) on delete cascade,
    material_code text not null references public.materials(code) on delete cascade,
    base_price numeric(14, 2) not null default 0 check (base_price >= 0),
    discount numeric(14, 2) not null default 0 check (discount >= 0),
    net_price numeric(14, 2) generated always as (greatest(base_price - discount, 0::numeric)) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (vendor_id, material_code)
);

create table if not exists public.assets (
    id uuid primary key default gen_random_uuid(),
    asset_code text not null unique,
    asset_name text not null,
    asset_type asset_type not null,
    ownership asset_ownership not null,
    current_project_id uuid references public.projects(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.labor_rates (
    id uuid primary key default gen_random_uuid(),
    category text not null,
    skill_level labor_skill_level not null,
    daily_rate numeric(14, 2) not null default 0 check (daily_rate >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (category, skill_level)
);

-- ------------------------------------------------------------
-- Estimation & Design
-- ------------------------------------------------------------
create table if not exists public.designs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    version_no integer not null check (version_no > 0),
    designer_id uuid references public.profiles(id) on delete set null,
    design_type design_type not null,
    approval_status design_approval_status not null default 'draft',
    is_final_ifc boolean not null default false,
    is_locked boolean not null default false,
    finalized_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, version_no, design_type)
);

create table if not exists public.boq_headers (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    design_id uuid not null references public.designs(id) on delete cascade,
    version_no integer not null check (version_no > 0),
    prepared_by uuid references public.profiles(id) on delete set null,
    boq_date date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, design_id, version_no)
);

create table if not exists public.boq_lines (
    id uuid primary key default gen_random_uuid(),
    boq_header_id uuid not null references public.boq_headers(id) on delete cascade,
    line_no integer not null default 1 check (line_no > 0),
    material_id uuid references public.materials(id) on delete set null,
    description text,
    category boq_line_category not null,
    qty numeric(14, 3) not null default 0 check (qty >= 0),
    uom text not null,
    rate numeric(14, 2) not null default 0 check (rate >= 0),
    amount numeric(16, 2) generated always as (qty * rate) stored,
    sap_breakup_required boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (boq_header_id, line_no)
);

create table if not exists public.cost_components (
    id uuid primary key default gen_random_uuid(),
    boq_line_id uuid not null references public.boq_lines(id) on delete cascade,
    component_type cost_component_type not null,
    component_amount numeric(14, 2) not null default 0 check (component_amount >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (boq_line_id, component_type)
);

create table if not exists public.quotations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    design_id uuid not null references public.designs(id) on delete restrict,
    version_no integer not null check (version_no > 0),
    total_cost numeric(16, 2) not null default 0 check (total_cost >= 0),
    quoted_value numeric(16, 2) not null default 0 check (quoted_value >= 0),
    margin_percent numeric(8, 2) generated always as (
        case
            when total_cost = 0 then 0::numeric
            else round(((quoted_value - total_cost) / total_cost) * 100, 2)
        end
    ) stored,
    validity_date date,
    status quotation_status not null default 'draft',
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, version_no)
);

create table if not exists public.quotation_revisions (
    id uuid primary key default gen_random_uuid(),
    quotation_id uuid not null references public.quotations(id) on delete cascade,
    revision_no integer not null check (revision_no > 0),
    previous_quoted_value numeric(16, 2),
    revised_quoted_value numeric(16, 2) not null check (revised_quoted_value >= 0),
    commercial_impact numeric(16, 2) not null default 0,
    final_agreed_value numeric(16, 2),
    revision_reason text,
    revised_by uuid references public.profiles(id) on delete set null,
    revision_date timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (quotation_id, revision_no)
);

create table if not exists public.negotiation_logs (
    id uuid primary key default gen_random_uuid(),
    quotation_id uuid not null references public.quotations(id) on delete cascade,
    discussion_date timestamptz not null default now(),
    discussion_summary text not null,
    commercial_impact numeric(16, 2) not null default 0,
    proposed_value numeric(16, 2),
    agreed_value numeric(16, 2),
    next_action text,
    logged_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Execution hand-off table required by approval automation
-- ------------------------------------------------------------
create table if not exists public.boq_contracts (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    quotation_id uuid not null references public.quotations(id) on delete cascade,
    design_id uuid not null references public.designs(id) on delete restrict,
    boq_line_id uuid not null references public.boq_lines(id) on delete restrict,
    contract_version_no integer not null check (contract_version_no > 0),
    line_no integer not null check (line_no > 0),
    material_id uuid references public.materials(id) on delete set null,
    description text,
    category boq_line_category not null,
    qty numeric(14, 3) not null check (qty >= 0),
    uom text not null,
    rate numeric(14, 2) not null check (rate >= 0),
    amount numeric(16, 2) generated always as (qty * rate) stored,
    sap_breakup_required boolean not null default false,
    locked_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (quotation_id, boq_line_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_projects_customer_id on public.projects(customer_id);
create index if not exists idx_projects_internal_owner_id on public.projects(internal_owner_id);
create index if not exists idx_projects_project_type on public.projects(project_type);
create index if not exists idx_interactions_project_id on public.interactions(project_id);
create index if not exists idx_interactions_responsible_person_id on public.interactions(responsible_person_id);
create index if not exists idx_designs_project_id on public.designs(project_id);
create index if not exists idx_designs_designer_id on public.designs(designer_id);
create index if not exists idx_boq_headers_project_id on public.boq_headers(project_id);
create index if not exists idx_boq_headers_design_id on public.boq_headers(design_id);
create index if not exists idx_boq_lines_boq_header_id on public.boq_lines(boq_header_id);
create index if not exists idx_boq_lines_material_id on public.boq_lines(material_id);
create index if not exists idx_cost_components_boq_line_id on public.cost_components(boq_line_id);
create index if not exists idx_quotations_project_id on public.quotations(project_id);
create index if not exists idx_quotations_design_id on public.quotations(design_id);
create index if not exists idx_quotations_status on public.quotations(status);
create index if not exists idx_quotation_revisions_quotation_id on public.quotation_revisions(quotation_id);
create index if not exists idx_negotiation_logs_quotation_id on public.negotiation_logs(quotation_id);
create index if not exists idx_vendor_brand_mapping_vendor_id on public.vendor_brand_mapping(vendor_id);
create index if not exists idx_vendor_prices_vendor_id on public.vendor_prices(vendor_id);
create index if not exists idx_vendor_prices_material_code on public.vendor_prices(material_code);
create index if not exists idx_assets_current_project_id on public.assets(current_project_id);
create index if not exists idx_boq_contracts_project_id on public.boq_contracts(project_id);
create index if not exists idx_boq_contracts_quotation_id on public.boq_contracts(quotation_id);

create unique index if not exists idx_designs_one_final_ifc_per_project
    on public.designs(project_id)
    where is_final_ifc = true;

create unique index if not exists idx_quotations_one_approved_per_project
    on public.quotations(project_id)
    where status = 'approved';

-- ------------------------------------------------------------
-- Approval automation
-- ------------------------------------------------------------
create or replace function public.finalize_approved_quotation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_boq_header_id uuid;
begin
    if new.status <> 'approved' or coalesce(old.status::text, '') = 'approved' then
        return new;
    end if;

    update public.projects
    set status = 'current',
        updated_at = now()
    where id = new.project_id
      and status = 'enquiry';

    update public.designs
    set is_final_ifc = false,
        updated_at = now()
    where project_id = new.project_id
      and id <> new.design_id
      and is_final_ifc = true;

    update public.designs
    set approval_status = 'approved',
        is_final_ifc = true,
        is_locked = true,
        finalized_at = now(),
        updated_at = now()
    where id = new.design_id;

    select bh.id
      into v_boq_header_id
    from public.boq_headers bh
    where bh.project_id = new.project_id
      and bh.design_id = new.design_id
    order by bh.version_no desc, bh.created_at desc
    limit 1;

    if v_boq_header_id is not null then
        insert into public.boq_contracts (
            project_id,
            quotation_id,
            design_id,
            boq_line_id,
            contract_version_no,
            line_no,
            material_id,
            description,
            category,
            qty,
            uom,
            rate,
            sap_breakup_required,
            locked_at
        )
        select
            new.project_id,
            new.id,
            new.design_id,
            bl.id,
            new.version_no,
            bl.line_no,
            bl.material_id,
            coalesce(bl.description, m.description, 'BOQ line ' || bl.line_no::text),
            bl.category,
            bl.qty,
            bl.uom,
            bl.rate,
            bl.sap_breakup_required,
            now()
        from public.boq_lines bl
        left join public.materials m on m.id = bl.material_id
        where bl.boq_header_id = v_boq_header_id
        on conflict (quotation_id, boq_line_id) do update
        set contract_version_no = excluded.contract_version_no,
            line_no = excluded.line_no,
            material_id = excluded.material_id,
            description = excluded.description,
            category = excluded.category,
            qty = excluded.qty,
            uom = excluded.uom,
            rate = excluded.rate,
            sap_breakup_required = excluded.sap_breakup_required,
            locked_at = excluded.locked_at,
            updated_at = now();
    end if;

    update public.quotations
    set approved_at = coalesce(approved_at, now()),
        updated_at = now()
    where id = new.id;

    return new;
end;
$$;

drop trigger if exists trg_quotations_finalize on public.quotations;
create trigger trg_quotations_finalize
after update of status on public.quotations
for each row execute function public.finalize_approved_quotation();

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
do $$
declare
    tbl text;
    tables text[] := array[
        'customers',
        'projects',
        'interactions',
        'materials',
        'vendors',
        'vendor_brand_mapping',
        'vendor_prices',
        'assets',
        'labor_rates',
        'designs',
        'boq_headers',
        'boq_lines',
        'cost_components',
        'quotations',
        'quotation_revisions',
        'negotiation_logs',
        'boq_contracts'
    ];
begin
    foreach tbl in array tables loop
        execute format('drop trigger if exists trg_%I_updated_at on public.%I', tbl, tbl);
        execute format(
            'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
            tbl,
            tbl
        );
    end loop;
end $$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.interactions enable row level security;
alter table public.materials enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_brand_mapping enable row level security;
alter table public.vendor_prices enable row level security;
alter table public.assets enable row level security;
alter table public.labor_rates enable row level security;
alter table public.designs enable row level security;
alter table public.boq_headers enable row level security;
alter table public.boq_lines enable row level security;
alter table public.cost_components enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_revisions enable row level security;
alter table public.negotiation_logs enable row level security;
alter table public.boq_contracts enable row level security;

drop policy if exists "customers_select_team" on public.customers;
create policy "customers_select_team" on public.customers
for select using (auth.uid() is not null);

drop policy if exists "customers_write_team" on public.customers;
create policy "customers_write_team" on public.customers
for all using (
    exists (
        select 1
        from public.profiles p
        where p.auth_user_id = auth.uid()
          and p.role in ('admin', 'member')
    )
)
with check (
    exists (
        select 1
        from public.profiles p
        where p.auth_user_id = auth.uid()
          and p.role in ('admin', 'member')
    )
);

drop policy if exists "interactions_select_members" on public.interactions;
create policy "interactions_select_members" on public.interactions
for select using (public.is_project_member(project_id));

drop policy if exists "interactions_write_members" on public.interactions;
create policy "interactions_write_members" on public.interactions
for all using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "materials_select_team" on public.materials;
create policy "materials_select_team" on public.materials
for select using (auth.uid() is not null);

drop policy if exists "materials_write_admin" on public.materials;
create policy "materials_write_admin" on public.materials
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vendors_select_team" on public.vendors;
create policy "vendors_select_team" on public.vendors
for select using (auth.uid() is not null);

drop policy if exists "vendors_write_admin" on public.vendors;
create policy "vendors_write_admin" on public.vendors
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vendor_brand_mapping_select_team" on public.vendor_brand_mapping;
create policy "vendor_brand_mapping_select_team" on public.vendor_brand_mapping
for select using (auth.uid() is not null);

drop policy if exists "vendor_brand_mapping_write_admin" on public.vendor_brand_mapping;
create policy "vendor_brand_mapping_write_admin" on public.vendor_brand_mapping
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vendor_prices_select_team" on public.vendor_prices;
create policy "vendor_prices_select_team" on public.vendor_prices
for select using (auth.uid() is not null);

drop policy if exists "vendor_prices_write_admin" on public.vendor_prices;
create policy "vendor_prices_write_admin" on public.vendor_prices
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assets_select_team" on public.assets;
create policy "assets_select_team" on public.assets
for select using (auth.uid() is not null);

drop policy if exists "assets_write_admin" on public.assets;
create policy "assets_write_admin" on public.assets
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "labor_rates_select_team" on public.labor_rates;
create policy "labor_rates_select_team" on public.labor_rates
for select using (auth.uid() is not null);

drop policy if exists "labor_rates_write_admin" on public.labor_rates;
create policy "labor_rates_write_admin" on public.labor_rates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "designs_select_members" on public.designs;
create policy "designs_select_members" on public.designs
for select using (public.is_project_member(project_id));

drop policy if exists "designs_write_members" on public.designs;
create policy "designs_write_members" on public.designs
for all using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "boq_headers_select_members" on public.boq_headers;
create policy "boq_headers_select_members" on public.boq_headers
for select using (public.is_project_member(project_id));

drop policy if exists "boq_headers_write_members" on public.boq_headers;
create policy "boq_headers_write_members" on public.boq_headers
for all using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "boq_lines_select_members" on public.boq_lines;
create policy "boq_lines_select_members" on public.boq_lines
for select using (
    exists (
        select 1
        from public.boq_headers bh
        where bh.id = boq_header_id
          and public.is_project_member(bh.project_id)
    )
);

drop policy if exists "boq_lines_write_members" on public.boq_lines;
create policy "boq_lines_write_members" on public.boq_lines
for all using (
    exists (
        select 1
        from public.boq_headers bh
        where bh.id = boq_header_id
          and public.is_project_member(bh.project_id)
    )
)
with check (
    exists (
        select 1
        from public.boq_headers bh
        where bh.id = boq_header_id
          and public.is_project_member(bh.project_id)
    )
);

drop policy if exists "cost_components_select_members" on public.cost_components;
create policy "cost_components_select_members" on public.cost_components
for select using (
    exists (
        select 1
        from public.boq_lines bl
        join public.boq_headers bh on bh.id = bl.boq_header_id
        where bl.id = boq_line_id
          and public.is_project_member(bh.project_id)
    )
);

drop policy if exists "cost_components_write_members" on public.cost_components;
create policy "cost_components_write_members" on public.cost_components
for all using (
    exists (
        select 1
        from public.boq_lines bl
        join public.boq_headers bh on bh.id = bl.boq_header_id
        where bl.id = boq_line_id
          and public.is_project_member(bh.project_id)
    )
)
with check (
    exists (
        select 1
        from public.boq_lines bl
        join public.boq_headers bh on bh.id = bl.boq_header_id
        where bl.id = boq_line_id
          and public.is_project_member(bh.project_id)
    )
);

drop policy if exists "quotations_select_members" on public.quotations;
create policy "quotations_select_members" on public.quotations
for select using (public.is_project_member(project_id));

drop policy if exists "quotations_write_members" on public.quotations;
create policy "quotations_write_members" on public.quotations
for all using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "quotation_revisions_select_members" on public.quotation_revisions;
create policy "quotation_revisions_select_members" on public.quotation_revisions
for select using (
    exists (
        select 1
        from public.quotations q
        where q.id = quotation_id
          and public.is_project_member(q.project_id)
    )
);

drop policy if exists "quotation_revisions_write_members" on public.quotation_revisions;
create policy "quotation_revisions_write_members" on public.quotation_revisions
for all using (
    exists (
        select 1
        from public.quotations q
        where q.id = quotation_id
          and public.is_project_member(q.project_id)
    )
)
with check (
    exists (
        select 1
        from public.quotations q
        where q.id = quotation_id
          and public.is_project_member(q.project_id)
    )
);

drop policy if exists "negotiation_logs_select_members" on public.negotiation_logs;
create policy "negotiation_logs_select_members" on public.negotiation_logs
for select using (
    exists (
        select 1
        from public.quotations q
        where q.id = quotation_id
          and public.is_project_member(q.project_id)
    )
);

drop policy if exists "negotiation_logs_write_members" on public.negotiation_logs;
create policy "negotiation_logs_write_members" on public.negotiation_logs
for all using (
    exists (
        select 1
        from public.quotations q
        where q.id = quotation_id
          and public.is_project_member(q.project_id)
    )
)
with check (
    exists (
        select 1
        from public.quotations q
        where q.id = quotation_id
          and public.is_project_member(q.project_id)
    )
);

drop policy if exists "boq_contracts_select_members" on public.boq_contracts;
create policy "boq_contracts_select_members" on public.boq_contracts
for select using (public.is_project_member(project_id));

drop policy if exists "boq_contracts_write_admin" on public.boq_contracts;
create policy "boq_contracts_write_admin" on public.boq_contracts
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

-- ------------------------------------------------------------
-- Optional backfill from the legacy single-project masters
-- ------------------------------------------------------------
do $$
begin
    if to_regclass('public.material_master') is not null then
        insert into public.materials (code, description, category, uom, standard_cost)
        select
            mm.material_code,
            mm.material_description,
            case lower(coalesce(mm.category, 'raw'))
                when 'raw' then 'raw'::material_category
                when 'consumable' then 'consumable'::material_category
                when 'equipment' then 'equipment'::material_category
                when 'finished' then 'finished'::material_category
                else 'raw'::material_category
            end,
            mm.uom,
            0
        from public.material_master mm
        on conflict (code) do nothing;
    end if;

    if to_regclass('public.vendor_master') is not null then
        insert into public.vendors (name, type, contact_person, phone, email, address, payment_terms, gst_no)
        select
            vm.vendor_name,
            case lower(coalesce(vm.category, 'dealer'))
                when 'material' then 'dealer'::vendor_type
                when 'service' then 'retailer'::vendor_type
                when 'subcontract' then 'dealer'::vendor_type
                when 'equipment' then 'manufacturer'::vendor_type
                else 'dealer'::vendor_type
            end,
            vm.contact_person,
            vm.phone,
            vm.email,
            vm.address,
            vm.payment_terms::text,
            vm.gst_no
        from public.vendor_master vm
        on conflict (name) do nothing;
    end if;
end $$;
