import { create } from 'zustand'
import type { AlertLog } from '@/types'

interface AlertState {
    alerts: AlertLog[]
    unreadCount: number
    setAlerts: (alerts: AlertLog[]) => void
    markAllRead: () => void
}

export const useAlertStore = create<AlertState>((set) => ({
    alerts: [],
    unreadCount: 0,
    setAlerts: (alerts) =>
        set({
            alerts,
            unreadCount: alerts.filter((a) => !a.resolved).length,
        }),
    markAllRead: () => set({ unreadCount: 0 }),
}))
