import AppBackground from '../components/AppBackground'
import { DebugPanel } from '../components/DebugPanel'
import { Lobby } from '../features/lobby'
import type { AuthUser } from '../types'
import styles from './AppLayout.module.css'

interface LobbyPageProps {
  token: string | null
  user: AuthUser | null
  onJoinRoom: (id: string) => void
  onCreateRoom: (id: string) => void
}

export function LobbyPage({ token, user, onJoinRoom, onCreateRoom }: LobbyPageProps) {
  return (
    <div className={styles.app}>
      <AppBackground className={styles.bg} />
      <div className={styles.content}>
        <Lobby token={token} user={user} onJoinRoom={onJoinRoom} onCreateRoom={onCreateRoom} />
      </div>
      <DebugPanel />
    </div>
  )
}
