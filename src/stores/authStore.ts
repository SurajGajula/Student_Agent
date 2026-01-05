import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useFolderStore } from './folderStore'
import { useClassesStore } from './classesStore'
import { useNotesStore } from './notesStore'
import { useTestsStore } from './testsStore'
import { useFlashcardsStore } from './flashcardsStore'
import { useUsageStore } from './usageStore'

interface AuthStore {
  isLoggedIn: boolean
  user: User | null
  username: string
  email: string | null
  isLoading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  initializeAuth: () => Promise<void>
}

// Helper function to sync all stores from Supabase
const syncAllStores = async () => {
  try {
    await Promise.all([
      useFolderStore.getState().syncFromSupabase().catch(err => console.error('Folder sync error:', err)),
      useClassesStore.getState().syncFromSupabase().catch(err => console.error('Classes sync error:', err)),
      useNotesStore.getState().syncFromSupabase().catch(err => console.error('Notes sync error:', err)),
      useTestsStore.getState().syncFromSupabase().catch(err => console.error('Tests sync error:', err)),
      useFlashcardsStore.getState().syncFromSupabase().catch(err => console.error('Flashcards sync error:', err)),
      useUsageStore.getState().fetchUsage().catch(err => console.error('Usage sync error:', err)),
    ])
  } catch (error) {
    console.error('Error syncing stores:', error)
  }
}

// Helper function to clear all stores on logout
const clearAllStores = async () => {
  const storageKeys = [
    'folders-storage',
    'classes-storage',
    'notes-storage',
    'tests-storage',
    'flashcards-storage',
  ]

  // Clear storage (platform-aware)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    storageKeys.forEach(key => localStorage.removeItem(key))
  } else {
    // Native: use AsyncStorage
    await Promise.all(storageKeys.map(key => AsyncStorage.removeItem(key)))
  }

  // Reset folder store
  useFolderStore.setState({
    folders: [],
    isLoading: false,
    error: null,
  })

  // Reset classes store
  useClassesStore.setState({
    classes: [],
    isLoading: false,
    error: null,
  })

  // Reset notes store
  useNotesStore.setState({
    notes: [],
    isLoading: false,
    error: null,
  })

  // Reset tests store
  useTestsStore.setState({
    tests: [],
    isLoading: false,
    error: null,
  })

  // Reset flashcards store
  useFlashcardsStore.setState({
    flashcardSets: [],
    isLoading: false,
    error: null,
  })
}

export const useAuthStore = create<AuthStore>((set) => ({
  isLoggedIn: false,
  user: null,
  username: 'User',
  email: null,
  isLoading: false,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user && data.session) {
        const name = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'
        set({
          isLoggedIn: true,
          user: data.user,
          username: name,
          email: data.user.email || null,
          isLoading: false,
          error: null,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      })

      if (error) throw error

      if (data.user && data.session) {
        const name = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'
        set({
          isLoggedIn: true,
          user: data.user,
          username: name,
          email: data.user.email || null,
          isLoading: false,
          error: null,
        })
        // Sync all stores after successful signup
        await syncAllStores()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign up'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Clear all stores
      await clearAllStores()

      set({
        isLoggedIn: false,
        user: null,
        username: 'User',
        email: null,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign out'
      set({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  initializeAuth: async () => {
    set({ isLoading: true })
    try {
      // Ensure Supabase is initialized before using it
      const { initSupabase } = await import('../lib/supabase')
      await initSupabase()
      
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error

      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        set({
          isLoggedIn: true,
          user: session.user,
          username: name,
          email: session.user.email || null,
          isLoading: false,
          error: null,
        })
        // Sync all stores after successful auth initialization
        await syncAllStores()
      } else {
        set({ isLoading: false })
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
          set({
            isLoggedIn: true,
            user: session.user,
            username: name,
            email: session.user.email || null,
          })
          // Sync all stores when user logs in
          if (event === 'SIGNED_IN') {
            await syncAllStores()
          }
        } else {
          // Clear all stores on sign out event
          if (event === 'SIGNED_OUT') {
            await clearAllStores()
          }
          set({
            isLoggedIn: false,
            user: null,
            username: 'User',
            email: null,
          })
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize auth'
      set({ isLoading: false, error: errorMessage })
    }
  },
}))

