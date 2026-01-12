import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthStore {
  isLoggedIn: boolean
  user: User | null
  username: string
  email: string | null
  session: Session | null // Store session for synchronous access
  authReady: boolean // Signal that auth state is ready
  isLoading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  initializeAuth: () => Promise<void>
  syncFromSession: () => Promise<void> // Always syncs Zustand state with actual Supabase session
  setSession: (session: Session | null) => void // Set session and mark auth as ready
  _authStateChangeSubscription: { unsubscribe: () => void } | null // Track subscription for cleanup
}

// Track if stores are currently syncing to prevent duplicate calls
let isSyncingStores = false

// Helper function to sync all stores from Supabase
// Uses dynamic imports to avoid require cycles
export const syncAllStores = async () => {
  // Prevent duplicate syncs
  if (isSyncingStores) {
    console.log('[authStore] Stores already syncing, skipping duplicate call')
    return
  }
  
  // Check auth readiness before syncing
  const { authReady, session } = useAuthStore.getState()
  if (!authReady || !session) {
    console.log('[authStore] Auth not ready or no session, skipping store sync')
    return
  }
  
  isSyncingStores = true
  try {
    // Use dynamic imports to avoid require cycles
    const [
      { useFolderStore },
      { useNotesStore },
      { useTestsStore },
      { useFlashcardsStore },
      { useGoalsStore },
      { useUsageStore },
    ] = await Promise.all([
      import('./folderStore'),
      import('./notesStore'),
      import('./testsStore'),
      import('./flashcardsStore'),
      import('./goalsStore'),
      import('./usageStore'),
    ])
    
    await Promise.all([
      useFolderStore.getState().syncFromSupabase().catch(err => console.error('Folder sync error:', err)),
      // Classes store removed - page is commented out
      useNotesStore.getState().syncFromSupabase().catch(err => console.error('Notes sync error:', err)),
      useTestsStore.getState().syncFromSupabase().catch(err => console.error('Tests sync error:', err)),
      useFlashcardsStore.getState().syncFromSupabase().catch(err => console.error('Flashcards sync error:', err)),
      useGoalsStore.getState().syncFromSupabase().catch(err => console.error('Goals sync error:', err)),
      useUsageStore.getState().fetchUsage().catch(err => console.error('Usage sync error:', err)),
    ])
  } catch (error) {
    console.error('Error syncing stores:', error)
  } finally {
    isSyncingStores = false
  }
}

// Helper function to clear all stores on logout
// Uses dynamic imports to avoid require cycles
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

  // Use dynamic imports to avoid require cycles
  const [
    { useFolderStore },
    { useClassesStore },
    { useNotesStore },
    { useTestsStore },
    { useFlashcardsStore },
    { useGoalsStore },
  ] = await Promise.all([
    import('./folderStore'),
    import('./classesStore'),
    import('./notesStore'),
    import('./testsStore'),
    import('./flashcardsStore'),
    import('./goalsStore'),
  ])

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
    // Ensure Supabase is initialized and get a valid session
    const { initSupabase, getSupabase } = await import('../lib/supabase')
    await initSupabase()
    const client = getSupabase()
    
    const { data: { session }, error } = await client.auth.getSession()

    if (error) {
      console.warn('[authStore] Error getting session:', error)
      set({
        isLoggedIn: false,
        user: null,
        username: 'User',
        email: null,
        session: null,
        authReady: true, // Still mark as ready even if no session
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
        session: session,
        authReady: true,
      })
    } else {
      set({
        isLoggedIn: false,
        user: null,
        username: 'User',
        email: null,
        session: null,
        authReady: true, // Mark as ready even if no session
      })
    }
  } catch (error) {
    console.error('[authStore] Error syncing from session:', error)
    set({
      isLoggedIn: false,
      user: null,
      username: 'User',
      email: null,
      session: null,
      authReady: true, // Mark as ready even on error
    })
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isLoggedIn: false,
  user: null,
  username: 'User',
  email: null,
  session: null,
  authReady: false,
  isLoading: false,
  error: null,
  _authStateChangeSubscription: null,

  setSession: (session: Session | null) => {
    if (session?.user) {
      const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
      set({
        session,
        isLoggedIn: true,
        user: session.user,
        username: name,
        email: session.user.email || null,
        authReady: true,
      })
    } else {
      set({
        session: null,
        isLoggedIn: false,
        user: null,
        username: 'User',
        email: null,
        authReady: true,
      })
    }
  },

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

      // After syncing state, check if we have a session and sync stores
      const currentState = get()
      if (currentState.session?.user) {
        // User is logged in - sync all stores
        await syncAllStores()
      } else {
        // No session - clear all stores to ensure no stale data
        // This ensures users don't see data from previous sessions
        await clearAllStores()
      }

      set({ isLoading: false, error: null })

      // Unsubscribe from any existing auth state change listener to prevent multiple subscriptions
      const existingSubscription = get()._authStateChangeSubscription
      if (existingSubscription) {
        try {
          existingSubscription.unsubscribe()
        } catch (e) {
          // Ignore errors during cleanup
        }
      }

      // Listen for auth state changes - this handles cross-tab synchronization
      const subscription = supabase.auth.onAuthStateChange(async (event, session) => {
        // Update session and mark auth as ready
        get().setSession(session)
        
        // Only sync stores on SIGNED_IN event, not on TOKEN_REFRESHED or other events
        // This prevents duplicate syncs on page refresh
        if (event === 'SIGNED_IN' && session?.user) {
          await syncAllStores()
        } else if (!session) {
          // Clear all stores on sign out event or when session is lost
          await clearAllStores()
        }
      })
      
      // Store the subscription so we can unsubscribe later
      set({ _authStateChangeSubscription: subscription })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize auth'
      set({ isLoading: false, error: errorMessage })
      // On error, also clear stores to be safe
      await clearAllStores()
    }
  },
}))

