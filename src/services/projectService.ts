import { supabase } from '@/lib/supabase'
import type { Project, ProjectStatus, ProjectMember, Task } from '@/types'
import { generateProjectId } from '@/lib/utils'
import { encodeLegacyProjectIntake, getProjectSummary, getProjectTitle, mapProjectRow, normalizeLegacyProjectStatus, normalizeProjectStatus, requireRoles } from './helpers'
import { createNotificationsForUsers } from './notificationService'

export type CreateProjectInput = Pick<Project, 'name' | 'description' | 'status' | 'start_date' | 'end_date'> & Partial<Pick<Project, 'progress' | 'client' | 'client_contact' | 'location' | 'wo_number' | 'wo_date' | 'wo_value' | 'scope_of_works' | 'team_plan' | 'work_plan' | 'wo_received_date' | 'order_value'>>
export type UpdateProjectInput = Partial<Pick<Project, 'name' | 'description' | 'status' | 'start_date' | 'end_date' | 'progress' | 'archived_at' | 'deleted_at' | 'client' | 'client_contact' | 'location' | 'wo_number' | 'wo_date' | 'wo_value' | 'scope_of_works' | 'team_plan' | 'work_plan' | 'wo_received_date' | 'order_value'>>

const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
    enquiry: ['upcoming', 'current', 'archived'],
    upcoming: ['current', 'archived'],
    current: ['finished', 'archived'],
    finished: ['archived'],
    archived: [],
    planning: ['upcoming', 'current', 'archived'],
    active: ['finished', 'archived'],
    on_hold: ['current', 'archived'],
    completed: ['archived'],
}

async function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
        .from('project_members')
        .select('id, project_id, user_id, role, joined_at, user:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at)')
        .eq('project_id', projectId)

    if (error) throw error
    return (data ?? []) as unknown as ProjectMember[]
}

async function fetchProjectsNew(): Promise<Project[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at, project_members(id, project_id, user_id, role, joined_at, user:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at)), tasks(id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status)))')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((project) => mapProjectRow(project as unknown as Project & { project_members?: ProjectMember[]; tasks?: Task[] }))
}

async function fetchProjectsLegacy(): Promise<Project[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('id, project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks, created_at, updated_at')
        .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((project) => mapProjectRow({
        ...(project as unknown as Project),
        name: getProjectTitle(project as unknown as Project),
        description: getProjectSummary(project as unknown as Project),
        start_date: (project as { wo_date?: string }).wo_date ?? new Date().toISOString().slice(0, 10),
        end_date: null,
        status: normalizeLegacyProjectStatus((project as { status?: string }).status),
        progress: normalizeLegacyProjectStatus((project as { status?: string }).status) === 'finished' ? 100 : normalizeLegacyProjectStatus((project as { status?: string }).status) === 'current' ? 50 : 0,
        created_by: '',
    } as Project))
}

async function fetchProjectByIdNew(id: string): Promise<Project> {
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at, project_members(id, project_id, user_id, role, joined_at, user:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at)), tasks(id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status)))')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Project not found')
    return mapProjectRow(data as unknown as Project & { project_members?: ProjectMember[]; tasks?: Task[] })
}

async function fetchProjectByIdLegacy(id: string): Promise<Project> {
    const { data, error } = await supabase
        .from('projects')
        .select('id, project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Project not found')
    return mapProjectRow({
        ...(data as unknown as Project),
        name: getProjectTitle(data as unknown as Project),
        description: getProjectSummary(data as unknown as Project),
        start_date: (data as { wo_date?: string }).wo_date ?? new Date().toISOString().slice(0, 10),
        end_date: null,
        status: normalizeLegacyProjectStatus((data as { status?: string }).status),
        progress: normalizeLegacyProjectStatus((data as { status?: string }).status) === 'finished' ? 100 : normalizeLegacyProjectStatus((data as { status?: string }).status) === 'current' ? 50 : 0,
        created_by: '',
    } as Project)
}

export async function getProjects(): Promise<Project[]> {
    try {
        return await fetchProjectsNew()
    } catch (newSchemaError) {
        console.warn('Falling back to legacy project schema', newSchemaError)
        return fetchProjectsLegacy()
    }
}

export async function getProject(id: string): Promise<Project> {
    try {
        return await fetchProjectByIdNew(id)
    } catch (newSchemaError) {
        console.warn('Falling back to legacy project schema', newSchemaError)
        return fetchProjectByIdLegacy(id)
    }
}

export async function createProject(project: CreateProjectInput): Promise<Project> {
    const actor = await requireRoles(['admin'])

    if (!project.name?.trim()) throw new Error('Project name is required.')
    const payload = {
        name: project.name.trim(),
        description: project.description?.trim() || null,
        status: normalizeProjectStatus(project.status ?? 'enquiry'),
        start_date: project.start_date || project.wo_received_date || project.wo_date || new Date().toISOString().slice(0, 10),
        end_date: project.end_date || null,
        progress: project.progress ?? 0,
        created_by: actor.id,
    }

    try {
        const { data, error } = await supabase
            .from('projects')
            .insert(payload)
            .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at')
            .single()

        if (error) throw error

        const { error: memberError } = await supabase
            .from('project_members')
            .insert({
                project_id: data.id,
                user_id: actor.id,
                role: 'admin',
            })

        if (memberError) throw memberError

        return mapProjectRow(data as unknown as Project)
    } catch (newSchemaError) {
        console.warn('Falling back to legacy project insert', newSchemaError)
        const legacyPayload = {
            project_id: generateProjectId(),
            project_name: project.name.trim(),
            client: project.client?.trim() || 'General',
            client_contact: project.client_contact?.trim() || null,
            location: project.location?.trim() || null,
            wo_number: project.wo_number?.trim() || generateProjectId(),
            wo_date: project.wo_received_date || project.wo_date || project.start_date,
            wo_value: project.wo_value ?? project.order_value ?? 0,
            status: project.status === 'finished' ? 'Completed' : project.status === 'current' ? 'Active' : 'On Hold',
            remarks: encodeLegacyProjectIntake({
                scope_of_works: project.scope_of_works?.trim() || project.description?.trim() || '',
                team_plan: project.team_plan?.trim() || '',
                work_plan: project.work_plan?.trim() || '',
                client_contact: project.client_contact?.trim() || '',
                notes: project.description?.trim() || '',
            }),
        }

        const { data, error } = await supabase
            .from('projects')
            .insert(legacyPayload)
            .select('id, project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks, created_at, updated_at')
            .single()

        if (error) throw error
        return mapProjectRow({
            ...(data as unknown as Project),
            name: legacyPayload.project_name,
            description: project.description?.trim() || project.scope_of_works?.trim() || null,
            start_date: legacyPayload.wo_date,
            end_date: null,
            status: normalizeLegacyProjectStatus(legacyPayload.status),
            progress: normalizeLegacyProjectStatus(legacyPayload.status) === 'finished' ? 100 : normalizeLegacyProjectStatus(legacyPayload.status) === 'current' ? 50 : 0,
            created_by: actor.id,
            client: legacyPayload.client,
            client_contact: legacyPayload.client_contact ?? undefined,
            location: legacyPayload.location ?? undefined,
            wo_number: legacyPayload.wo_number,
            wo_date: legacyPayload.wo_date,
            wo_value: legacyPayload.wo_value,
            scope_of_works: project.scope_of_works,
            team_plan: project.team_plan,
            work_plan: project.work_plan,
            wo_received_date: legacyPayload.wo_date,
            order_value: legacyPayload.wo_value,
        } as Project)
    }
}

export async function updateProject(id: string, updates: UpdateProjectInput): Promise<Project> {
    const actor = await requireRoles(['admin'])

    const payload: UpdateProjectInput = { ...updates }
    if (payload.status) payload.status = normalizeProjectStatus(payload.status)
    if (payload.name) payload.name = payload.name.trim()
    if (payload.description) payload.description = payload.description.trim()

    try {
        const { data, error } = await supabase
            .from('projects')
            .update(payload)
            .eq('id', id)
            .is('deleted_at', null)
            .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at')
            .single()

        if (error) throw error
        return mapProjectRow(data as unknown as Project)
    } catch (newSchemaError) {
        console.warn('Falling back to legacy project update', newSchemaError)
        const legacyPayload: Record<string, unknown> = {}
        if (payload.name) legacyPayload.project_name = payload.name
        if (payload.description !== undefined) legacyPayload.remarks = payload.description
        if (payload.start_date) legacyPayload.wo_date = payload.start_date
        if (payload.status) legacyPayload.status = payload.status === 'finished' ? 'Completed' : payload.status === 'current' ? 'Active' : 'On Hold'
        if (payload.client) legacyPayload.client = payload.client
        if (payload.client_contact !== undefined) legacyPayload.client_contact = payload.client_contact
        if (payload.location !== undefined) legacyPayload.location = payload.location
        if (payload.wo_number !== undefined) legacyPayload.wo_number = payload.wo_number
        if (payload.wo_date !== undefined) legacyPayload.wo_date = payload.wo_date
        if (payload.wo_value !== undefined) legacyPayload.wo_value = payload.wo_value
        if (payload.scope_of_works || payload.team_plan || payload.work_plan || payload.client_contact) {
            legacyPayload.remarks = encodeLegacyProjectIntake({
                scope_of_works: payload.scope_of_works ?? '',
                team_plan: payload.team_plan ?? '',
                work_plan: payload.work_plan ?? '',
                client_contact: payload.client_contact ?? '',
                notes: typeof payload.description === 'string' ? payload.description : '',
            })
        }

        const { data, error } = await supabase
            .from('projects')
            .update(legacyPayload)
            .eq('id', id)
            .select('id, project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks, created_at, updated_at')
            .single()

        if (error) throw error
        return mapProjectRow({
            ...(data as unknown as Project),
            name: (data as { project_name?: string }).project_name,
            description: (data as { remarks?: string }).remarks ?? null,
            start_date: (data as { wo_date?: string }).wo_date ?? new Date().toISOString().slice(0, 10),
            end_date: null,
            status: normalizeLegacyProjectStatus((data as { status?: string }).status),
            progress: normalizeLegacyProjectStatus((data as { status?: string }).status) === 'finished' ? 100 : normalizeLegacyProjectStatus((data as { status?: string }).status) === 'current' ? 50 : 0,
            created_by: actor.id,
            client: (data as { client?: string }).client,
            client_contact: (data as { client_contact?: string | null }).client_contact ?? undefined,
            location: (data as { location?: string | null }).location ?? undefined,
            wo_number: (data as { wo_number?: string }).wo_number,
            wo_date: (data as { wo_date?: string }).wo_date,
            wo_value: (data as { wo_value?: number }).wo_value,
            scope_of_works: payload.scope_of_works,
            team_plan: payload.team_plan,
            work_plan: payload.work_plan,
            wo_received_date: (data as { wo_date?: string }).wo_date,
            order_value: (data as { wo_value?: number }).wo_value,
        } as Project)
    }
}

export async function deleteProject(id: string): Promise<void> {
    await requireRoles(['admin'])
    const now = new Date().toISOString()
    try {
        const { error } = await supabase
            .from('projects')
            .update({ deleted_at: now, archived_at: now, status: 'archived' })
            .eq('id', id)

        if (error) throw error
    } catch (newSchemaError) {
        console.warn('Falling back to hard delete for legacy project schema', newSchemaError)
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (error) throw error
    }
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
    const actor = await requireRoles(['admin'])

    const normalizedStatus = normalizeProjectStatus(status)
    try {
        const { data: currentProject, error: currentError } = await supabase
            .from('projects')
            .select('id, status')
            .eq('id', id)
            .maybeSingle()

        if (currentError) throw currentError
        if (!currentProject) throw new Error('Project not found')

        const allowed = validTransitions[currentProject.status as ProjectStatus] ?? []
        if (currentProject.status !== normalizedStatus && !allowed.includes(normalizedStatus)) {
            throw new Error(`Invalid status transition from ${currentProject.status} to ${normalizedStatus}.`)
        }

        const { data, error } = await supabase
            .from('projects')
            .update({
                status: normalizedStatus,
                archived_at: normalizedStatus === 'archived' ? new Date().toISOString() : null,
            })
            .eq('id', id)
            .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at')
            .single()

        if (error) throw error

        const members = await fetchProjectMembers(id).catch(() => [])
        if (members.length > 0) {
            await createNotificationsForUsers(
                members.map((member) => ({
                    user_id: member.user_id,
                    project_id: id,
                    task_id: null,
                    type: 'project_updated',
                    title: 'Project status changed',
                    message: `Project status changed to ${normalizedStatus} by ${actor.full_name ?? actor.email}.`,
                }))
            )
        }

        return mapProjectRow(data as unknown as Project)
    } catch (newSchemaError) {
        console.warn('Falling back to legacy project status update', newSchemaError)
        const legacyStatus = normalizedStatus === 'finished' ? 'Completed' : normalizedStatus === 'current' ? 'Active' : 'On Hold'
        const { data, error } = await supabase
            .from('projects')
            .update({ status: legacyStatus })
            .eq('id', id)
            .select('id, project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks, created_at, updated_at')
            .single()

        if (error) throw error
        return mapProjectRow({
            ...(data as unknown as Project),
            name: (data as { project_name?: string }).project_name,
            description: (data as { remarks?: string }).remarks ?? null,
            start_date: (data as { wo_date?: string }).wo_date ?? new Date().toISOString().slice(0, 10),
            end_date: null,
            status: normalizeLegacyProjectStatus((data as { status?: string }).status),
            progress: normalizeLegacyProjectStatus((data as { status?: string }).status) === 'finished' ? 100 : normalizeLegacyProjectStatus((data as { status?: string }).status) === 'current' ? 50 : 0,
            created_by: actor.id,
        } as Project)
    }
}

export async function calculateProgress(projectId: string): Promise<number> {
    try {
        const { data: projectRow, error: projectError } = await supabase
            .from('projects')
            .select('id, status')
            .eq('id', projectId)
            .maybeSingle()

        if (projectError) throw projectError

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('id, status, deleted_at')
            .eq('project_id', projectId)
            .is('deleted_at', null)

        if (error) throw error

        const activeTasks = (tasks ?? []).filter((task) => !task.deleted_at)
        const completed = activeTasks.filter((task) => task.status === 'done').length
        const progress = activeTasks.length > 0 ? Math.round((completed / activeTasks.length) * 100) : 0

        const updatePayload: UpdateProjectInput = { progress }
        if (progress === 100 && projectRow?.status !== 'archived') {
            updatePayload.status = 'finished'
        }

        const { error: updateError } = await supabase
            .from('projects')
            .update(updatePayload)
            .eq('id', projectId)

        if (updateError) throw updateError
        return progress
    } catch (error) {
        console.warn('Progress calculation unavailable for legacy schema', error)
        return 0
    }
}
