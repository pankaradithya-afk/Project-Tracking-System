import { supabase } from '@/lib/supabase'
import type { ProjectMember, Task, TaskPriority, TaskStatus } from '@/types'
import { calculateProgress } from './projectService'
import { createNotificationsForUsers } from './notificationService'
import { getCurrentProfile, isDeadlineSoon, normalizeTaskStatus, requireRoles } from './helpers'

export type CreateTaskInput = Pick<Task, 'project_id' | 'title' | 'description' | 'priority' | 'due_date' | 'assigned_to'> & Partial<Pick<Task, 'status' | 'sort_order' | 'completed_at'>>
export type UpdateTaskInput = Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assigned_to' | 'due_date' | 'sort_order' | 'completed_at' | 'deleted_at'>>

const priorityOrder: Record<TaskPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
}

async function fetchTask(id: string): Promise<Task> {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status))')
        .eq('id', id)
        .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Task not found')
    return data as unknown as Task
}

async function fetchTaskDependencies(taskId: string): Promise<Task[]> {
    const { data, error } = await supabase
        .from('task_dependencies')
        .select('dependency_task:tasks(id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at))')
        .eq('task_id', taskId)

    if (error) throw error
    return ((data ?? []).map((row) => Array.isArray(row.dependency_task) ? row.dependency_task[0] : row.dependency_task).filter(Boolean) as unknown as Task[])
}

async function getProjectRecipients(projectId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)

    if (error) throw error
    return (data ?? []).map((member: Pick<ProjectMember, 'user_id'>) => member.user_id)
}

async function notifyAssignment(task: Task): Promise<void> {
    if (!task.assigned_to) return

    const actor = await getCurrentProfile()
    await createNotificationsForUsers([
        {
            user_id: task.assigned_to,
            project_id: task.project_id,
            task_id: task.id,
            type: 'task_assigned',
            title: `Task assigned: ${task.title}`,
            message: `${actor?.full_name ?? actor?.email ?? 'A teammate'} assigned you a task.`,
        },
    ])
}

async function notifyCompletion(task: Task): Promise<void> {
    const recipient = task.assigned_to ?? task.created_by
    await createNotificationsForUsers([
        {
            user_id: recipient,
            project_id: task.project_id,
            task_id: task.id,
            type: 'task_completed',
            title: `Task completed: ${task.title}`,
            message: `Task "${task.title}" has been marked as done.`,
        },
    ])
}

async function syncDeadlineNotifications(task: Task): Promise<void> {
    if (!isDeadlineSoon(task.due_date) || task.status === 'done') return

    const recipient = task.assigned_to ?? task.created_by
    const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', recipient)
        .eq('task_id', task.id)
        .eq('type', 'deadline_approaching')
        .is('read_at', null)
        .limit(1)

    if (error) throw error
    if ((data ?? []).length > 0) return

    await createNotificationsForUsers([
        {
            user_id: recipient,
            project_id: task.project_id,
            task_id: task.id,
            type: 'deadline_approaching',
            title: `Deadline approaching: ${task.title}`,
            message: `Task "${task.title}" is due within 24 hours.`,
        },
    ])
}

async function validateDoneDependencies(taskId: string): Promise<void> {
    const dependencies = await fetchTaskDependencies(taskId)
    const incomplete = dependencies.filter((dependency) => dependency.status !== 'done')

    if (incomplete.length > 0) {
        const labels = incomplete.map((dependency) => dependency.title).join(', ')
        throw new Error(`Cannot mark task as done. Incomplete dependencies: ${labels}.`)
    }
}

async function getNextSortOrder(projectId: string): Promise<number> {
    const { data, error } = await supabase
        .from('tasks')
        .select('sort_order')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)

    if (error) throw error
    return (data?.[0]?.sort_order ?? 0) + 1
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status))')
        .eq('project_id', projectId)
        .is('deleted_at', null)

    if (error) throw error

    const tasks = ((data ?? []) as unknown as Task[]).sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
        const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
        if (dueA !== dueB) return dueA - dueB
        return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    await Promise.all(tasks.map((task) => syncDeadlineNotifications(task).catch((error) => {
        console.error('Deadline notification sync failed', error)
        return undefined
    })))

    return tasks
}

export async function getTask(id: string): Promise<Task> {
    return fetchTask(id)
}

export async function createTask(task: CreateTaskInput): Promise<Task> {
    const actor = await requireRoles(['admin', 'member'])

    if (!task.title?.trim()) throw new Error('Task title is required.')
    if (!task.project_id) throw new Error('Project id is required.')

    const payload = {
        project_id: task.project_id,
        title: task.title.trim(),
        description: task.description?.trim() || null,
        status: normalizeTaskStatus(task.status ?? 'todo'),
        priority: task.priority ?? 'medium',
        assigned_to: task.assigned_to ?? null,
        due_date: task.due_date ?? null,
        completed_at: task.status === 'done' ? new Date().toISOString() : null,
        sort_order: task.sort_order ?? (await getNextSortOrder(task.project_id)),
        created_by: actor.id,
    }

    const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select('id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status))')
        .single()

    if (error) throw error

    const created = data as unknown as Task
    await Promise.all([
        notifyAssignment(created),
        syncDeadlineNotifications(created),
        calculateProgress(task.project_id),
    ])

    return created
}

export async function updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    await requireRoles(['admin', 'member'])

    const current = await fetchTask(id)
    const nextStatus = updates.status ? normalizeTaskStatus(updates.status) : current.status
    const payload: UpdateTaskInput = {
        ...updates,
        status: nextStatus,
        title: updates.title?.trim(),
        description: updates.description?.trim() ?? updates.description,
    }

    if (updates.assigned_to !== undefined && updates.assigned_to !== current.assigned_to) {
        payload.assigned_to = updates.assigned_to
    }
    if (nextStatus === 'done') {
        await validateDoneDependencies(id)
        payload.completed_at = updates.completed_at ?? new Date().toISOString()
    } else if (current.completed_at) {
        payload.completed_at = null
    }

    const { data, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .is('deleted_at', null)
        .select('id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status))')
        .single()

    if (error) throw error

    const updated = data as unknown as Task
    const effects: Promise<unknown>[] = [calculateProgress(updated.project_id), syncDeadlineNotifications(updated)]
    if (current.assigned_to !== updated.assigned_to && updated.assigned_to) {
        effects.push(notifyAssignment(updated))
    }
    if (current.status !== 'done' && updated.status === 'done') {
        effects.push(notifyCompletion(updated))
    }

    await Promise.all(effects)
    return updated
}

export async function deleteTask(id: string): Promise<void> {
    await requireRoles(['admin', 'member'])
    const task = await fetchTask(id)
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
    await calculateProgress(task.project_id)
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    await requireRoles(['admin', 'member'])

    const nextStatus = normalizeTaskStatus(status)
    if (nextStatus === 'done') {
        await validateDoneDependencies(id)
    }

    const { data, error } = await supabase
        .from('tasks')
        .update({
            status: nextStatus,
            completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select('id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by, created_at, updated_at, deleted_at, assignee:profiles(id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at), dependencies:task_dependencies(id, task_id, dependency_task_id, created_at, dependency_task:tasks(id, title, status))')
        .single()

    if (error) throw error

    const updated = data as unknown as Task
    const effects: Promise<unknown>[] = [calculateProgress(updated.project_id), syncDeadlineNotifications(updated)]
    if (nextStatus === 'done') effects.push(notifyCompletion(updated))
    await Promise.all(effects)
    return updated
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
    await requireRoles(['admin', 'member'])
    await Promise.all(taskIds.map((taskId, index) =>
        supabase.from('tasks').update({ sort_order: index + 1 }).eq('id', taskId)
    ))
}
