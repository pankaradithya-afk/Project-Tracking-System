import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
})

type RealtimeHandler<T = unknown> = (payload: T) => void

export type SubscriptionOptions = {
    schema?: string
    table: string
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    filter?: string
    onChange: RealtimeHandler
    onError?: (error: Error) => void
}

export function createTypedSubscription<T>({
    schema = 'public',
    table,
    event = '*',
    filter,
    onChange,
    onError,
}: SubscriptionOptions): RealtimeChannel {
    const channelName = `realtime:${schema}:${table}:${crypto.randomUUID()}`
    const channel = supabase.channel(channelName)

    const callback = (payload: unknown) => {
        onChange(payload as T)
    }

    channel.on(
        'postgres_changes',
        {
            event,
            schema,
            table,
            ...(filter ? { filter } : {}),
        },
        callback
    )

    channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && onError) {
            onError(new Error(`Realtime channel error for ${table}`))
        }
    })

    return channel
}

export function subscribeWithReconnect<T>(options: SubscriptionOptions, retryDelayMs = 2000): () => void {
    let disposed = false
    let channel: RealtimeChannel | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
        if (disposed) return
        if (channel) {
            void supabase.removeChannel(channel)
            channel = null
        }
        channel = createTypedSubscription<T>({
            ...options,
            onError: (error) => {
                options.onError?.(error)
                if (!disposed) {
                    retryTimer = setTimeout(connect, retryDelayMs)
                }
            },
        })
    }

    connect()

    return () => {
        disposed = true
        if (retryTimer) clearTimeout(retryTimer)
        if (channel) {
            void supabase.removeChannel(channel)
        }
    }
}
