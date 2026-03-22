import { supabase } from '@/lib/supabase'
import type { Project, ProjectStatus, ProjectMember, Task } from '@/types'
import { mapProjectRow, normalizeProjectStatus, requireRoles } from './helpers'
import { createNotificationsForUsers } from './notificationService'

export type CreateProjectInput = Pick<Project, 'name' | 'description' | 'status' | 'start_date' | 'end_date'> & Partial<Pick<Project, 'progress'>>
export type UpdateProjectInput = Partial<Pick<Project, 'name' | 'description' | 'status' | 'start_date' | 'end_date' | 'progress' | 'archived_at' | 'deleted_at'>>

const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
    planning: ['active', 'on_hold', 'archived'],
    active: ['on_hold', 'completed', 'archived'],
    on_hold: ['active', 'archived'],
    completed: ['archived'],
    archived: [],
}

async function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
        .from('project_members')
        .select('id, project_id, user_id, role, joined_at, user:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at)')
        .eq('project_id', projectId)

    if (error) throw error
    return (data ?? []) as unknown as ProjectMember[]
}

export async function getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at, project_members(id, project_id, user_id, role, joined_at, user:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at)), tasks(id, status, deleted_at)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((project) => {
        const projectTasks = (project.tasks ?? []).filter((task) => !task.deleted_at)
        const completedTaskCount = projectTasks.filter((task) => task.status === 'done').length
        const progress = projectTasks.length > 0 ? Math.round((completedTaskCount / projectTasks.length) * 100) : (project.progress ?? 0)
        return mapProjectRow({
            ...(project as unknown as Project & { project_members?: ProjectMember[]; tasks?: Task[] }),
            progress,
            tasks: projectTasks as unknown as Task[],
        })
    })
}

export async function getProject(id: string): Promise<Project> {
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

export async function createProject(project: CreateProjectInput): Promise<Project> {
    const actor = await requireRoles(['admin'])

    if (!project.name?.trim()) throw new Error('Project name is required.')
    if (!project.start_date) throw new Error('Project start date is required.')

    const payload = {
        name: project.name.trim(),
        description: project.description?.trim() || null,
        status: normalizeProjectStatus(project.status ?? 'planning'),
        start_date: project.start_date,
        end_date: project.end_date || null,
        progress: project.progress ?? 0,
        created_by: actor.id,
    }

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
}

export async function updateProject(id: string, updates: UpdateProjectInput): Promise<Project> {
    await requireRoles(['admin'])

    const payload: UpdateProjectInput = { ...updates }
    if (payload.status) payload.status = normalizeProjectStatus(payload.status)
    if (payload.name) payload.name = payload.name.trim()
    if (payload.description) payload.description = payload.description.trim()

    const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id)
        .is('deleted_at', null)
        .select('id, name, description, status, start_date, end_date, progress, created_by, created_at, updated_at, deleted_at, archived_at')
        .single()

    if (error) throw error
    return mapProjectRow(data as unknown as Project)
}

export async function deleteProject(id: string): Promise<void> {
    await requireRoles(['admin'])
    const now = new Date().toISOString()
    const { error } = await supabase
        .from('projects')
        .update({ deleted_at: now, archived_at: now, status: 'archived' })
        .eq('id', id)

    if (error) throw error
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
    const actor = await requireRoles(['admin'])

    const { data: currentProject, error: currentError } = await supabase
        .from('projects')
        .select('id, status')
        .eq('id', id)
        .maybeSingle()

    if (currentError) throw currentError
    if (!currentProject) throw new Error('Project not found')

    const normalizedStatus = normalizeProjectStatus(status)
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

    const members = await fetchProjectMembers(id)
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

    return mapProjectRow(data as unknown as Project)
}

export async function calculateProgress(projectId: string): Promise<number> {
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
        updatePayload.status = 'completed'
    }

    const { error: updateError } = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', projectId)

    if (updateError) throw updateError
    return progress
}
