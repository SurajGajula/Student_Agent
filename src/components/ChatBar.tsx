import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable, Platform, Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNotesStore, type Note } from '../stores/notesStore'
import { useTestsStore } from '../stores/testsStore'
import { useFlashcardsStore } from '../stores/flashcardsStore'
import { useAuthStore } from '../stores/authStore'
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
}

function ChatBar({ onOpenLoginModal }: ChatBarProps) {
  const [message, setMessage] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<TextInput>(null)
  const { notes } = useNotesStore()
  const { addTest } = useTestsStore()
  const { addFlashcardSet } = useFlashcardsStore()
  const { isLoggedIn } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const insets = useSafeAreaInsets()

  // Filter notes based on autocomplete query
  const filteredNotes = notes.filter(note =>
    note.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
  )

  // Parse mentions from message
  const parseMentions = (text: string): Mention[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
    const parsed: Mention[] = []
    let match

    while ((match = mentionRegex.exec(text)) !== null) {
      parsed.push({
        noteId: match[2],
        noteName: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      })
    }

    return parsed
  }

  const mentions = parseMentions(message)

  // Clear status message after 5 seconds when it's set
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  const handleInputChange = (text: string) => {
    setMessage(text)

    // Check if we're typing after an "@"
    const lastAtIndex = text.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      // Check if there's a space or mention end between @ and end
      const textAfterAt = text.substring(lastAtIndex + 1)
      const hasSpace = textAfterAt.includes(' ')
      const hasMentionEnd = textAfterAt.includes('](')
      
      if (!hasSpace && !hasMentionEnd) {
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
      const mentionText = `@[${note.name}](${note.id}) `
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

  // Detect if message contains intent to create a test
  const detectTestIntent = (msg: string): boolean => {
    const lowerMessage = msg.toLowerCase()
    const patterns = [
      /turn.*into.*test/i,
      /turn.*note.*into.*test/i,
      /create.*test.*from/i,
      /generate.*test/i,
      /make.*test/i,
      /convert.*to.*test/i,
    ]
    return patterns.some(pattern => pattern.test(lowerMessage))
  }

  // Detect if message contains intent to create flashcards
  const detectFlashcardIntent = (msg: string): boolean => {
    const lowerMessage = msg.toLowerCase()
    const patterns = [
      /turn.*into.*flashcard/i,
      /create.*flashcard/i,
      /generate.*flashcard/i,
      /make.*flashcard/i,
    ]
    return patterns.some(pattern => pattern.test(lowerMessage))
  }

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return

    const isTestGeneration = detectTestIntent(message) && mentions.length > 0
    const isFlashcardGeneration = detectFlashcardIntent(message) && mentions.length > 0
    const isAIGeneration = isTestGeneration || isFlashcardGeneration
    
    if (isAIGeneration && !isLoggedIn) {
      setStatusMessage({ type: 'error', text: 'Login to use AI tools' })
      onOpenLoginModal()
      return
    }

    setIsLoading(true)
    setStatusMessage(null)
    Keyboard.dismiss()

    try {
      if (isTestGeneration) {
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
        const response = await fetch(`${API_BASE_URL}/api/tests/generate`, {
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
      } else if (isFlashcardGeneration) {
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
      } else {
        setMessage('')
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
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <Line x1="22" y1="2" x2="11" y2="13" />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Svg>
  )

  const Spinner = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <Circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <Path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
    </Svg>
    )

  return (
    <View style={[styles.chatbar, { paddingBottom: Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 12) }]}>
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
        {isLoading ? <Spinner /> : <SendIcon />}
      </Pressable>
    </View>
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
})

export default ChatBar
