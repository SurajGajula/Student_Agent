import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Dimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AddNoteModal from '../modals/AddNoteModal'
import CreateFolderModal from '../modals/CreateFolderModal'
import { useNotesStore, type Note } from '../../stores/notesStore'
import { useFolderStore, type Folder } from '../../stores/folderStore'
import { useAuthStore } from '../../stores/authStore'
import { parseNotesImage } from '../../lib/notesParser'
import { BackIcon, FolderIcon, DeleteIcon, NotesIcon, UploadIcon, AddIcon } from '../icons'
import { pickImage, showConfirm } from '../../lib/platformHelpers'
import { Svg, Circle, Path } from 'react-native-svg'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'

interface NotesViewProps {
  onOpenLoginModal: () => void
}

const SpinnerIcon = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <Circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
    <Path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"/>
  </Svg>
)

function NotesView({ onOpenLoginModal }: NotesViewProps) {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { notes, addNote, updateNoteContentLocal, updateNoteContent, removeNote, moveNoteToFolder } = useNotesStore()
  const { getFoldersByType, addFolder, removeFolder } = useFolderStore()
  const { isLoggedIn } = useAuthStore()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scrollViewRef = useRef<any>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const insets = useSafeAreaInsets()
  const { setIsInDetailMode } = useDetailMode()

  const folders = getFoldersByType('note')
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null
  const currentNote = currentNoteId ? notes.find(n => n.id === currentNoteId) : null
  const displayedNotes = currentFolderId 
    ? notes.filter(n => n.folderId === currentFolderId)
    : notes.filter(n => !n.folderId)
  const displayedFolders = currentFolderId ? [] : folders
  const windowWidth = Dimensions.get('window').width
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const isMobile = windowWidth <= 768

  // Initialize file input for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
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
    setDragOverFolderId(null)
  }

  const handleDragOver = (folderId: string | null) => {
    if (Platform.OS !== 'web') return
    setDragOverFolderId(folderId)
  }

  const handleDragLeave = () => {
    if (Platform.OS !== 'web') return
    setDragOverFolderId(null)
  }

  const handleDrop = async (targetFolderId: string | null) => {
    if (Platform.OS !== 'web' || !draggedItemId) return
    
    const note = notes.find(n => n.id === draggedItemId)
    if (!note) return

    if (note.folderId === targetFolderId) {
      setDragOverFolderId(null)
      return
    }

    try {
      await moveNoteToFolder(draggedItemId, targetFolderId)
    } catch (error) {
      console.error('Failed to move note:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to move note')
      setTimeout(() => setErrorMessage(null), 3000)
    }
    
    setDragOverFolderId(null)
  }

  const handleAddNote = () => {
    setIsNoteModalOpen(true)
  }

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false)
  }

  const handleSubmitNote = async (noteName: string) => {
    try {
      await addNote(noteName, currentFolderId || undefined)
      setIsNoteModalOpen(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add note'
      setErrorMessage(errorMessage)
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId)
  }

  const handleBackClick = () => {
    if (currentNoteId) {
      setCurrentNoteId(null)
    } else {
      setCurrentFolderId(null)
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

  const handleNoteBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }

  const handleCreateFolder = () => {
    setIsFolderModalOpen(true)
  }

  const handleCloseFolderModal = () => {
    setIsFolderModalOpen(false)
  }

  const handleSubmitFolder = async (folderName: string) => {
    try {
      await addFolder(folderName, 'note')
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

    const confirmed = await showConfirm(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await removeFolder(folderId, 'note')
      // If we're inside the deleted folder, navigate back
      if (currentFolderId === folderId) {
        setCurrentFolderId(null)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete folder'
      setErrorMessage(errorMessage)
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  const handleUploadNotes = async () => {
    if (!isLoggedIn) {
      setErrorMessage('Login to use AI tools')
      setTimeout(() => setErrorMessage(null), 3000)
      onOpenLoginModal()
      return
    }

    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click()
    } else {
      try {
        const file = await pickImage()
        if (file) {
          await handleFileChange(file as File)
        }
      } catch (error) {
        console.error('Failed to pick image:', error)
        setErrorMessage('Image picker not available on this platform')
        setTimeout(() => setErrorMessage(null), 3000)
      }
    }
  }

  const handleFileChange = async (file: File | Blob) => {
    if (!file) return

    // Validate file type
    if (file instanceof File && !file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const extractedText = await parseNotesImage(file)
      
      if (!extractedText || extractedText.trim().length === 0) {
        setErrorMessage('No text found in the notes image. Please ensure the image is clear and contains readable notes.')
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
          await addNote(noteTitle, currentFolderId || undefined)
          
          const currentState = useNotesStore.getState()
          const allNotes = currentState.notes
          
          const newNote = allNotes
            .filter(n => n.name === noteTitle && (n.folderId || null) === currentFolderId)
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return dateB - dateA
            })[0]
          
          if (newNote) {
            await updateNoteContent(newNote.id, extractedText)
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
        : 'Failed to process notes image. Please try again with a clearer image.'
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
            flex: 0,
            maxWidth: '100%',
          }]}>
            {!isMobile && (
            <Pressable style={styles.backButton} onPress={handleBackClick}>
              <BackIcon />
            </Pressable>
            )}
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentNote.name}</Text>
          </View>
        </View>
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
          <TextInput
            style={styles.editor}
            value={currentNote.content || ''}
            onChangeText={handleNoteContentChange}
            onBlur={handleNoteBlur}
            placeholder="Start typing..."
            multiline
            textAlignVertical="top"
            autoFocus={Platform.OS === 'web'}
            placeholderTextColor="#999"
            underlineColorAndroid="transparent"
            selectionColor={Platform.OS === 'web' ? '#0f0f0f' : undefined}
            scrollEnabled={false}
            {...(Platform.OS === 'web' && {
              // Remove focus outline on web
              className: 'note-editor-rn',
              onFocus: (e: any) => {
                if (e.target && e.target.style) {
                  e.target.style.setProperty('outline', 'none', 'important')
                  e.target.style.setProperty('border', 'none', 'important')
                  e.target.style.setProperty('box-shadow', 'none', 'important')
                }
              },
            })}
          />
        </ScrollView>
      </View>
    )
  }

  // Render notes grid/folder view
  type GridItem = (Folder & { itemType: 'folder' }) | (Note & { itemType: 'note' })
  const gridData: GridItem[] = [
    ...displayedFolders.map(f => ({ ...f, itemType: 'folder' as const })),
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
          {currentFolder ? (
            <>
              <Pressable style={styles.backButton} onPress={handleBackClick}>
                <BackIcon />
              </Pressable>
              <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentFolder.name}</Text>
            </>
          ) : (
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>Notes</Text>
          )}
        </View>
        <View style={[
          styles.headerButtons, 
          isMobile && [
            styles.headerButtonsMobile,
            { width: windowWidth } // Use actual screen width dynamically
          ]
        ]}>
          <Pressable style={[styles.createFolderButton, isMobile && styles.buttonMobile]} onPress={handleCreateFolder}>
            <View style={isMobile && styles.iconWrapperMobile}>
            <FolderIcon />
            </View>
            <Text style={[styles.createFolderButtonText, isMobile && styles.buttonTextMobile]}>Create Folder</Text>
          </Pressable>
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
          if (draggedItemId) {
                setDragOverFolderId(null)
              }
            },
            onDrop: (e: any) => {
              e.preventDefault()
              handleDrop(null)
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
              if (item.itemType === 'folder') {
                const folder = item as Folder & { itemType: 'folder' }
                const isDragOver = dragOverFolderId === folder.id
                return (
                  <Pressable 
                    style={[styles.folderCard, isDragOver && styles.folderCardDragOver]}
                    onPress={() => handleFolderClick(folder.id)}
                    {...(Platform.OS === 'web' && {
                      onDragOver: (e: any) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDragOver(folder.id)
                      },
                      onDragLeave: handleDragLeave,
                      onDrop: (e: any) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDrop(folder.id)
                      },
                    })}
                  >
                    <Pressable 
                      style={styles.cardDeleteButton}
                      onPress={async (e) => {
                        e.stopPropagation()
                        await handleDeleteFolder(folder.id)
                      }}
                    >
                      <DeleteIcon />
                    </Pressable>
                    <FolderIcon />
                    <Text style={styles.folderCardTitle}>{folder.name}</Text>
                  </Pressable>
                )
              } else {
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
                    <Text style={styles.noteCardTitle}>{note.name}</Text>
                  </Pressable>
                )
              }
            }}
          />
        </View>
      )}

      <AddNoteModal
        isOpen={isNoteModalOpen}
        onClose={handleCloseNoteModal}
        onSubmit={handleSubmitNote}
      />
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={handleCloseFolderModal}
        onSubmit={handleSubmitFolder}
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
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  createFolderButton: {
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
  createFolderButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
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
})

export default NotesView
