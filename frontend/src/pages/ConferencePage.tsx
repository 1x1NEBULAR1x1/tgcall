import AppBackground from '../components/AppBackground'
import { Conference } from '../features/conference'
import type { AuthUser } from '../types'
import styles from './AppLayout.module.css'

interface ConferencePageProps {
  roomId: string
  token: string | null
  user: AuthUser | null
  botUsername: string | null
  onLeave: () => void
}

export function ConferencePage({
  roomId,
  token,
  user,
  botUsername,
  onLeave,
}: ConferencePageProps) {
  return (
    <div className={`${styles.app} ${styles.appConference}`}>
      <AppBackground className={styles.bg} />
      <Conference
        roomId={roomId}
        token={token}
        user={user}
        botUsername={botUsername}
        onLeave={onLeave}
      />
    </div>
  )
}
