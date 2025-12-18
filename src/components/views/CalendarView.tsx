import { useState, useEffect, useMemo } from 'react'

function CalendarView() {
  const [currentWeek, setCurrentWeek] = useState<Date[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())

  // Generate time slots from 12:00 AM to 11:00 PM (24 hours)
  const timeSlots = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const hour = i
      const period = hour < 12 ? 'AM' : 'PM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return {
        hour,
        displayHour,
        period,
        label: `${displayHour}:00 ${period}`
      }
    })
  }, [])

  // Get the week dates (Sunday to Saturday)
  const getWeekDates = (date: Date): Date[] => {
    const week: Date[] = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day // Get Sunday of the week
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      week.push(date)
    }
    return week
  }

  useEffect(() => {
    setCurrentWeek(getWeekDates(currentDate))
  }, [currentDate])

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const getDateLabel = (date: Date): string => {
    return date.getDate().toString()
  }

  const getMonthYearLabel = (): string => {
    if (currentWeek.length === 0) {
      const today = new Date()
      return `${monthNames[today.getMonth()]} ${today.getFullYear()}`
    }
    const firstDay = currentWeek[0]
    const lastDay = currentWeek[6]
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return `${monthNames[firstDay.getMonth()]} ${firstDay.getFullYear()}`
    }
    return `${monthNames[firstDay.getMonth()]} - ${monthNames[lastDay.getMonth()]} ${firstDay.getFullYear()}`
  }

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Don't render calendar content until week is populated
  if (currentWeek.length === 0) {
    return (
      <div className="calendar-view">
        <div className="calendar-header">
          <div className="calendar-header-left">
            <h1>Calendar</h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <div className="calendar-header-left">
          <h1>Calendar</h1>
          <div className="calendar-nav">
            <button className="calendar-nav-button" onClick={goToPreviousWeek}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button className="calendar-nav-button" onClick={goToToday}>
              Today
            </button>
            <button className="calendar-nav-button" onClick={goToNextWeek}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <span className="calendar-month-year">{getMonthYearLabel()}</span>
          </div>
        </div>
      </div>
      <div className="calendar-container">
        <div className="calendar-days-header">
          {currentWeek.map((date, index) => (
            <div key={index} className="calendar-day-header">
              <div className="calendar-day-name">{dayNames[index]}</div>
              <div className="calendar-day-number">{getDateLabel(date)}</div>
            </div>
          ))}
        </div>
        <div className="calendar-scroll-container">
          <div className="calendar-time-sidebar">
            <div className="calendar-time-slots">
              {timeSlots.map((slot, index) => (
                <div key={`time-slot-${index}`} className="calendar-time-slot">
                  {slot.label}
                </div>
              ))}
            </div>
          </div>
          <div className="calendar-days-content">
            {timeSlots.map((slot, slotIndex) => (
              <div key={`time-row-${slotIndex}`} className="calendar-time-row">
                {currentWeek.map((date, dayIndex) => {
                  void slot
                  void date
                  return (
                  <div key={`cell-${slotIndex}-${dayIndex}`} className="calendar-time-cell"></div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalendarView

