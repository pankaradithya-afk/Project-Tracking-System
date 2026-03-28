interface ModuleWorkspacePageProps {
    title: string
    description: string
    helper?: string
}

export default function ModuleWorkspacePage({ title, description, helper }: ModuleWorkspacePageProps) {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6">
                <p className="text-sm uppercase tracking-widest text-brand-300">ERP Workspace</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-50">{title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
                <p className="mt-4 text-xs text-slate-500">{helper ?? 'No starter records are bundled. New data will appear here once you start creating live business entries.'}</p>
            </div>

            <div className="glass-card p-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/60">
                    <span className="text-2xl font-semibold text-brand-300">+</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-50">Ready for live data</h2>
                <p className="mt-2 text-sm text-slate-400">
                    This module is wired into the ERP navigation and ready for your production records.
                </p>
            </div>
        </div>
    )
}
