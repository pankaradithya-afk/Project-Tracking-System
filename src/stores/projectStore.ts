import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '@/types'

interface ProjectState {
    activeProject: Project | null
    setActiveProject: (project: Project | null) => void
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            activeProject: null,
            setActiveProject: (project) => set({ activeProject: project }),
        }),
        {
            name: 'project-storage',
            version: 2,
            migrate: () => ({
                activeProject: null,
            }),
        }
    )
)
