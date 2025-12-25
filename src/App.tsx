import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ClassesView from './components/views/ClassesView'
import NotesView from './components/views/NotesView'
import TestsView from './components/views/TestsView'
import JobsView from './components/views/JobsView'
import EventsView from './components/views/EventsView'
import CalendarView from './components/views/CalendarView'
import SettingsView from './components/views/SettingsView'
import ChatBar from './components/ChatBar'
import LoginModal from './components/modals/LoginModal'

function App() {
  const [currentView, setCurrentView] = useState<string>('classes')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const openLoginModal = () => {
    setIsLoginModalOpen(true)
  }

  const closeLoginModal = () => {
    setIsLoginModalOpen(false)
  }

  return (
    <div className="app">
      <Sidebar onNavigate={setCurrentView} />
      <main className="main-content">
        {currentView === 'classes' && <ClassesView onOpenLoginModal={openLoginModal} />}
        {currentView === 'notes' && <NotesView onOpenLoginModal={openLoginModal} />}
        {currentView === 'tests' && <TestsView />}
        {currentView === 'jobs' && <JobsView />}
        {currentView === 'events' && <EventsView />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'settings' && <SettingsView />}
        <ChatBar onOpenLoginModal={openLoginModal} />
      </main>
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
    </div>
  )
}

export default App

