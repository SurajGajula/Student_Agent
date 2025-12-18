import { useState, useEffect } from 'react'

interface CreateFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (folderName: string) => void
}

function CreateFolderModal({ isOpen, onClose, onSubmit }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFolderName('')
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (folderName.trim()) {
      onSubmit(folderName.trim())
      setFolderName('')
      onClose()
    }
  }

  const handleClose = () => {
    setFolderName('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Folder</h2>
          <button className="modal-close" onClick={handleClose}>
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="folderName">Folder Name</label>
            <input
              type="text"
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateFolderModal

