import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Dimensions, Platform, Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AddNoteModal from '../modals/AddNoteModal'
import UploadNotesModal from '../modals/UploadNotesModal'
import { useNotesStore, type Note } from '../../stores/notesStore'
import { useAuthStore } from '../../stores/authStore'
import { useUsageStore } from '../../stores/usageStore'
import { parseNotesImage, parseNotesFromYouTube } from '../../lib/notesParser'
import { BackIcon, FolderIcon, DeleteIcon, NotesIcon, UploadIcon, AddIcon } from '../icons'
import { pickImage } from '../../lib/platformHelpers'
import { Svg, Circle, Path } from 'react-native-svg'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'

interface NotesViewProps {
  onOpenLoginModal: () => void
  onOpenUpgradeModal?: () => void
}

const SpinnerIcon = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <Circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
    <Path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"/>
  </Svg>
)

function NotesView({ onOpenLoginModal, onOpenUpgradeModal }: NotesViewProps) {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { notes, addNote, updateNoteContentLocal, updateNoteContent, removeNote, moveNoteToFolder } = useNotesStore()
  const { isLoggedIn } = useAuthStore()
  const { planName } = useUsageStore()
  const isPro = planName === 'pro'
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scrollViewRef = useRef<any>(null)
  const editorInputRef = useRef<TextInput>(null)
  const isInsertingSymbolRef = useRef(false)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const insets = useSafeAreaInsets()
  const { setIsInDetailMode } = useDetailMode()

  const currentNote = currentNoteId ? notes.find(n => n.id === currentNoteId) : null
  const displayedNotes = notes
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const isMobile = windowWidth <= 768

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  // Reset local state when logged out
  useEffect(() => {
    if (!isLoggedIn) {
      setCurrentNoteId(null)
      setIsNoteModalOpen(false)
      setIsUploadModalOpen(false)
      setIsEditorFocused(false)
      setSelection({ start: 0, end: 0 })
    }
  }, [isLoggedIn])

  // Handle navigation to specific note (from career graph)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const pendingNoteId = (window as any).__pendingNoteId
      if (pendingNoteId && notes.some(n => n.id === pendingNoteId)) {
        setCurrentNoteId(pendingNoteId)
        delete (window as any).__pendingNoteId
      }
    }
  }, [notes])

  // Initialize file input for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*,application/pdf'
      input.style.display = 'none'
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0]
        if (file) {
          await handleFileChange(file)
          target.value = ''
        }
      }
      document.body.appendChild(input)
      fileInputRef.current = input
      return () => {
        document.body.removeChild(input)
      }
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Hide scrollbar on web by manipulating DOM directly
  useEffect(() => {
    if (Platform.OS === 'web' && currentNoteId) {
      const hideScrollbar = () => {
        // Find all scrollable elements - try multiple selectors
        const containers = [
          document.querySelector('.note-editor-scroll'),
          document.querySelector('[class*="ScrollView"]'),
          ...Array.from(document.querySelectorAll('div')).filter((el: Element) => {
            const htmlEl = el as HTMLElement
            const style = window.getComputedStyle(htmlEl)
            return style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll'
          })
        ].filter(Boolean) as HTMLElement[]

        // Inject comprehensive style tag
        let style = document.getElementById('hide-note-scrollbar') as HTMLStyleElement
        if (!style) {
          style = document.createElement('style')
          style.id = 'hide-note-scrollbar'
          document.head.appendChild(style)
        }
        
        style.textContent = `
          .note-editor-scroll,
          .note-editor-scroll *,
          .note-editor-scroll > div,
          .note-editor-scroll > div > div,
          [class*="ScrollView"],
          div[style*="overflow"] {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          .note-editor-scroll::-webkit-scrollbar,
          .note-editor-scroll *::-webkit-scrollbar,
          .note-editor-scroll > div::-webkit-scrollbar,
          .note-editor-scroll > div > div::-webkit-scrollbar,
          [class*="ScrollView"]::-webkit-scrollbar,
          div[style*="overflow"]::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            background: transparent !important;
          }
        `

        // Directly manipulate all scrollable elements
        containers.forEach((container) => {
          if (container && container.style) {
            container.style.setProperty('scrollbar-width', 'none', 'important')
            container.style.setProperty('-ms-overflow-style', 'none', 'important')
            // Also try setting on all children
            const allChildren = container.querySelectorAll('*')
            allChildren.forEach((child: Element) => {
              const htmlChild = child as HTMLElement
              if (htmlChild.style) {
                htmlChild.style.setProperty('scrollbar-width', 'none', 'important')
                htmlChild.style.setProperty('-ms-overflow-style', 'none', 'important')
              }
            })
          }
        })
      }

      // Use MutationObserver to catch dynamically created elements
      const observer = new MutationObserver(() => {
        hideScrollbar()
      })

      // Try multiple times to catch elements at different render stages
      hideScrollbar()
      const timers = [
        setTimeout(hideScrollbar, 50),
        setTimeout(hideScrollbar, 100),
        setTimeout(hideScrollbar, 300),
        setTimeout(hideScrollbar, 500),
        setTimeout(hideScrollbar, 1000),
      ]

      // Observe the document for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      })

      return () => {
        timers.forEach(timer => clearTimeout(timer))
        observer.disconnect()
        const style = document.getElementById('hide-note-scrollbar')
        if (style) style.remove()
      }
    }
  }, [currentNoteId])

  const handleDragStart = (itemId: string) => {
    if (Platform.OS !== 'web') return
    setDraggedItemId(itemId)
  }

  const handleDragEnd = () => {
    if (Platform.OS !== 'web') return
    setDraggedItemId(null)
  }

  const handleAddNote = () => {
    if (!isLoggedIn) {
      onOpenLoginModal()
      return
    }
    setIsNoteModalOpen(true)
  }

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false)
  }

  const handleSubmitNote = async (noteName: string) => {
    try {
      await addNote(noteName, undefined)
      setIsNoteModalOpen(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add note'
      setErrorMessage(errorMessage)
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleBackClick = () => {
    if (currentNoteId) {
      setCurrentNoteId(null)
    }
  }

  const handleNoteClick = (noteId: string) => {
    setCurrentNoteId(noteId)
  }

  const handleNoteContentChange = (content: string) => {
    if (!currentNoteId) return
    
    updateNoteContentLocal(currentNoteId, content)
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateNoteContent(currentNoteId, content)
      } catch (err) {
        console.error('Failed to save note:', err)
      }
    }, 1000)
  }

  const handleNoteBlur = (e: any) => {
    // Don't blur if we're in the middle of inserting a symbol
    if (isInsertingSymbolRef.current) {
      return
    }
    
    // Don't blur if clicking on the symbol toolbar
    if (Platform.OS === 'web' && e?.relatedTarget) {
      const relatedTarget = e.relatedTarget as HTMLElement
      if (relatedTarget.closest && relatedTarget.closest('[data-symbol-toolbar]')) {
        // Click was on the toolbar, don't blur
        return
      }
    }
    
    setIsEditorFocused(false)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }

  const handleNoteFocus = () => {
    setIsEditorFocused(true)
  }

  const handleSelectionChange = (event: any) => {
    setSelection({
      start: event.nativeEvent.selection.start,
      end: event.nativeEvent.selection.end,
    })
  }

  const insertSymbol = (symbol: string, event?: any) => {
    // Prevent the input from losing focus when clicking the symbol button
    if (event) {
      event.preventDefault?.()
      event.stopPropagation?.()
    }
    
    if (!currentNoteId || !currentNote) return
    
    // Set flag to prevent blur during symbol insertion
    isInsertingSymbolRef.current = true
    
    let insertStart = selection.start
    let insertEnd = selection.end
    
    // On web, try to get current selection from the DOM element
    if (Platform.OS === 'web' && editorInputRef.current) {
      try {
        const input = editorInputRef.current as any
        if (input._internalFiberInstanceHandleDEV) {
          // React Native Web - find the actual input element
          const node = input._internalFiberInstanceHandleDEV.stateNode
          if (node && node.input) {
            const domInput = node.input as HTMLInputElement | HTMLTextAreaElement
            insertStart = domInput.selectionStart || selection.start
            insertEnd = domInput.selectionEnd || selection.end
          }
        } else if (input.selectionStart !== undefined) {
          // Direct DOM access
          insertStart = input.selectionStart || selection.start
          insertEnd = input.selectionEnd || selection.end
        }
      } catch (e) {
        // Fallback to state
        console.warn('Could not get selection from DOM, using state')
      }
    }
    
    const currentContent = currentNote.content || ''
    const before = currentContent.substring(0, insertStart)
    const after = currentContent.substring(insertEnd)
    const newContent = before + symbol + after
    const newCursorPos = insertStart + symbol.length
    
    handleNoteContentChange(newContent)
    
    // Update cursor position and refocus to keep keyboard open
    setTimeout(() => {
      if (editorInputRef.current) {
        if (Platform.OS === 'web') {
          try {
            const input = editorInputRef.current as any
            if (input._internalFiberInstanceHandleDEV) {
              const node = input._internalFiberInstanceHandleDEV.stateNode
              if (node && node.input) {
                const domInput = node.input as HTMLInputElement | HTMLTextAreaElement
                // Only update selection, don't call focus() to avoid scrolling
                domInput.setSelectionRange(newCursorPos, newCursorPos)
                setSelection({ start: newCursorPos, end: newCursorPos })
                setIsEditorFocused(true)
                isInsertingSymbolRef.current = false
                return
              }
            } else if (input.setSelectionRange) {
              // Only update selection, don't call focus() to avoid scrolling
              input.setSelectionRange(newCursorPos, newCursorPos)
              setSelection({ start: newCursorPos, end: newCursorPos })
              setIsEditorFocused(true)
              isInsertingSymbolRef.current = false
              return
            }
          } catch (e) {
            console.warn('Could not set selection on DOM element')
          }
        }
        
        // Native: update selection and refocus to keep keyboard open
        editorInputRef.current.setNativeProps({
          selection: { start: newCursorPos, end: newCursorPos },
        })
        setSelection({ start: newCursorPos, end: newCursorPos })
        // Refocus on mobile to keep keyboard open after inserting symbol
        if (Platform.OS !== 'web') {
          // Use requestAnimationFrame for smoother refocus on mobile
          requestAnimationFrame(() => {
            editorInputRef.current?.focus()
            isInsertingSymbolRef.current = false
          })
        } else {
          isInsertingSymbolRef.current = false
        }
      } else {
        isInsertingSymbolRef.current = false
      }
    }, 10)
  }

  const handleDonePress = () => {
    if (editorInputRef.current) {
      editorInputRef.current.blur()
    }
    if (Platform.OS !== 'web') {
      Keyboard.dismiss()
    }
  }

  // Folder creation modal removed


  const handleUploadNotes = () => {
    if (!isLoggedIn) {
      setErrorMessage('Login to use AI tools')
      setTimeout(() => setErrorMessage(null), 3000)
      onOpenLoginModal()
      return
    }
    setIsUploadModalOpen(true)
  }

  const handleFileSelect = async (file: File | Blob) => {
    await handleFileChange(file)
  }

  const handleYouTubeUrlSubmit = async (youtubeUrl: string) => {
    setIsProcessing(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const result = await parseNotesFromYouTube(youtubeUrl)
      const extractedText = result.text
      const videoTitle = result.videoTitle
      
      if (!extractedText || extractedText.trim().length === 0) {
        setErrorMessage('No content found in the YouTube video. Please ensure the video has captions or spoken content.')
        setTimeout(() => setErrorMessage(null), 5000)
      } else {
        // Use video title if available, otherwise fallback to default
        let noteTitle = videoTitle || 'YouTube Video Notes'
        
        // Limit title length
        if (noteTitle.length > 100) {
          noteTitle = noteTitle.substring(0, 97) + '...'
        }

        try {
          // Create note with content so auto-tagging can happen
          await addNote(noteTitle, undefined, extractedText)
        
          const currentState = useNotesStore.getState()
          const allNotes = currentState.notes
          
          const newNote = allNotes
            .filter(n => n.name === noteTitle)
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return dateB - dateA
            })[0]

          if (newNote) {
            setCurrentNoteId(newNote.id)
            setSuccessMessage('Notes generated successfully!')
            setTimeout(() => setSuccessMessage(null), 3000)
          }
        } catch (error) {
          console.error('Error saving note:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to save note'
          setErrorMessage(errorMessage)
          setTimeout(() => setErrorMessage(null), 5000)
        }
      }
    } catch (error) {
      console.error('Error parsing YouTube video:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse YouTube video'
      setErrorMessage(errorMessage)
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileChange = async (file: File | Blob) => {
    if (!file) return

    // Validate file type - allow both images and PDFs
    if (file instanceof File) {
      const isValidImage = file.type.startsWith('image/')
      const isValidPdf = file.type === 'application/pdf'
      if (!isValidImage && !isValidPdf) {
        setErrorMessage('Please upload an image file or PDF')
      setTimeout(() => setErrorMessage(null), 3000)
      return
      }
    }

    setIsProcessing(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const extractedText = await parseNotesImage(file)
      
      if (!extractedText || extractedText.trim().length === 0) {
        const fileType = file instanceof File && file.type === 'application/pdf' ? 'PDF' : 'image'
        setErrorMessage(`No text found in the ${fileType}. Please ensure the ${fileType} is clear and contains readable text.`)
        setTimeout(() => setErrorMessage(null), 5000)
      } else {
        let noteTitle = 'Untitled Note'
        const lines = extractedText.split('\n').filter(line => line.trim().length > 0)
        
        if (lines.length > 0) {
          const courseCodeMatch = lines[0].match(/[A-Z]{2,4}\s*\d{4}[A-Z]?/)
          if (courseCodeMatch) {
            noteTitle = courseCodeMatch[0].trim()
          } else {
            const firstLine = lines[0].trim()
            noteTitle = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
          }
        }

        try {
          // Create note with content so auto-tagging can happen
          await addNote(noteTitle, undefined, extractedText)
          
          const currentState = useNotesStore.getState()
          const allNotes = currentState.notes
          
          const newNote = allNotes
          .filter(n => n.name === noteTitle)
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return dateB - dateA
            })[0]
          
          if (newNote) {
            setCurrentNoteId(newNote.id)
            setSuccessMessage('Notes uploaded successfully')
            setTimeout(() => setSuccessMessage(null), 3000)
          } else {
            setErrorMessage('Failed to create note. Please try again.')
            setTimeout(() => setErrorMessage(null), 3000)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create note'
          setErrorMessage(errorMessage)
          setTimeout(() => setErrorMessage(null), 5000)
        }
      }
    } catch (error) {
      console.error('Error processing notes:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to process notes file. Please try again with a clearer image or PDF.'
      setErrorMessage(errorMessage)
      setTimeout(() => setErrorMessage(null), 8000)
    } finally {
      setIsProcessing(false)
    }
  }

  // Update detail mode when entering/exiting note editor
  useEffect(() => {
    setIsInDetailMode(!!(currentNoteId && currentNote))
    return () => setIsInDetailMode(false)
  }, [currentNoteId, currentNote, setIsInDetailMode])

  // Render note editor view
  if (currentNoteId && currentNote) {
    return (
      <View style={styles.container}>
        {isMobile && <MobileBackButton onPress={handleBackClick} />}
        <View style={[
          styles.header,
          isMobile && {
            paddingTop: Math.max(insets.top + 8 + 8, 28), // Center with back button (same as sidebar button)
            paddingLeft: 80, // Account for back button + extra space (16px left + 8px padding + 24px icon + 8px padding + 24px gap = 80px)
            paddingRight: 20,
          }
        ]}>
          <View style={[styles.headerTitle, isMobile && {
            flex: 1,
            maxWidth: '100%',
            minWidth: 0, // Allow shrinking for truncation
          }]}>
            {!isMobile && (
            <Pressable style={styles.backButton} onPress={handleBackClick}>
              <BackIcon />
            </Pressable>
            )}
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentNote.name}</Text>
          </View>
          <Pressable style={styles.doneButton} onPress={handleDonePress}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
        {isEditorFocused && (
          <View style={styles.symbolToolbar} {...(Platform.OS === 'web' && { 'data-symbol-toolbar': true })}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.symbolToolbarScroll}
              contentContainerStyle={styles.symbolToolbarContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Special Characters */}
              <View style={styles.symbolGroup}>
                <Text style={styles.symbolGroupLabel}>Special</Text>
                <View style={styles.symbolRow}>
                  {['⓸', '©', '®', '™', '°', '•', '→', '←', '↑', '↓', '✓', '✗', '★', '☆'].map((sym) => (
                    <Pressable 
                      key={sym} 
                      style={styles.symbolButton} 
                      onPress={(e) => insertSymbol(sym, e)}
                      {...(Platform.OS === 'web' && {
                        onMouseDown: (e: any) => {
                          e.preventDefault()
                          e.stopPropagation()
                        },
                      })}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Text style={styles.symbolText}>{sym}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              {/* Greek Letters */}
              <View style={styles.symbolGroup}>
                <Text style={styles.symbolGroupLabel}>Greek</Text>
                <View style={styles.symbolRow}>
                  {['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'ω', 'Δ', 'Ω', '∑', '∫'].map((sym) => (
                    <Pressable 
                      key={sym} 
                      style={styles.symbolButton} 
                      onPress={(e) => insertSymbol(sym, e)}
                      {...(Platform.OS === 'web' && {
                        onMouseDown: (e: any) => {
                          e.preventDefault()
                          e.stopPropagation()
                        },
                      })}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Text style={styles.symbolText}>{sym}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              {/* Math Symbols */}
              <View style={styles.symbolGroup}>
                <Text style={styles.symbolGroupLabel}>Math</Text>
                <View style={styles.symbolRow}>
                  {['±', '×', '÷', '≤', '≥', '≠', '≈', '∞', '√', '²', '³', '½', '¼', '¾', '∂', '∇'].map((sym) => (
                    <Pressable 
                      key={sym} 
                      style={styles.symbolButton} 
                      onPress={(e) => insertSymbol(sym, e)}
                      {...(Platform.OS === 'web' && {
                        onMouseDown: (e: any) => {
                          e.preventDefault()
                          e.stopPropagation()
                        },
                      })}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Text style={styles.symbolText}>{sym}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              {/* Subscript */}
              <View style={styles.symbolGroup}>
                <Text style={styles.symbolGroupLabel}>Subscript</Text>
                <View style={styles.symbolRow}>
                  {['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₊', '₋', '₌', '₍', '₎'].map((sym) => (
                    <Pressable 
                      key={sym} 
                      style={styles.symbolButton} 
                      onPress={(e) => insertSymbol(sym, e)}
                      {...(Platform.OS === 'web' && {
                        onMouseDown: (e: any) => {
                          e.preventDefault()
                          e.stopPropagation()
                        },
                      })}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Text style={styles.symbolText}>{sym}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              {/* Superscript */}
              <View style={styles.symbolGroup}>
                <Text style={styles.symbolGroupLabel}>Superscript</Text>
                <View style={styles.symbolRow}>
                  {['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁺', '⁻', '⁼', '⁽', '⁾'].map((sym) => (
                    <Pressable 
                      key={sym} 
                      style={styles.symbolButton} 
                      onPress={(e) => insertSymbol(sym, e)}
                      {...(Platform.OS === 'web' && {
                        onMouseDown: (e: any) => {
                          e.preventDefault()
                          e.stopPropagation()
                        },
                      })}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Text style={styles.symbolText}>{sym}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
        <ScrollView 
            ref={scrollViewRef}
            style={styles.editorContainer}
            contentContainerStyle={styles.editorContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'web' && {
              className: 'note-editor-scroll',
            })}
          >
          <Pressable
            style={styles.editorWrapper}
            {...(Platform.OS !== 'web' && !isEditorFocused && {
              // On mobile when not focused, make wrapper tappable to focus input
              onPress: () => {
                editorInputRef.current?.focus()
              },
              // Delay press to allow scroll gestures to pass through
              delayPressIn: 0,
              // Allow scroll gestures to cancel the press
              android_ripple: null,
            })}
          >
            <TextInput
              ref={editorInputRef}
              style={styles.editor}
            value={currentNote.content || ''}
              onChangeText={handleNoteContentChange}
            onBlur={handleNoteBlur}
              onFocus={handleNoteFocus}
              onSelectionChange={handleSelectionChange}
            placeholder="Start typing..."
              multiline
              textAlignVertical="top"
              autoFocus={Platform.OS === 'web'}
              placeholderTextColor="#999"
              underlineColorAndroid="transparent"
              selectionColor={Platform.OS === 'web' ? '#0f0f0f' : undefined}
              scrollEnabled={false}
              {...(Platform.OS !== 'web' && !isEditorFocused && {
                // On mobile when not focused, prevent TextInput from intercepting scroll gestures
                pointerEvents: 'none',
              })}
            {...(Platform.OS === 'web' && {
              // Remove focus outline on web
              className: 'note-editor-rn',
              onFocus: (e: any) => {
                handleNoteFocus()
                if (e.target && e.target.style) {
                  e.target.style.setProperty('outline', 'none', 'important')
                  e.target.style.setProperty('border', 'none', 'important')
                  e.target.style.setProperty('box-shadow', 'none', 'important')
                }
                // Track selection on web
                const updateWebSelection = () => {
                  if (editorInputRef.current) {
                    try {
                      const input = editorInputRef.current as any
                      if (input._internalFiberInstanceHandleDEV) {
                        const node = input._internalFiberInstanceHandleDEV.stateNode
                        if (node && node.input) {
                          const domInput = node.input as HTMLInputElement | HTMLTextAreaElement
                          setSelection({
                            start: domInput.selectionStart || 0,
                            end: domInput.selectionEnd || 0,
                          })
                        }
                      } else if (input.selectionStart !== undefined) {
                        setSelection({
                          start: input.selectionStart || 0,
                          end: input.selectionEnd || 0,
                        })
                      }
                    } catch (err) {
                      // Ignore errors
                    }
                  }
                }
                
                // Initial selection
                setTimeout(updateWebSelection, 0)
                
                // Listen for selection changes on web
                const handleWebSelectionChange = () => {
                  updateWebSelection()
                }
                
                document.addEventListener('selectionchange', handleWebSelectionChange)
                if (e.target) {
                  e.target.addEventListener('click', handleWebSelectionChange)
                  e.target.addEventListener('keyup', handleWebSelectionChange)
                  e.target.addEventListener('mouseup', handleWebSelectionChange)
                  
                  // Store cleanup function
                  ;(e.target as any).__selectionCleanup = () => {
                    document.removeEventListener('selectionchange', handleWebSelectionChange)
                    e.target.removeEventListener('click', handleWebSelectionChange)
                    e.target.removeEventListener('keyup', handleWebSelectionChange)
                    e.target.removeEventListener('mouseup', handleWebSelectionChange)
                  }
                }
              },
              onBlur: (e: any) => {
                handleNoteBlur(e)
                if (e.target && (e.target as any).__selectionCleanup) {
                  ;(e.target as any).__selectionCleanup()
                }
              },
            })}
            />
          </Pressable>
        </ScrollView>
      </View>
    )
  }

  // Render notes grid
  type GridItem = Note & { itemType: 'note' }
  const gridData: GridItem[] = [
    ...displayedNotes.map(n => ({ ...n, itemType: 'note' as const })),
  ]

  return (
    <View style={styles.container}>
      <View style={[
        styles.header,
        isMobile && {
          paddingTop: Math.max(insets.top + 8 + 8, 28), // Center with menu button (button center is at insets.top + 8 + 20, minus half title height ~12px)
          paddingLeft: 80, // Account for menu button + extra space (16px left + 8px padding + 24px icon + 8px padding + 24px gap = 80px)
          paddingRight: 20,
          flexDirection: 'column',
          alignItems: 'flex-start',
        }
      ]}>
        <View style={[styles.headerTitle, isMobile && { 
          flex: 0, // Don't take flex space on mobile
          maxWidth: '100%', // Prevent overflow
        }]}>
          <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>Notes</Text>
        </View>
        <View style={[
          styles.headerButtons, 
          isMobile && [
            styles.headerButtonsMobile,
            { width: windowWidth } // Use actual screen width dynamically
          ]
        ]}>
          <Pressable 
            style={[styles.uploadButton, isMobile && styles.buttonMobile]}
            onPress={handleUploadNotes}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <View style={isMobile && styles.iconWrapperMobile}>
                <SpinnerIcon />
                </View>
                <Text style={[styles.uploadButtonText, isMobile && styles.buttonTextMobile]}>Processing...</Text>
              </>
            ) : (
              <>
                <View style={isMobile && styles.iconWrapperMobile}>
                <UploadIcon />
                </View>
                <Text style={[styles.uploadButtonText, isMobile && styles.buttonTextMobile]}>Upload Notes</Text>
              </>
            )}
          </Pressable>
          <Pressable style={[styles.addNoteButton, isMobile && styles.buttonMobile]} onPress={handleAddNote}>
            <View style={isMobile && styles.iconWrapperMobile}>
            <AddIcon />
            </View>
            <Text style={[styles.addNoteButtonText, isMobile && styles.buttonTextMobile]}>Add Notes</Text>
          </Pressable>
        </View>
      </View>

      {(errorMessage || successMessage) && (
        <View style={[styles.message, errorMessage ? styles.errorMessage : styles.successMessage]}>
          <Text style={styles.messageText}>{errorMessage || successMessage}</Text>
        </View>
      )}

      {gridData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No notes yet. Click "Add Notes" to get started.
          </Text>
        </View>
      ) : (
        <View 
          style={styles.gridContainer}
          {...(Platform.OS === 'web' && {
            onDragOver: (e: any) => {
          e.preventDefault()
            },
          })}
        >
          <FlatList
            key={`notes-grid-${numColumns}`}
            data={gridData}
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const note = item as Note & { itemType: 'note' }
              const isDragging = draggedItemId === note.id
              return (
                <Pressable
                  style={[styles.noteCard, isDragging && styles.noteCardDragging]}
                  onPress={() => handleNoteClick(note.id)}
                  {...(Platform.OS === 'web' && {
                    draggable: true,
                    onDragStart: () => handleDragStart(note.id),
                    onDragEnd: handleDragEnd,
                  })}
                >
                  <Pressable 
                    style={styles.cardDeleteButton}
                    onPress={async (e) => {
                    e.stopPropagation()
                    try {
                      await removeNote(note.id)
                    } catch (error) {
                      console.error('Failed to remove note:', error)
                    }
                  }}
                  >
                    <DeleteIcon />
                  </Pressable>
                  <View style={styles.noteCardIcon}>
                    <NotesIcon />
                  </View>
                  <Text style={styles.noteCardTitle} numberOfLines={2} ellipsizeMode="tail">{note.name}</Text>
                </Pressable>
              )
            }}
          />
        </View>
      )}

      <AddNoteModal
        isOpen={isNoteModalOpen}
        onClose={handleCloseNoteModal}
        onSubmit={handleSubmitNote}
      />
      <UploadNotesModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelect={handleFileSelect}
        onYouTubeUrlSubmit={handleYouTubeUrlSubmit}
        isPro={isPro}
        onOpenUpgradeModal={onOpenUpgradeModal}
        onOpenLoginModal={onOpenLoginModal}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
  titleMobile: {
    fontSize: 24,
  },
  headerButtonsMobile: {
    marginTop: 20, // More space from the title/sidebar button
    flexDirection: 'row',
    marginLeft: -80, // Offset the header's paddingLeft (80px) to align with sidebar button
    paddingLeft: 16, // Start from same position as sidebar button (left: 16)
    paddingRight: 16, // Right padding to match left
    gap: 6, // Gap between buttons
  },
  buttonMobile: {
    paddingVertical: 8,
    paddingLeft: 0, // Remove left padding, handled by icon wrapper
    paddingRight: 12, // Right padding to fill width
    minWidth: 0,
    minHeight: 44, // Uniform height for all buttons
    maxHeight: 44, // Prevent buttons from getting taller
    flex: 1,
    flexBasis: 0, // Ensure equal distribution
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8, // Gap between icon and text
    overflow: 'hidden', // Prevent content overflow
  },
  iconWrapperMobile: {
    marginLeft: 16, // Space to the left of the icon
  },
  buttonTextMobile: {
    fontSize: 13,
    flexShrink: 1, // Allow text to shrink if needed
    marginRight: 8, // Space to the right of the text to fill button width
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
    flexShrink: 1, // Allow title to shrink when needed for truncation
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: 'transparent',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#0f0f0f',
  },
  addNoteButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#f0f0f0',
  },
  message: {
    padding: 12,
    margin: 20,
    borderRadius: 8,
  },
  errorMessage: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#c62828',
  },
  successMessage: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  messageText: {
    fontSize: 14,
    color: '#0f0f0f',
    fontWeight: '300',
  },
  editorContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    width: '100%',
  },
  editorContentContainer: {
    flexGrow: 1,
    paddingHorizontal: Platform.select({
      web: 60,
      default: 20,
    }),
    paddingTop: Platform.select({
      web: 40,
      default: 20,
    }),
    paddingBottom: Platform.select({
      web: 140,
      default: 120,
    }),
    width: '100%',
  },
  editorWrapper: {
    width: '100%',
    minHeight: '100%',
  },
  editor: {
    minHeight: '100%',
    width: '100%',
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    textAlign: 'left',
    textAlignVertical: 'top',
    lineHeight: 24,
    letterSpacing: 0.01,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  gridContainer: {
    flex: 1,
  },
  grid: {
    padding: 10,
    paddingBottom: Platform.select({
      web: 120,
      default: 100,
    }),
    gap: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '300',
    textAlign: 'center',
  },
  folderCard: {
    backgroundColor: '#e8e8e8',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    margin: 5,
    maxWidth: (Dimensions.get('window').width - 60) / 2,
    ...(Platform.OS === 'web' && {
      height: 160,
      maxWidth: 320,
      flex: 0,
      width: 320,
      minWidth: 320,
    }),
  },
  folderCardDragOver: {
    borderColor: '#0f0f0f',
    borderWidth: 2,
    backgroundColor: '#f0f0f0',
  },
  folderCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  noteCard: {
    backgroundColor: '#e8e8e8',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    minHeight: 120,
    gap: 12,
    flex: 1,
    margin: 5,
    maxWidth: (Dimensions.get('window').width - 60) / 2,
    position: 'relative',
    ...(Platform.OS === 'web' && {
      height: 160,
      maxWidth: 320,
      minWidth: 320,
      flex: 0,
      width: 320,
    }),
  },
  noteCardDragging: {
    opacity: 0.5,
  },
  cardDeleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  noteCardIcon: {
    marginBottom: 8,
  },
  noteCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0f0f0f',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#f0f0f0',
  },
  symbolToolbar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingVertical: 8,
    maxHeight: 120,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }),
  },
  symbolToolbarScroll: {
    flexGrow: 0,
  },
  symbolToolbarContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 16,
  },
  symbolGroup: {
    gap: 6,
    marginRight: 16,
  },
  symbolGroupLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  symbolRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  symbolButton: {
    minWidth: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#f8f8f8',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s',
      ':hover': {
        backgroundColor: '#e8e8e8',
        borderColor: '#0f0f0f',
      },
    }),
  },
  symbolText: {
    fontSize: 18,
    color: '#0f0f0f',
    lineHeight: 20,
  },
})

export default NotesView
