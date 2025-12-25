import { useState, useRef, useEffect } from 'react'
import { useNotesStore, type Note } from '../stores/notesStore'
import { useTestsStore } from '../stores/testsStore'
import { useAuthStore } from '../stores/authStore'

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
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentions, setMentions] = useState<Mention[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const { notes } = useNotesStore()
  const { addTest } = useTestsStore()
  const { isLoggedIn } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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

  // Update mentions when message changes
  useEffect(() => {
    setMentions(parseMentions(message))
  }, [message])

  // Clear status message after 5 seconds when it's set
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setMessage(value)
    setCursorPosition(cursorPos)

    // Check if we're typing after an "@"
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      // Check if there's a space or mention end between @ and cursor
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutocomplete && filteredNotes.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredNotes.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        selectNote(filteredNotes[selectedIndex])
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false)
      }
    }
  }

  const selectNote = (note: Note) => {
    const textBeforeCursor = message.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterCursor = message.substring(cursorPosition)
      const beforeAt = message.substring(0, lastAtIndex)
      const mentionText = `@[${note.name}](${note.id})`
      const newMessage = beforeAt + mentionText + ' ' + textAfterCursor
      
      setMessage(newMessage)
      setShowAutocomplete(false)
      setAutocompleteQuery('')
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = lastAtIndex + mentionText.length + 1
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
          inputRef.current.focus()
        }
      }, 0)
    }
  }

  // Detect if message contains intent to create a test
  const detectTestIntent = (msg: string): boolean => {
    const lowerMessage = msg.toLowerCase()
    
    // Check for common patterns
    const patterns = [
      /turn.*into.*test/i,
      /turn.*note.*into.*test/i,
      /create.*test.*from/i,
      /generate.*test/i,
      /make.*test/i,
      /convert.*to.*test/i,
      /turn.*into.*a.*test/i,
      /create.*a.*test/i,
      /make.*a.*test/i
    ]
    
    // Check if any pattern matches
    const matchesPattern = patterns.some(pattern => pattern.test(lowerMessage))
    
    // Also check for keyword combinations
    const hasTurn = lowerMessage.includes('turn')
    const hasIntoTest = lowerMessage.includes('into') && lowerMessage.includes('test')
    const hasCreateTest = lowerMessage.includes('create') && lowerMessage.includes('test')
    const hasMakeTest = lowerMessage.includes('make') && lowerMessage.includes('test')
    const hasGenerateTest = lowerMessage.includes('generate') && lowerMessage.includes('test')
    
    return matchesPattern || (hasTurn && hasIntoTest) || hasCreateTest || hasMakeTest || hasGenerateTest
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    // Check if this is a test generation request (uses AI)
    const isTestGeneration = detectTestIntent(message) && mentions.length > 0
    
    // Check login status for AI-powered features
    if (isTestGeneration && !isLoggedIn) {
      setStatusMessage({ type: 'error', text: 'Login to use AI tools' })
      onOpenLoginModal()
      return
    }

    setIsLoading(true)
    setStatusMessage(null)

    try {
      // Check if this is a test generation request
      if (isTestGeneration) {
        // Get note content for the first mentioned note
        const mentionedNote = notes.find(n => n.id === mentions[0].noteId)
        if (!mentionedNote) {
          throw new Error('Note not found')
        }

        const noteContent = mentionedNote.content || ''
        if (!noteContent.trim()) {
          throw new Error('Note content is empty')
        }

        // Get auth token
        const { supabase } = await import('../lib/supabase.js')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('You must be logged in to use this feature')
        }

        // Call test generation endpoint
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
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

        // Add test to store
        if (data.success && data.test) {
          try {
            await addTest({
              name: data.test.name,
              folderId: undefined, // Tests from chat don't have a folder
              noteId: data.test.noteId,
              noteName: data.test.noteName,
              questions: data.test.questions
            })
            setStatusMessage({ type: 'success', text: `Test "${data.test.name}" created successfully!` })
            setMessage('')
            setMentions([])
          } catch (error) {
            console.error('Failed to add test:', error)
            setStatusMessage({ type: 'error', text: 'Failed to save test. Please try again.' })
          }
        }
      } else {
        // Regular chat message - placeholder for future chat functionality
        // For now, just clear the message
        setMessage('')
        setMentions([])
      }
    } catch (error) {
      console.error('Error processing request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process request'
      setStatusMessage({ type: 'error', text: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Render message with mention indicators
  const renderMessageWithMentions = () => {
    if (mentions.length === 0) return null

    return (
      <div className="chatbar-mentions-preview">
        {mentions.map((mention, index) => (
          <span key={index} className="mention-badge">
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="mention-icon"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span className="mention-text">{mention.noteName}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="chatbar">
      {statusMessage && (
        <div className={`chatbar-status ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="chatbar-form">
        <div className="chatbar-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="chatbar-input"
            placeholder="Type your message... Use @ to mention notes"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            onFocus={(e) => {
              const cursorPos = e.target.selectionStart || 0
              setCursorPosition(cursorPos)
            }}
            onClick={(e) => {
              const cursorPos = (e.target as HTMLInputElement).selectionStart || 0
              setCursorPosition(cursorPos)
            }}
          />
          {renderMessageWithMentions()}
          {showAutocomplete && filteredNotes.length > 0 && (
            <div ref={autocompleteRef} className="autocomplete-dropdown">
              {filteredNotes.map((note, index) => (
                <div
                  key={note.id}
                  className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => selectNote(note)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="autocomplete-icon"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <span>{note.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="chatbar-button" disabled={isLoading}>
          {isLoading ? (
            <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
              <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}

export default ChatBar

