import { useState, useRef } from 'react'
import AddClassModal from '../modals/AddClassModal'
import CreateFolderModal from '../modals/CreateFolderModal'
import { useClassesStore, type Class, type Folder } from '../../stores/classesStore'
import { useAuthStore } from '../../stores/authStore'
import { parseScheduleImage } from '../../lib/scheduleParser'

interface ClassesViewProps {
  onOpenLoginModal: () => void
}

function ClassesView({ onOpenLoginModal }: ClassesViewProps) {
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { classes, folders, addClass, addFolder, removeClass } = useClassesStore()
  const { isLoggedIn } = useAuthStore()

  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null
  const displayedClasses = currentFolderId 
    ? classes.filter(c => c.folderId === currentFolderId)
    : classes.filter(c => !c.folderId)
  const displayedFolders = currentFolderId ? [] : folders

  const handleAddClass = () => {
    setIsClassModalOpen(true)
  }

  const handleCloseClassModal = () => {
    setIsClassModalOpen(false)
  }

  const handleSubmitClass = (className: string, time?: { days: string[], timeRange: string }) => {
    addClass(className, currentFolderId || undefined, time)
  }

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId)
  }

  const handleBackClick = () => {
    setCurrentFolderId(null)
  }

  const handleCreateFolder = () => {
    setIsFolderModalOpen(true)
  }

  const handleCloseFolderModal = () => {
    setIsFolderModalOpen(false)
  }

  const handleSubmitFolder = (folderName: string) => {
    addFolder(folderName)
  }

  const handleUploadSchedule = () => {
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
      const parsedClasses = await parseScheduleImage(file)
      
      if (parsedClasses.length === 0) {
        setErrorMessage('No classes found in the schedule. Please ensure the image is clear and contains a schedule.')
        setTimeout(() => setErrorMessage(null), 5000)
      } else {
        // Add all parsed classes
        parsedClasses.forEach(parsedClass => {
          addClass(
            parsedClass.name,
            currentFolderId || undefined,
            {
              days: parsedClass.days,
              timeRange: parsedClass.timeRange
            }
          )
        })
        setSuccessMessage(`Successfully created ${parsedClasses.length} class${parsedClasses.length > 1 ? 'es' : ''} from schedule`)
        setTimeout(() => setSuccessMessage(null), 3000)
      }
    } catch (error) {
      console.error('Error processing schedule:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to process schedule image. Please try again with a clearer image.'
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

  return (
    <div className="classes-view">
      <div className="classes-header">
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
            <h1>Classes</h1>
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
            onClick={handleUploadSchedule}
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
                Upload Schedule
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
          <button className="add-class-button" onClick={handleAddClass}>
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
            Add Class
          </button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className={`schedule-message ${errorMessage ? 'error' : 'success'}`}>
          {errorMessage || successMessage}
        </div>
      )}

      <div className="classes-grid">
        {displayedFolders.length === 0 && displayedClasses.length === 0 ? (
          <div className="empty-state">
            <p>No classes yet. Click "Add Class" to get started.</p>
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
            {displayedClasses.map((classItem: Class) => (
              <div key={classItem.id} className="class-card">
                <button 
                  className="card-delete-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeClass(classItem.id)
                  }}
                  aria-label="Delete class"
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
                <h3>{classItem.name}</h3>
                {classItem.time && (
                  <div className="class-time">
                    <span className="class-days">{classItem.time.days.join(', ')}</span>
                    <span className="class-time-range">{classItem.time.timeRange}</span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <AddClassModal
        isOpen={isClassModalOpen}
        onClose={handleCloseClassModal}
        onSubmit={handleSubmitClass}
      />
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={handleCloseFolderModal}
        onSubmit={handleSubmitFolder}
      />
    </div>
  )
}

export default ClassesView

