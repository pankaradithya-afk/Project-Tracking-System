// Placeholder page - User management through Supabase Dashboard
export default function UserManagementPage() {
    return (
        <div className="glass-card p-8 text-center animate-fade-in">
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-surface-50)' }}>User Management</p>
            <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
                User accounts are managed through the Supabase Dashboard → Authentication section.<br />
                Supabase provides full email/password management, role assignment, and audit logs.
            </p>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="btn-primary inline-flex mt-4">Open Supabase Dashboard</a>
        </div>
    )
}
