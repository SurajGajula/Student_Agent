import { useState, useEffect, useRef } from 'react'
import AddNoteModal from '../modals/AddNoteModal'
import CreateFolderModal from '../modals/CreateFolderModal'
import { useNotesStore, type Note } from '../../stores/notesStore'
import { useFolderStore, type Folder, type FolderType } from '../../stores/folderStore'
import { useAuthStore } from '../../stores/authStore'
import { parseNotesImage } from '../../lib/notesParser'

interface NotesViewProps {
  onOpenLoginModal: () => void
}

function NotesView({ onOpenLoginModal }: NotesViewProps) {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { notes, addNote, updateNoteContentLocal, updateNoteContent, removeNote } = useNotesStore()
  const { getFoldersByType, addFolder } = useFolderStore()
  const { isLoggedIn } = useAuthStore()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const folders = getFoldersByType('note')
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null
  const currentNote = currentNoteId ? notes.find(n => n.id === currentNoteId) : null
  const displayedNotes = currentFolderId 
    ? notes.filter(n => n.folderId === currentFolderId)
    : notes.filter(n => !n.folderId)
  const displayedFolders = currentFolderId ? [] : folders

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleAddNote = () => {
    setIsNoteModalOpen(true)
  }

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false)
  }

  const handleSubmitNote = async (noteName: string) => {
    try {
      await addNote(noteName, currentFolderId || undefined)
    } catch (error) {
      console.error('Failed to add note:', error)
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
    
    // Update local state immediately for instant UI feedback
    updateNoteContentLocal(currentNoteId, content)
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce the Supabase save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateNoteContent(currentNoteId, content)
      } catch (err) {
        console.error('Failed to save note:', err)
        // Note: On error, the local state will be out of sync, but syncFromSupabase will fix it
      }
    }, 1000) // 1 second debounce
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

  const handleUploadNotes = () => {
    if (!isLoggedIn) {
      setErrorMessage('Login to use AI tools')
      setTimeout(() => setErrorMessage(null), 3000)
      onOpenLoginModal()
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
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
        // Extract a title from the notes (try to get course code or use first line)
        let noteTitle = 'Untitled Note'
        const lines = extractedText.split('\n').filter(line => line.trim().length > 0)
        
        if (lines.length > 0) {
          // Try to find a course code pattern (e.g., "CEE 2220", "CS 101")
          const courseCodeMatch = lines[0].match(/[A-Z]{2,4}\s*\d{4}[A-Z]?/)
          if (courseCodeMatch) {
            noteTitle = courseCodeMatch[0].trim()
          } else {
            // Use first line as title (limit to 50 chars)
            const firstLine = lines[0].trim()
            noteTitle = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
          }
        }

        // Create note with extracted text
        await addNote(noteTitle, currentFolderId || undefined)
        
        // Get the current state from the store to find the newly created note
        const currentState = useNotesStore.getState()
        const allNotes = currentState.notes
        
        // Find the note we just created (should be the most recent one with matching name and folder)
        const newNote = allNotes
          .filter(n => n.name === noteTitle && (n.folderId || null) === currentFolderId)
          .sort((a, b) => {
            // Sort by created date (most recent first)
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          })[0]
        
        if (newNote) {
          // Update the note content and open it for editing
          await updateNoteContent(newNote.id, extractedText)
          setCurrentNoteId(newNote.id)
          setSuccessMessage('Notes uploaded successfully')
          setTimeout(() => setSuccessMessage(null), 3000)
        } else {
          setErrorMessage('Failed to create note. Please try again.')
          setTimeout(() => setErrorMessage(null), 3000)
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Render note editor view
  if (currentNoteId && currentNote) {
    return (
      <div className="notes-view">
        <div className="notes-header">
          <div className="header-title">
            <button className="back-button" onClick={handleBackClick}>
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
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1>{currentNote.name}</h1>
          </div>
        </div>
        <div className="note-editor-container">
          <textarea
            className="note-editor"
            value={currentNote.content || ''}
            onChange={(e) => handleNoteContentChange(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Start typing..."
            autoFocus
          />
        </div>
      </div>
    )
  }

  // Render notes grid/folder view
  return (
    <div className="notes-view">
      <div className="notes-header">
        <div className="header-title">
          {currentFolder ? (
            <>
              <button className="back-button" onClick={handleBackClick}>
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
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <h1>{currentFolder.name}</h1>
            </>
          ) : (
            <h1>Notes</h1>
          )}
        </div>
        <div className="header-buttons">
          <button className="create-folder-button" onClick={handleCreateFolder}>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            Create Folder
          </button>
          <button 
            className="upload-schedule-button" 
            onClick={handleUploadNotes}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"/>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Notes
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button className="add-note-button" onClick={handleAddNote}>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Notes
          </button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className={`schedule-message ${errorMessage ? 'error' : 'success'}`}>
          {errorMessage || successMessage}
        </div>
      )}

      <div className="notes-grid">
        {displayedFolders.length === 0 && displayedNotes.length === 0 ? (
          <div className="empty-state">
            <p>No notes yet. Click "Add Notes" to get started.</p>
          </div>
        ) : (
          <>
            {displayedFolders.map((folder: Folder) => (
              <div key={folder.id} className="folder-card" onClick={() => handleFolderClick(folder.id)}>
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <h3>{folder.name}</h3>
              </div>
            ))}
            {displayedNotes.map((note: Note) => (
              <div key={note.id} className="note-card" onClick={() => handleNoteClick(note.id)}>
                <button 
                  className="card-delete-button"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      await removeNote(note.id)
                    } catch (error) {
                      console.error('Failed to remove note:', error)
                    }
                  }}
                  aria-label="Delete note"
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
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
                <h3>{note.name}</h3>
              </div>
            ))}
          </>
        )}
      </div>

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
    </div>
  )
}

export default NotesView

