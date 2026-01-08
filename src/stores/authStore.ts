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
import { useGoalsStore } from './goalsStore'
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
  syncFromSession: () => Promise<void> // Always syncs Zustand state with actual Supabase session
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
      useGoalsStore.getState().syncFromSupabase().catch(err => console.error('Goals sync error:', err)),
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
    'goals-storage',
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

  // Reset goals store
  useGoalsStore.setState({
    goals: [],
    isLoading: false,
    error: null,
  })
}

// Helper function to sync Zustand state with actual Supabase session
const syncStateFromSession = async (set: any) => {
  try {
    // Ensure Supabase is initialized
    const { initSupabase } = await import('../lib/supabase')
    await initSupabase()
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.warn('[authStore] Error getting session:', error)
      set({
        isLoggedIn: false,
        user: null,
        username: 'User',
        email: null,
      })
      return
    }

    if (session?.user) {
      const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
      set({
        isLoggedIn: true,
        user: session.user,
        username: name,
        email: session.user.email || null,
      })
    } else {
      set({
        isLoggedIn: false,
        user: null,
        username: 'User',
        email: null,
      })
    }
  } catch (error) {
    console.error('[authStore] Error syncing from session:', error)
    set({
      isLoggedIn: false,
      user: null,
      username: 'User',
      email: null,
    })
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isLoggedIn: false,
  user: null,
  username: 'User',
  email: null,
  isLoading: false,
  error: null,

  syncFromSession: async () => {
    await syncStateFromSession(set)
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Sync state from actual session (don't trust the response data alone)
      await syncStateFromSession(set)
      
      set({ isLoading: false, error: null })
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

      // Sync state from actual session (don't trust the response data alone)
      await syncStateFromSession(set)
      
        // Sync all stores after successful signup
        await syncAllStores()
      
      set({ isLoading: false, error: null })
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

      // Sync state from actual session to ensure it's cleared
      await syncStateFromSession(set)
      
      set({ isLoading: false, error: null })
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
      
      // Sync state from actual session (always check the real session)
      await syncStateFromSession(set)

      // Check if we have a valid session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // User is logged in - sync all stores
        await syncAllStores()
      } else {
        // No session - clear all stores to ensure no stale data
        // This ensures users don't see data from previous sessions
        await clearAllStores()
      }

      set({ isLoading: false, error: null })

      // Listen for auth state changes - this handles cross-tab synchronization
      supabase.auth.onAuthStateChange(async (event, session) => {
        // Always sync from the actual session passed to the listener
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
          // Clear all stores on sign out event or when session is lost
          await clearAllStores()
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
      // On error, also clear stores to be safe
      await clearAllStores()
    }
  },
}))

