import type { AuthUser } from '../../types'
import styles from './CallPip.module.css'

interface CallPipProps {
  videoEnabled: boolean
  avatarUrl: string | null
  user: AuthUser | null
  setLocalVideoStream: (el: HTMLVideoElement | null) => void
}

export function CallPip({
  videoEnabled,
  avatarUrl,
  user,
  setLocalVideoStream,
}: CallPipProps) {
  return (
    <div className={styles.pip}>
      {videoEnabled ? (
        <video ref={setLocalVideoStream} autoPlay playsInline muted className={styles.video} />
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.gradient} />
          <div className={styles.avatarCircle}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.avatar} />
            ) : (
              <span className={styles.initials}>
                {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
