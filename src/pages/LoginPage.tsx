import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useUserStore } from '@/stores/userStore'
import { Construction, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { setUser } = useUserStore()
    const navigate = useNavigate()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)
        if (err) {
            setError(err.message)
            return
        }
        if (data.user) {
            setUser(data.user)
            navigate('/dashboard')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-surface-900)' }}>
            {/* Background gradient blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
                <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ background: 'var(--color-brand-600)' }} />
                <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-10" style={{ background: '#3b82f6' }} />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 mx-auto" style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-900))' }}>
                        <Construction size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-surface-50)' }}>IrrigTrack</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-400)' }}>Irrigation Project Tracking System</p>
                </div>

                {/* Card */}
                <div className="glass-card p-8">
                    <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-surface-100)' }}>Sign in to your account</h2>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="form-label">Password</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className="form-input pr-10"
                                    placeholder="Your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--color-surface-400)' }}
                                    onClick={() => setShowPass((p) => !p)}
                                    tabIndex={-1}
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center mt-6 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                        Contact your system administrator to create an account.
                    </p>
                </div>

                <p className="text-center mt-4 text-xs" style={{ color: 'var(--color-surface-500)' }}>
                    © 2025 IrrigTrack — Secure Multi-User Project Management
                </p>
            </div>
        </div>
    )
}
