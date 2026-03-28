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

export type LegacyProjectIntake = {
    scope_of_works?: string
    team_plan?: string
    work_plan?: string
    client_contact?: string
    notes?: string
}

export function decodeLegacyProjectIntake(remarks?: string | null): LegacyProjectIntake {
    if (!remarks) return {}
    try {
        const parsed = JSON.parse(remarks) as LegacyProjectIntake
        if (parsed && typeof parsed === 'object') return parsed
    } catch {
        return { notes: remarks }
    }
    return { notes: remarks }
}

export function encodeLegacyProjectIntake(intake: LegacyProjectIntake): string | null {
    const hasContent = Object.values(intake).some((value) => typeof value === 'string' && value.trim().length > 0)
    if (!hasContent) return null
    return JSON.stringify(intake)
}

export function mapProjectRow(project: Project & { project_members?: ProjectMember[]; tasks?: Task[] }): Project {
    const tasks = project.tasks ?? []
    const completedTaskCount = tasks.filter((task) => task.status === 'done').length
    const upcomingDeadlineCount = tasks.filter((task) => {
        if (!task.due_date || task.status === 'done') return false
        return isAfter(new Date(task.due_date), new Date()) && differenceInHours(new Date(task.due_date), new Date()) <= 24
    }).length

    const status = normalizeProjectStatus(typeof project.status === 'string' ? project.status : 'enquiry')

    const intake = decodeLegacyProjectIntake(project.remarks)

    return {
        ...project,
        name: project.name ?? project.project_name ?? 'Untitled Project',
        description: project.description ?? project.remarks ?? null,
        start_date: project.start_date ?? project.wo_date ?? new Date().toISOString().slice(0, 10),
        end_date: project.end_date ?? null,
        status,
        created_by: project.created_by ?? '',
        client: project.client ?? undefined,
        client_contact: project.client_contact ?? intake.client_contact,
        location: project.location ?? undefined,
        wo_number: project.wo_number ?? undefined,
        wo_date: project.wo_date ?? undefined,
        wo_value: project.wo_value ?? project.order_value,
        scope_of_works: project.scope_of_works ?? intake.scope_of_works ?? project.description ?? project.remarks ?? undefined,
        team_plan: project.team_plan ?? intake.team_plan,
        work_plan: project.work_plan ?? intake.work_plan,
        wo_received_date: project.wo_received_date ?? project.wo_date,
        order_value: project.order_value ?? project.wo_value,
        team_members: project.project_members ?? project.team_members,
        task_count: tasks.length,
        completed_task_count: completedTaskCount,
        upcoming_deadline_count: upcomingDeadlineCount,
        progress: project.progress ?? (tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : (status === 'finished' ? 100 : status === 'current' ? 50 : 0)),
    }
}

export function normalizeProjectStatus(status: string): Project['status'] {
    const normalized = status.toLowerCase().replace(/\s+/g, '_')
    if (normalized === 'enquiry' || normalized === 'upcoming' || normalized === 'current' || normalized === 'finished' || normalized === 'archived') {
        return normalized
    }
    if (normalized === 'planning') return 'enquiry'
    if (normalized === 'active') return 'current'
    if (normalized === 'on_hold' || normalized === 'onhold') return 'upcoming'
    if (normalized === 'completed') return 'finished'
    return 'enquiry'
}

export function normalizeLegacyProjectStatus(status: string | null | undefined): Project['status'] {
    return normalizeProjectStatus(status ?? 'enquiry')
}

export function getProjectTitle(project: Partial<Project>): string {
    return project.name ?? project.project_name ?? 'Untitled Project'
}

export function getProjectSummary(project: Partial<Project>): string {
    return project.description ?? project.scope_of_works ?? project.remarks ?? ''
}

export function getProjectStartDate(project: Partial<Project>): string {
    return project.start_date ?? project.wo_date ?? ''
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
