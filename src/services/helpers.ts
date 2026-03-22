import { differenceInHours, isAfter } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Project, ProjectMember, Task, User, UserRole } from '@/types'

export type SessionProfile = User | null

export async function getCurrentProfile(): Promise<SessionProfile> {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('id, auth_user_id, full_name, email, role, avatar_url, is_active, created_at, updated_at')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle()

    if (error || !data) {
        return {
            id: authData.user.id,
            auth_user_id: authData.user.id,
            full_name: authData.user.user_metadata?.full_name ?? authData.user.email ?? null,
            email: authData.user.email ?? '',
            role: 'viewer',
            avatar_url: authData.user.user_metadata?.avatar_url ?? null,
            is_active: true,
            created_at: authData.user.created_at,
            updated_at: authData.user.created_at,
        }
    }

    return data as User
}

export async function requireRoles(allowed: UserRole[]): Promise<User> {
    const profile = await getCurrentProfile()
    if (!profile || !allowed.includes(profile.role)) {
        throw new Error('You do not have permission to perform this action.')
    }
    return profile
}

export function mapProjectRow(project: Project & { project_members?: ProjectMember[]; tasks?: Task[] }): Project {
    const tasks = project.tasks ?? []
    const completedTaskCount = tasks.filter((task) => task.status === 'done').length
    const upcomingDeadlineCount = tasks.filter((task) => {
        if (!task.due_date || task.status === 'done') return false
        return isAfter(new Date(task.due_date), new Date()) && differenceInHours(new Date(task.due_date), new Date()) <= 24
    }).length

    return {
        ...project,
        team_members: project.project_members ?? project.team_members,
        task_count: tasks.length,
        completed_task_count: completedTaskCount,
        upcoming_deadline_count: upcomingDeadlineCount,
        progress: project.progress ?? (tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : 0),
    }
}

export function normalizeProjectStatus(status: string): Project['status'] {
    const normalized = status.toLowerCase().replace(/\s+/g, '_')
    if (normalized === 'on_hold' || normalized === 'planning' || normalized === 'active' || normalized === 'completed' || normalized === 'archived') {
        return normalized
    }
    return 'planning'
}

export function normalizeTaskStatus(status: string): Task['status'] {
    const normalized = status.toLowerCase().replace(/\s+/g, '_')
    if (normalized === 'todo' || normalized === 'in_progress' || normalized === 'review' || normalized === 'done') {
        return normalized
    }
    return 'todo'
}

export function isDeadlineSoon(dueDate: string | null): boolean {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    return isAfter(due, now) && differenceInHours(due, now) <= 24
}

