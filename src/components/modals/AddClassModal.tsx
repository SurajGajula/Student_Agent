import { useState, useEffect } from 'react'

interface AddClassModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (className: string, time?: { days: string[], timeRange: string }) => void
}

function AddClassModal({ isOpen, onClose, onSubmit }: AddClassModalProps) {
  const [className, setClassName] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>('PM')

  const days = [
    { value: 'M', label: 'M' },
    { value: 'T', label: 'T' },
    { value: 'W', label: 'W' },
    { value: 'TH', label: 'TH' },
    { value: 'F', label: 'F' }
  ]

  useEffect(() => {
    if (isOpen) {
      setClassName('')
      setSelectedDays([])
      setStartTime('')
      setEndTime('')
      setTimePeriod('PM')
    }
  }, [isOpen])

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (className.trim()) {
      let time: { days: string[], timeRange: string } | undefined
      
      if (selectedDays.length > 0 && startTime && endTime) {
        const timeRange = `${startTime}-${endTime} ${timePeriod}`
        time = {
          days: selectedDays,
          timeRange: timeRange
        }
      }
      
      onSubmit(className.trim(), time)
      setClassName('')
      setSelectedDays([])
      setStartTime('')
      setEndTime('')
      setTimePeriod('PM')
      onClose()
    }
  }

  const handleClose = () => {
    setClassName('')
    setSelectedDays([])
    setStartTime('')
    setEndTime('')
    setTimePeriod('PM')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Class</h2>
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
            <label htmlFor="className">Class Name</label>
            <input
              type="text"
              id="className"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Enter class name"
              autoFocus
              autoComplete="off"
            />
          </div>
          
          <div className="form-group">
            <label>Days of Week</label>
            <div className="days-selector">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`day-button ${selectedDays.includes(day.value) ? 'selected' : ''}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Time Range</label>
            <div className="time-range-inputs">
              <input
                type="text"
                className="time-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="7:40"
                autoComplete="off"
              />
              <span className="time-separator">-</span>
              <input
                type="text"
                className="time-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="8:50"
                autoComplete="off"
              />
              <select
                className="time-period-select"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as 'AM' | 'PM')}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Class
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddClassModal

