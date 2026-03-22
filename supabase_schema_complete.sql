-- ============================================================
-- Project Tracking System complete schema
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_type where typname = 'project_status') then
        create type project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
    end if;

    if not exists (select 1 from pg_type where typname = 'task_status') then
        create type task_status as enum ('todo', 'in_progress', 'review', 'done');
    end if;

    if not exists (select 1 from pg_type where typname = 'task_priority') then
        create type task_priority as enum ('low', 'medium', 'high', 'urgent');
    end if;

    if not exists (select 1 from pg_type where typname = 'user_role') then
        create type user_role as enum ('admin', 'member', 'viewer');
    end if;
end $$;

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
    select coalesce((select role::text from public.profiles where auth_user_id = auth.uid()), 'viewer');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select public.current_profile_role() = 'admin';
$$;

create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.project_members pm
        join public.profiles p on p.id = pm.user_id
        where pm.project_id = project_uuid
          and p.auth_user_id = auth.uid()
    ) or public.is_admin();
$$;

create or replace function public.is_project_admin(project_uuid uuid)
returns boolean
language sql
stable
as $$
    select public.is_admin() or exists (
        select 1
        from public.project_members pm
        join public.profiles p on p.id = pm.user_id
        where pm.project_id = project_uuid
          and p.auth_user_id = auth.uid()
          and pm.role = 'admin'
    );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, auth_user_id, full_name, email, role, avatar_url)
    values (
        new.id,
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', new.email),
        coalesce(new.email, ''),
        coalesce((new.raw_user_meta_data->>'role')::user_role, 'viewer'),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (auth_user_id) do nothing;

    return new;
end;
$$;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    full_name text,
    email text not null,
    role user_role not null default 'viewer',
    avatar_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    status project_status not null default 'planning',
    start_date date not null,
    end_date date,
    progress numeric(5,2) not null default 0,
    created_by uuid not null references public.profiles(id) on delete restrict,
    deleted_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role user_role not null default 'member',
    joined_at timestamptz not null default now(),
    unique (project_id, user_id)
);

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    title text not null,
    description text,
    status task_status not null default 'todo',
    priority task_priority not null default 'medium',
    assigned_to uuid references public.profiles(id) on delete set null,
    due_date date,
    completed_at timestamptz,
    sort_order integer not null default 0,
    created_by uuid not null references public.profiles(id) on delete restrict,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    dependency_task_id uuid not null references public.tasks(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (task_id, dependency_task_id),
    constraint task_dependency_not_self check (task_id <> dependency_task_id)
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    task_id uuid references public.tasks(id) on delete cascade,
    type text not null,
    title text not null,
    message text not null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.project_stages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    description text,
    sort_order integer not null default 0,
    is_default boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Progress calculation
-- ------------------------------------------------------------
create or replace function public.calculate_project_progress(project_uuid uuid)
returns numeric
language plpgsql
as $$
declare
    total_tasks integer;
    completed_tasks integer;
    progress_value numeric;
begin
    select count(*), count(*) filter (where status = 'done')
    into total_tasks, completed_tasks
    from public.tasks
    where project_id = project_uuid
      and deleted_at is null;

    if total_tasks = 0 then
        progress_value := 0;
    else
        progress_value := round((completed_tasks::numeric / total_tasks::numeric) * 100, 2);
    end if;

    update public.projects
    set progress = progress_value,
        status = case
            when progress_value = 100 and status <> 'archived' then 'completed'
            else status
        end,
        updated_at = now()
    where id = project_uuid;

    return progress_value;
end;
$$;

create or replace function public.sync_project_progress()
returns trigger
language plpgsql
as $$
begin
    perform public.calculate_project_progress(coalesce(new.project_id, old.project_id));
    return coalesce(new, old);
end;
$$;

create or replace function public.sync_task_notifications()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' and new.assigned_to is not null then
        insert into public.notifications (user_id, project_id, task_id, type, title, message)
        values (new.assigned_to, new.project_id, new.id, 'task_assigned', 'Task assigned: ' || new.title, 'You have been assigned a new task.');
    end if;

    if tg_op = 'UPDATE' and old.status <> 'done' and new.status = 'done' then
        insert into public.notifications (user_id, project_id, task_id, type, title, message)
        values (coalesce(new.assigned_to, new.created_by), new.project_id, new.id, 'task_completed', 'Task completed: ' || new.title, 'A task has been marked as done.');
    end if;

    return new;
end;
$$;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_project_stages_updated_at on public.project_stages;
create trigger trg_project_stages_updated_at
before update on public.project_stages
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists trg_tasks_progress on public.tasks;
create trigger trg_tasks_progress
after insert or update or delete on public.tasks
for each row execute function public.sync_project_progress();

drop trigger if exists trg_tasks_notifications on public.tasks;
create trigger trg_tasks_notifications
after insert or update on public.tasks
for each row execute function public.sync_task_notifications();

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_created_by on public.projects(created_by);
create index if not exists idx_projects_deleted_at on public.projects(deleted_at);
create index if not exists idx_project_members_project_id on public.project_members(project_id);
create index if not exists idx_project_members_user_id on public.project_members(user_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_deleted_at on public.tasks(deleted_at);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read_at on public.notifications(read_at);
create index if not exists idx_project_stages_project_id on public.project_stages(project_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.notifications enable row level security;
alter table public.project_stages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
for insert with check (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = auth_user_id or public.is_admin())
with check (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists "projects_select_members" on public.projects;
create policy "projects_select_members" on public.projects
for select using (public.is_project_member(id));

drop policy if exists "projects_insert_admin" on public.projects;
create policy "projects_insert_admin" on public.projects
for insert with check (public.is_admin());

drop policy if exists "projects_update_admin" on public.projects;
create policy "projects_update_admin" on public.projects
for update using (public.is_project_admin(id))
with check (public.is_project_admin(id));

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin" on public.projects
for delete using (public.is_project_admin(id));

drop policy if exists "project_members_select_members" on public.project_members;
create policy "project_members_select_members" on public.project_members
for select using (public.is_project_member(project_id));

drop policy if exists "project_members_write_admin" on public.project_members;
create policy "project_members_write_admin" on public.project_members
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));

drop policy if exists "tasks_select_members" on public.tasks;
create policy "tasks_select_members" on public.tasks
for select using (public.is_project_member(project_id));

drop policy if exists "tasks_insert_members" on public.tasks;
create policy "tasks_insert_members" on public.tasks
for insert with check (public.is_project_member(project_id));

drop policy if exists "tasks_update_members" on public.tasks;
create policy "tasks_update_members" on public.tasks
for update using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "tasks_delete_members" on public.tasks;
create policy "tasks_delete_members" on public.tasks
for delete using (public.is_project_member(project_id));

drop policy if exists "task_dependencies_select_members" on public.task_dependencies;
create policy "task_dependencies_select_members" on public.task_dependencies
for select using (exists (
    select 1
    from public.tasks t
    where t.id = task_id and public.is_project_member(t.project_id)
));

drop policy if exists "task_dependencies_write_members" on public.task_dependencies;
create policy "task_dependencies_write_members" on public.task_dependencies
for all using (exists (
    select 1
    from public.tasks t
    where t.id = task_id and public.is_project_member(t.project_id)
))
with check (exists (
    select 1
    from public.tasks t
    where t.id = task_id and public.is_project_member(t.project_id)
));

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select using (user_id in (select id from public.profiles where auth_user_id = auth.uid()) or public.is_admin());

drop policy if exists "notifications_insert_members" on public.notifications;
create policy "notifications_insert_members" on public.notifications
for insert with check (
    public.is_admin()
    or exists (
        select 1
        from public.projects p
        where p.id = project_id and public.is_project_member(p.id)
    )
);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update using (user_id in (select id from public.profiles where auth_user_id = auth.uid()) or public.is_admin())
with check (user_id in (select id from public.profiles where auth_user_id = auth.uid()) or public.is_admin());

drop policy if exists "project_stages_select_members" on public.project_stages;
create policy "project_stages_select_members" on public.project_stages
for select using (public.is_project_member(project_id));

drop policy if exists "project_stages_write_admin" on public.project_stages;
create policy "project_stages_write_admin" on public.project_stages
for all using (public.is_project_admin(project_id))
with check (public.is_project_admin(project_id));
