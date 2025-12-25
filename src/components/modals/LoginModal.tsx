import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { signIn, signUp, isLoading } = useAuthStore()

  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setPassword('')
      setName('')
      setError(null)
      setIsLogin(true)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isLogin) {
      // Login logic
      if (email.trim() && password.trim()) {
        try {
          await signIn(email.trim(), password.trim())
          handleClose()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to sign in'
          setError(errorMessage)
        }
      } else {
        setError('Please fill in all fields')
      }
    } else {
      // Signup logic
      if (email.trim() && password.trim() && name.trim()) {
        try {
          await signUp(email.trim(), password.trim(), name.trim())
          handleClose()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to sign up'
          setError(errorMessage)
        }
      } else {
        setError('Please fill in all fields')
      }
    }
  }

  const handleClose = () => {
    setEmail('')
    setPassword('')
    setName('')
    setIsLogin(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tabs">
          <div style={{ display: 'flex', flex: 1 }}>
            <button
              className={`modal-tab ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              className={`modal-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>
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
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="off"
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="off"
            />
          </div>
          {error && (
            <div className="form-error" style={{ 
              color: '#ff4444', 
              fontSize: '14px', 
              marginBottom: '16px',
              padding: '8px',
              backgroundColor: '#ffe6e6',
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginModal

