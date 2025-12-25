import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export type FolderType = 'note' | 'class' | 'test'

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        set({ isLoading: true, error: null })
        try {
          const { data: folders, error } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          // Transform from snake_case to camelCase
          const transformedFolders: Folder[] = (folders || []).map((folder: any) => ({
            id: folder.id,
            name: folder.name,
            type: folder.type || 'note', // Default to 'note' for backward compatibility
            parentFolderId: folder.parent_folder_id || null,
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
          }))

          set({
            folders: transformedFolders,
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { data, error } = await supabase
            .from('folders')
            .insert({
              user_id: user.id,
              name: name.trim(),
              type: type,
              parent_folder_id: parentFolderId || null,
            })
            .select()
            .single()

          if (error) throw error

          // Transform to camelCase
          const newFolder: Folder = {
            id: data.id,
            name: data.name,
            type: data.type,
            parentFolderId: data.parent_folder_id || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          // Check if folder has children (subfolders of same type or items of that type)
          const folder = get().folders.find(f => f.id === id)
          if (!folder || folder.type !== type) {
            throw new Error('Folder type mismatch')
          }

          let hasChildren = false
          
          // Check for subfolders of the same type
          const subfolders = get().folders.filter(f => f.parentFolderId === id && f.type === type)
          if (subfolders.length > 0) {
            hasChildren = true
          }

          // Check for items based on type
          if (!hasChildren) {
            if (type === 'class') {
              const { data } = await supabase
                .from('classes')
                .select('id')
                .eq('folder_id', id)
                .eq('user_id', user.id)
                .limit(1)
              hasChildren = (data && data.length > 0) || false
            } else if (type === 'note') {
              const { data } = await supabase
                .from('notes')
                .select('id')
                .eq('folder_id', id)
                .eq('user_id', user.id)
                .limit(1)
              hasChildren = (data && data.length > 0) || false
            } else if (type === 'test') {
              const { data } = await supabase
                .from('tests')
                .select('id')
                .eq('folder_id', id)
                .eq('user_id', user.id)
                .limit(1)
              hasChildren = (data && data.length > 0) || false
            }
          }

          if (hasChildren) {
            throw new Error('Cannot delete folder: it contains items or subfolders')
          }

          const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
            .eq('type', type)

          if (error) throw error

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const folder = get().folders.find(f => f.id === id)
          if (!folder || folder.type !== type) {
            throw new Error('Folder type mismatch')
          }

          // Prevent self-reference
          if (parentFolderId === id) {
            throw new Error('Folder cannot be its own parent')
          }

          // Check for circular reference in parent chain (only within same type)
          if (parentFolderId) {
            let currentParentId = parentFolderId
            const visited = new Set([id])

            while (currentParentId) {
              if (visited.has(currentParentId)) {
                throw new Error('Cannot create circular folder reference')
              }
              visited.add(currentParentId)

              const { data: parentFolder } = await supabase
                .from('folders')
                .select('parent_folder_id, type')
                .eq('id', currentParentId)
                .eq('user_id', user.id)
                .eq('type', type)
                .single()

              if (!parentFolder || parentFolder.type !== type) {
                break
              }

              currentParentId = parentFolder?.parent_folder_id || null
            }
          }

          const { data, error } = await supabase
            .from('folders')
            .update({
              name: name.trim(),
              parent_folder_id: parentFolderId || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .eq('type', type)
            .select()
            .single()

          if (error) throw error

          // Transform to camelCase
          const updatedFolder: Folder = {
            id: data.id,
            name: data.name,
            type: data.type,
            parentFolderId: data.parent_folder_id || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }

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
      storage: createJSONStorage(() => localStorage),
    }
  )
)
