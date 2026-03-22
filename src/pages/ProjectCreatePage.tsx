import { Link } from 'react-router-dom'
import { ArrowLeft, FolderPlus } from 'lucide-react'
import { ProjectForm } from '@/components/projects/ProjectForm'

export default function ProjectCreatePage() {
    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100">
                <ArrowLeft size={14} />
                Back to dashboard
            </Link>

            <div className="glass-card p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-brand-500/10 p-3 text-brand-300">
                        <FolderPlus size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-50">Create Project</h1>
                        <p className="text-sm text-slate-400">Set up a new project with a name, timeline, and status.</p>
                    </div>
                </div>

                <div className="mt-6">
                    <ProjectForm submitLabel="Create Project" />
                </div>
            </div>
        </div>
    )
}

