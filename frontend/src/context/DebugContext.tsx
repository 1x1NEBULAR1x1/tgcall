import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { drainGlobalErrorQueue } from '../utils/globalErrorQueue'

export interface GlobalError {
  id: string
  time: string
  type: 'error' | 'unhandledrejection'
  message: string
  stack?: string
}

export interface PeerDebugState {
  connectionState: string
  iceConnectionState: string
}

export interface IceDebugInfo {
  metered_tried?: boolean
  metered_ok?: boolean
  metered_error?: string | null
}

export interface ConferenceDebugInfo {
  wsUrl: string
  wsState: string
  iceServers: string[]
  hasTurn: boolean
  iceDebug?: IceDebugInfo | null
  peerStates: Record<string, PeerDebugState>
  localTracks: { video: boolean; audio: boolean }
  lastError?: string
}

interface DebugContextValue {
  globalErrors: GlobalError[]
  addError: (type: 'error' | 'unhandledrejection', message: string, stack?: string) => void
  clearErrors: () => void
  conferenceDebug: ConferenceDebugInfo | null
  setConferenceDebug: (info: ConferenceDebugInfo | null) => void
}

const DebugContext = createContext<DebugContextValue | null>(null)

export function DebugProvider({ children }: { children: ReactNode }) {
  const [globalErrors, setGlobalErrors] = useState<GlobalError[]>([])
  const [conferenceDebug, setConferenceDebug] = useState<ConferenceDebugInfo | null>(null)

  const addError = useCallback((type: 'error' | 'unhandledrejection', message: string, stack?: string) => {
    setGlobalErrors((prev) => [
      ...prev.slice(-19),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        time: new Date().toLocaleTimeString(),
        type,
        message,
        stack,
      },
    ])
  }, [])

  const clearErrors = useCallback(() => setGlobalErrors([]), [])

  useEffect(() => {
    drainGlobalErrorQueue(addError)
  }, [addError])

  return (
    <DebugContext.Provider
      value={{
        globalErrors,
        addError,
        clearErrors,
        conferenceDebug,
        setConferenceDebug,
      }}
    >
      {children}
    </DebugContext.Provider>
  )
}

export function useDebug() {
  const ctx = useContext(DebugContext)
  if (!ctx) throw new Error('useDebug must be used within DebugProvider')
  return ctx
}
