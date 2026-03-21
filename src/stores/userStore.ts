import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

interface UserState {
    user: User | null
    loading: boolean
    setUser: (user: User | null) => void
    setLoading: (loading: boolean) => void
    signOut: () => Promise<void>
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            loading: true,
            setUser: (user) => set({ user }),
            setLoading: (loading) => set({ loading }),
            signOut: async () => {
                await supabase.auth.signOut()
                set({ user: null })
            },
        }),
        {
            name: 'user-storage',
            partialize: (state) => ({ user: state.user }),
        }
    )
)
