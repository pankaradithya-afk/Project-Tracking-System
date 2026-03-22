import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

export function useCurrentProfile() {
    return useQuery({
        queryKey: ['current-profile'],
        queryFn: async (): Promise<User | null> => {
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
        },
        staleTime: 1000 * 60 * 5,
    })
}

