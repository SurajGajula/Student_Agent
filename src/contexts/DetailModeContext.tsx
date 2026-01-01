import React, { createContext, useContext, useState, ReactNode } from 'react'

interface DetailModeContextType {
  isInDetailMode: boolean
  setIsInDetailMode: (value: boolean) => void
}

const DetailModeContext = createContext<DetailModeContextType | undefined>(undefined)

export function DetailModeProvider({ children }: { children: ReactNode }) {
  const [isInDetailMode, setIsInDetailMode] = useState(false)

  return (
    <DetailModeContext.Provider value={{ isInDetailMode, setIsInDetailMode }}>
      {children}
    </DetailModeContext.Provider>
  )
}

export function useDetailMode() {
  const context = useContext(DetailModeContext)
  if (context === undefined) {
    throw new Error('useDetailMode must be used within a DetailModeProvider')
  }
  return context
}

