import { useParams, Navigate } from 'react-router-dom'
import { ProjectDetails } from '@/components/projects/ProjectDetails'

export default function ProjectDetailsPage() {
    const params = useParams()
    const projectId = params.id

    if (!projectId) {
        return <Navigate to="/projects" replace />
    }

    return <ProjectDetails projectId={projectId} />
}

