import { useState, useEffect } from 'react'

interface AddNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (noteName: string) => void
}

function AddNoteModal({ isOpen, onClose, onSubmit }: AddNoteModalProps) {
  const [noteName, setNoteName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNoteName('')
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (noteName.trim()) {
      onSubmit(noteName.trim())
      setNoteName('')
      onClose()
    }
  }

  const handleClose = () => {
    setNoteName('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Note</h2>
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
            <label htmlFor="noteName">Note Name</label>
            <input
              type="text"
              id="noteName"
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              placeholder="Enter note name"
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Note
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddNoteModal

