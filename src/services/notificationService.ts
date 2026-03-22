import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

export async function getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, project_id, task_id, type, title, message, read_at, created_at')
        .eq('user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as Notification[]
}

export async function markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)

    if (error) throw error
}

export async function createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'read_at'> & { read_at?: string | null }): Promise<Notification> {
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            ...notification,
            read_at: notification.read_at ?? null,
        })
        .select('id, user_id, project_id, task_id, type, title, message, read_at, created_at')
        .single()

    if (error) throw error
    return data as Notification
}

export async function createNotificationsForUsers(
    notifications: Array<Omit<Notification, 'id' | 'created_at' | 'read_at'> & { read_at?: string | null }>
): Promise<Notification[]> {
    if (notifications.length === 0) return []
    const { data, error } = await supabase
        .from('notifications')
        .insert(notifications.map((notification) => ({ ...notification, read_at: notification.read_at ?? null })))
        .select('id, user_id, project_id, task_id, type, title, message, read_at, created_at')

    if (error) throw error
    return (data ?? []) as Notification[]
}

