import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

export type FolderType = 'note' | 'class' | 'test' | 'flashcard'

export interface Folder {
  id: string
  name: string
  type: FolderType
  parentFolderId?: string | null
  createdAt?: string
  updatedAt?: string
}

interface FolderStore {
  folders: Folder[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  getFoldersByType: (type: FolderType) => Folder[]
  addFolder: (name: string, type: FolderType, parentFolderId?: string) => Promise<void>
  removeFolder: (id: string, type: FolderType) => Promise<void>
  updateFolder: (id: string, name: string, type: FolderType, parentFolderId?: string | null) => Promise<void>
}

export const useFolderStore = create<FolderStore>()(
  persist(
    (set, get) => ({
      folders: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) return

        set({ isLoading: true, error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/folders/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch folders')
          }

          const folders: Folder[] = await response.json()

          set({
            folders,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          })
        }
      },

      getFoldersByType: (type: FolderType) => {
        return get().folders.filter(folder => folder.type === type)
      },

      addFolder: async (name: string, type: FolderType, parentFolderId?: string) => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/folders/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ name, type, parentFolderId })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to add folder'
            throw new Error(errorMessage)
          }

          const newFolder: Folder = await response.json()

          set((state) => ({
            folders: [...state.folders, newFolder]
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add folder'
          set({ error: errorMessage })
          throw error
        }
      },

      removeFolder: async (id: string, type: FolderType) => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/folders/delete/${id}?type=${type}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to remove folder'
            throw new Error(errorMessage)
          }

          set((state) => ({
            folders: state.folders.filter((folder) => folder.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove folder'
          set({ error: errorMessage })
          throw error
        }
      },

      updateFolder: async (id: string, name: string, type: FolderType, parentFolderId?: string | null) => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/folders/update/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ name, type, parentFolderId })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to update folder'
            throw new Error(errorMessage)
          }

          const updatedFolder: Folder = await response.json()

          set((state) => ({
            folders: state.folders.map((folder) =>
              folder.id === id ? updatedFolder : folder
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update folder'
          set({ error: errorMessage })
          throw error
        }
      },
    }),
    {
      name: 'folders-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
)
