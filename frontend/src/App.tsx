import { useState, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { AuthLoadingPage } from './pages/AuthLoadingPage'
import { LobbyPage } from './pages/LobbyPage'
import { ConferencePage } from './pages/ConferencePage'
import { ErrorBoundary } from './components/ErrorBoundary'

function AppContent() {
  const { token, user, botUsername, authStatus } = useAuth()
  const [screen, setScreen] = useState<'lobby' | 'conference'>('lobby')
  const [roomId, setRoomId] = useState<string | null>(null)
  const hasInitialNav = useRef(false)

  useEffect(() => {
    if (authStatus !== 'ok' || hasInitialNav.current) return
    hasInitialNav.current = true
    const roomFromUrl = new URLSearchParams(window.location.search).get('room')?.trim() || null
    if (roomFromUrl) {
      setRoomId(roomFromUrl)
      setScreen('conference')
    }
  }, [authStatus])

  useEffect(() => {
    if (screen === 'conference' && !token) {
      setRoomId(null)
      setScreen('lobby')
    }
  }, [screen, token])

  const isConference = screen === 'conference' && !!roomId && !!token

  if (authStatus === 'loading') {
    return <AuthLoadingPage />
  }

  if (isConference) {
    return (
      <ConferencePage
        roomId={roomId!}
        token={token}
        user={user}
        botUsername={botUsername}
        onLeave={() => {
          setRoomId(null)
          setScreen('lobby')
        }}
      />
    )
  }

  return (
    <LobbyPage
      token={token}
      user={user}
      onJoinRoom={(id) => {
        setRoomId(id)
        setScreen('conference')
      }}
      onCreateRoom={(id) => {
        setRoomId(id)
        setScreen('conference')
      }}
    />
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
