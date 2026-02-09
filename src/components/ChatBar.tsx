import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable, Platform, Keyboard, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useNotesStore, type Note } from '../stores/notesStore'
import { useTestsStore } from '../stores/testsStore'
import { useFlashcardsStore } from '../stores/flashcardsStore'
import { useAuthStore } from '../stores/authStore'
import { useUsageStore } from '../stores/usageStore'
import { getApiBaseUrl } from '../lib/platform'
import { Svg, Path, Polyline, Line, Circle, Polygon } from 'react-native-svg'

interface Mention {
  noteId: string
  noteName: string
  startIndex: number
  endIndex: number
}

interface ChatBarProps {
  onOpenLoginModal: () => void
  currentView?: string
}

function ChatBar({ onOpenLoginModal, currentView }: ChatBarProps) {
  const [message, setMessage] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<TextInput>(null)
  const { notes } = useNotesStore()
  const { addTest } = useTestsStore()
  const { addFlashcardSet } = useFlashcardsStore()
  const { isLoggedIn } = useAuthStore()
  const { planName } = useUsageStore()
  const [isLoading, setIsLoading] = useState(false)
  
  const isPro = planName === 'pro'
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const insets = useSafeAreaInsets()
  const spinAnim = useRef(new Animated.Value(0)).current
  
  // Use keyboard controller for smooth animations on mobile
  const keyboardHeight = useSharedValue(0)
  
  // Listen to keyboard events and follow keyboard in real-time (only on mobile)
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet'
        if (Platform.OS !== 'web') {
          // Update directly without animation to match native keyboard speed
          keyboardHeight.value = e.height
        }
      },
    },
    []
  )
  
  // Animated style for smooth keyboard movement
  const animatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return {}
    }
    // Move chatbar up by keyboard height when keyboard is visible
    return {
      bottom: keyboardHeight.value,
    }
  }, [])

  // Filter notes based on autocomplete query
  const filteredNotes = notes.filter(note =>
    note.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
  )

  // Parse mentions from message - now looks for @noteName format and looks up IDs
  // Note names can have spaces, so we need to match until an action word or end of string
  const parseMentions = (text: string): Mention[] => {
    const parsed: Mention[] = []
    
    // Find all @ symbols in the message
    const atIndices: number[] = []
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '@') {
        atIndices.push(i)
      }
    }
    
    // Action words that typically follow mentions
    const actionWords = ['into', 'to', 'for', 'from', 'as', 'with', 'turn', 'make', 'create', 'generate']
    
    for (const atIndex of atIndices) {
      // Get text after @
      const textAfterAt = text.substring(atIndex + 1)
      
      // Try to find the longest matching note name
      // Check each note to see if the text starts with its name
      let bestMatch: { note: Note; nameLength: number } | null = null
      
      for (const note of notes) {
        const noteName = note.name.trim()
        if (!noteName) continue
        
        // Check if text after @ starts with this note name (case-insensitive)
        const lowerTextAfter = textAfterAt.toLowerCase()
        const lowerNoteName = noteName.toLowerCase()
        
        if (lowerTextAfter.startsWith(lowerNoteName)) {
          // Check if it's followed by a space or action word or end of string
          const afterNoteName = textAfterAt.substring(noteName.length)
          const nextChar = afterNoteName[0]
          const nextWord = afterNoteName.trim().split(/\s+/)[0]?.toLowerCase()
          
          // If followed by space, action word, or end, it's a valid match
          if (!nextChar || nextChar === ' ' || (nextWord && actionWords.includes(nextWord))) {
            if (!bestMatch || noteName.length > bestMatch.nameLength) {
              bestMatch = { note, nameLength: noteName.length }
            }
          }
        }
      }
      
      if (bestMatch) {
        parsed.push({
          noteId: bestMatch.note.id,
          noteName: bestMatch.note.name,
          startIndex: atIndex,
          endIndex: atIndex + 1 + bestMatch.note.name.length
        })
      }
    }

    return parsed
  }

  const mentions = parseMentions(message)

  // Fetch usage to check plan status on mount
  useEffect(() => {
    if (isLoggedIn) {
      const { fetchUsage } = useUsageStore.getState()
      fetchUsage()
    }
  }, [isLoggedIn])

  // Clear status message after 5 seconds when it's set
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  // Animate spinner when loading
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          // RN Web (and some native setups) don't have the native animated module, so
          // using the native driver would warn and fall back anyway.
          useNativeDriver: Platform.OS !== 'web',
        })
      ).start()
    } else {
      spinAnim.setValue(0)
    }
  }, [isLoading, spinAnim])


  const handleInputChange = (text: string) => {
    setMessage(text)

    // Check if we're typing after an "@"
    const lastAtIndex = text.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      // Check if there's a space after @
      const textAfterAt = text.substring(lastAtIndex + 1)
      const hasSpace = textAfterAt.includes(' ')
      
      if (!hasSpace) {
        const query = textAfterAt
        setAutocompleteQuery(query)
        setShowAutocomplete(true)
        setSelectedIndex(0)
        return
      }
    }
    
    setShowAutocomplete(false)
  }

  const selectNote = (note: Note) => {
    const lastAtIndex = message.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const beforeAt = message.substring(0, lastAtIndex)
      // Use note name if valid, otherwise use a fallback
      // Just show the name, not the ID - we'll look it up when sending to API
      const noteName = (note.name && note.name !== 'undefined' && note.name.trim()) ? note.name : 'Note'
      const mentionText = `@${noteName} `
      const newMessage = beforeAt + mentionText
      
      setMessage(newMessage)
      setShowAutocomplete(false)
      setAutocompleteQuery('')
      
      // Focus input
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }

  // Route intent using Gemini AI
  const routeIntent = async (msg: string, mentionsList: Mention[]): Promise<{ intent: 'test' | 'flashcard' | 'course_search' | 'career_path' | 'none'; school?: string; department?: string; role?: string; company?: string; seniority?: string; major?: string }> => {
    const { supabase } = await import('../lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('You must be logged in to use this feature')
    }

    const API_BASE_URL = getApiBaseUrl()
    const response = await fetch(`${API_BASE_URL}/api/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        message: msg,
        mentions: mentionsList,
        pageContext: currentView ? {
          currentView: currentView
        } : undefined
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in to use this feature.')
      }
      
      if (response.status === 429) {
        const remaining = data.remaining || 0
        const limit = data.limit || 0
        throw new Error(
          `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
          `Please upgrade your plan or wait until next month.`
        )
      }
      
      throw new Error(data.message || data.error || 'Failed to route intent')
    }

    if (data.success) {
      return {
        intent: data.intent || 'none',
        school: data.school,
        department: data.department,
        role: data.role,
        company: data.company,
        seniority: data.seniority,
        major: data.major
      }
    }

    return { intent: 'none' }
  }

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return

    setIsLoading(true)
    setStatusMessage(null)
    Keyboard.dismiss()

    try {
      // Route intent using Gemini AI
      let intentResult: { intent: 'test' | 'flashcard' | 'course_search' | 'career_path' | 'none'; school?: string; department?: string; role?: string; company?: string; seniority?: string; major?: string; reasoning?: string }
      
      if (isLoggedIn) {
        try {
          intentResult = await routeIntent(message, mentions)
        } catch (error) {
          console.error('Error routing intent:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to route intent'
          setStatusMessage({ type: 'error', text: errorMessage })
          setIsLoading(false)
          return
        }
      } else {
        // If not logged in, skip intent routing and show login prompt
        setStatusMessage({ type: 'error', text: 'Login to use AI tools' })
        onOpenLoginModal()
        setIsLoading(false)
        return
      }

      // If intent is 'none', don't do anything
      if (intentResult.intent === 'none') {
        setStatusMessage({ 
          type: 'error', 
          text: 'Message did not match any available capabilities. Try: "turn @[note] into test", "create flashcard from @[note]", or "find courses for..."' 
        })
        setMessage('')
        setIsLoading(false)
        return
      }

      // Handle test generation
      if (intentResult.intent === 'test') {
        // Try to find note from mentions first, then from URL/context if on notes page
        let targetNote: Note | undefined
        
        if (mentions && mentions.length > 0) {
          targetNote = notes.find(n => n.id === mentions[0].noteId)
        } else if (currentView === 'notes') {
          // If on notes page, try to get selected note from URL hash (web) or use first note
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const hash = window.location.hash
            if (hash && hash.startsWith('#note-')) {
              const noteId = hash.replace('#note-', '')
              targetNote = notes.find(n => n.id === noteId)
            }
          }
          // If still no note found, use the most recently updated note
          if (!targetNote && notes.length > 0) {
            targetNote = notes[0] // Notes are already sorted by updated_at desc in the store
          }
        }
        
        if (!targetNote) {
          setStatusMessage({ 
            type: 'error', 
            text: 'Test generation requires a note. Please mention a note with @[note name] or select a note on the notes page.' 
          })
          setMessage('')
          setIsLoading(false)
          return
        }

        const noteContent = targetNote.content || ''
        if (!noteContent.trim()) {
          throw new Error('Note content is empty')
        }

        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('You must be logged in to use this feature')
        }

        const API_BASE_URL = getApiBaseUrl()
        const response = await fetch(`${API_BASE_URL}/api/tests/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            noteId: targetNote.id,
            noteName: targetNote.name,
            noteContent: noteContent
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required. Please log in to use this feature.')
          }
          
          if (response.status === 429) {
            const remaining = data.remaining || 0
            const limit = data.limit || 0
            throw new Error(
              `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
              `Please upgrade your plan or wait until next month.`
            )
          }
          
          throw new Error(data.message || data.error || 'Failed to generate test')
        }

        if (data.success && data.test) {
          try {
            await addTest({
            name: data.test.name,
              folderId: undefined,
            noteId: data.test.noteId,
            noteName: data.test.noteName,
            questions: data.test.questions
          })
          setStatusMessage({ type: 'success', text: `Test "${data.test.name}" created successfully!` })
          setMessage('')
          } catch (error) {
            console.error('Failed to add test:', error)
            setStatusMessage({ type: 'error', text: 'Failed to save test. Please try again.' })
          }
        }
      } 
      // Handle flashcard generation
      else if (intentResult.intent === 'flashcard') {
        if (!mentions || mentions.length === 0) {
          setStatusMessage({ 
            type: 'error', 
            text: 'Flashcard generation requires a note mention. Use @ to mention a note first.' 
          })
          setMessage('')
          setIsLoading(false)
          return
        }

        const mentionedNote = notes.find(n => n.id === mentions[0].noteId)
        if (!mentionedNote) {
          throw new Error('Note not found')
        }

        const noteContent = mentionedNote.content || ''
        if (!noteContent.trim()) {
          throw new Error('Note content is empty')
        }

        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('You must be logged in to use this feature')
        }

        const API_BASE_URL = getApiBaseUrl()
        const response = await fetch(`${API_BASE_URL}/api/flashcards/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            noteId: mentionedNote.id,
            noteName: mentionedNote.name,
            noteContent: noteContent
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required. Please log in to use this feature.')
          }
          
          if (response.status === 429) {
            const remaining = data.remaining || 0
            const limit = data.limit || 0
            throw new Error(
              `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
              `Please upgrade your plan or wait until next month.`
            )
          }
          
          throw new Error(data.message || data.error || 'Failed to generate flashcards')
        }

        if (data.success && data.flashcardSet) {
          try {
            await addFlashcardSet({
              name: data.flashcardSet.name,
              folderId: undefined,
              noteId: data.flashcardSet.noteId,
              noteName: data.flashcardSet.noteName,
              cards: data.flashcardSet.cards
            })
            setStatusMessage({ type: 'success', text: `Flashcards "${data.flashcardSet.name}" created successfully!` })
            setMessage('')
          } catch (error) {
            console.error('Failed to add flashcards:', error)
            setStatusMessage({ type: 'error', text: 'Failed to save flashcards. Please try again.' })
          }
        }
      } 
      // Handle course search
      else if (intentResult.intent === 'course_search') {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('You must be logged in to use this feature')
        }

        // School is required, department is optional
        if (!intentResult.school) {
          setStatusMessage({ 
            type: 'error', 
            text: 'Please specify a school. For example: "find CS courses for MIT" or "Stanford courses for AI"' 
          })
          return
        }

        const school = intentResult.school
        const department = intentResult.department || undefined

        const API_BASE_URL = getApiBaseUrl()
        const response = await fetch(`${API_BASE_URL}/api/courses/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            query: message,
            school,
            ...(department && { department }),
            limit: 10
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required. Please log in to use this feature.')
          }
          
          if (response.status === 429) {
            const remaining = data.remaining || 0
            const limit = data.limit || 0
            throw new Error(
              `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
              `Please upgrade your plan or wait until next month.`
            )
          }
          
          throw new Error(data.message || data.error || 'Failed to search courses')
        }

        // Check if no courses were found
        if (!data.success || !data.results || data.results.length === 0) {
          const filterDesc = department 
            ? `${school} ${department}`
            : school
          throw new Error(data.error || `No courses found for ${filterDesc}. Make sure courses exist in the database.`)
        }

        if (data.success && data.results && data.results.length > 0) {
          setStatusMessage({ 
            type: 'success', 
            text: `Found ${data.results.length} courses!` 
          })
          setMessage('')
        }
      }
      // Handle career path generation
      else if (intentResult.intent === 'career_path') {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('You must be logged in to use this feature')
        }

        console.log('[ChatBar] Career path intent received:', {
          role: intentResult.role,
          company: intentResult.company,
          seniority: intentResult.seniority,
          major: intentResult.major,
          fullIntent: intentResult
        })

        if (!intentResult.role || !intentResult.company) {
          console.warn('[ChatBar] Missing role or company:', {
            role: intentResult.role,
            company: intentResult.company,
            reasoning: intentResult.reasoning
          })
          setStatusMessage({ 
            type: 'error', 
            text: `Please specify both a role and company. Received: role="${intentResult.role || 'missing'}", company="${intentResult.company || 'missing'}". Try: "I want to work as a fullstack engineer at OpenAI"` 
          })
          setMessage('')
          setIsLoading(false)
          return
        }

        const API_BASE_URL = getApiBaseUrl()
        const response = await fetch(`${API_BASE_URL}/api/career/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            role: intentResult.role,
            company: intentResult.company,
            seniority: intentResult.seniority || 'mid',
            major: intentResult.major
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required. Please log in to use this feature.')
          }
          
          if (response.status === 429) {
            const remaining = data.remaining || 0
            const limit = data.limit || 0
            throw new Error(
              `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
              `Please upgrade your plan or wait until next month.`
            )
          }
          
          throw new Error(data.message || data.error || 'Failed to generate career path')
        }

        if (data.success) {
          try {
            const { useCareerStore } = await import('../stores/careerStore')
            await useCareerStore.getState().addCareerPath(
              data.targetId,
              data.graphId,
              data.role,
              data.company,
              data.seniority,
              data.major,
              data.nodes || []
            )
            setStatusMessage({ 
              type: 'success', 
              text: `Career path generated for ${intentResult.role} at ${intentResult.company}!` 
            })
            setMessage('')
          } catch (error) {
            console.error('Failed to save career path:', error)
            setStatusMessage({ 
              type: 'error', 
              text: 'Career path generated but failed to save. Please try again.' 
            })
          }
        }
      }
    } catch (error) {
      console.error('Error processing request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process request'
      setStatusMessage({ type: 'error', text: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  // Render message with mention indicators
  const renderMessageWithMentions = () => {
    if (mentions.length === 0) return null

    return (
      <View style={styles.mentionsPreview}>
        {mentions.map((mention, index) => (
          <View key={index} style={styles.mentionBadge}>
            <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <Polyline points="14 2 14 8 20 8" />
            </Svg>
            <Text style={styles.mentionText}>{mention.noteName}</Text>
          </View>
        ))}
      </View>
    )
  }

  const NoteIcon = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
    </Svg>
  )

  const SendIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="22" y1="2" x2="11" y2="13" />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Svg>
  )

  const Spinner = () => {
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    })

    return (
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <Path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    )
  }

  const ChatBarWrapper = Platform.OS === 'web' ? View : ReanimatedAnimated.View

  return (
    <ChatBarWrapper style={[
      styles.chatbar, 
      { 
        paddingBottom: Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 12),
      },
      Platform.OS !== 'web' && animatedStyle
    ]}>
      {statusMessage && (
        <View style={[styles.status, statusMessage.type === 'error' ? styles.statusError : styles.statusSuccess]}>
          <Text style={styles.statusText}>{statusMessage.text}</Text>
        </View>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
            ref={inputRef}
          style={styles.input}
            placeholder="Type your message... Use @ to mention notes"
            value={message}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSubmit}
          editable={!isLoading}
          multiline={false}
          />
          {renderMessageWithMentions()}
          {showAutocomplete && filteredNotes.length > 0 && (
          <View style={styles.autocomplete}>
            {filteredNotes.slice(0, 5).map((note, index) => (
              <Pressable
                  key={note.id}
                style={[styles.autocompleteItem, index === selectedIndex && styles.autocompleteItemSelected]}
                onPress={() => selectNote(note)}
              >
                <NoteIcon />
                <Text style={styles.autocompleteText}>{note.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Pressable style={styles.button} onPress={handleSubmit} disabled={isLoading}>
        <View style={styles.iconContainer}>
          {isLoading ? <Spinner /> : <SendIcon />}
        </View>
      </Pressable>
    </ChatBarWrapper>
  )
}

const styles = StyleSheet.create({
  chatbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#e8e8e8',
    borderTopWidth: 1,
    ...(Platform.OS === 'web' && {
      zIndex: 100, // Higher z-index to ensure it appears above flashcard container
    }),
    borderTopColor: '#d0d0d0',
    padding: 12,
    paddingBottom: 12, // Base padding, will be overridden by inline style for safe area
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  status: {
    position: 'absolute',
    top: -40,
    left: 12,
    right: 12,
    padding: 8,
    borderRadius: 8,
  },
  statusSuccess: {
    backgroundColor: '#e8f5e9',
  },
  statusError: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 14,
    color: '#0f0f0f',
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f0f0f',
    minHeight: 44,
    ...(Platform.OS === 'web' && {
      fontSize: 16, // Prevents zoom on iOS
    }),
  },
  mentionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  mentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d8d8d8',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  mentionText: {
    fontSize: 12,
    color: '#0f0f0f',
  },
  autocomplete: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    maxHeight: 200,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    }),
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  autocompleteItemSelected: {
    backgroundColor: '#e8e8e8',
  },
  autocompleteText: {
    fontSize: 14,
    color: '#0f0f0f',
  },
  button: {
    width: 44,
    height: 44,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default ChatBar
