import { useCallback, useEffect, useRef } from 'react'
import { MicOff } from 'lucide-react'
import type { PeerInfo } from '../../types'
import styles from './CallMain.module.css'

interface CallMainProps {
  primaryId: string | undefined
  primaryData: PeerInfo | undefined
  peerStream: MediaStream | null
  peerVideoEnabled: boolean
  peerAudioEnabled: boolean
  peerAvatarUrls: Record<number, string>
  peerListLength: number
}

export function CallMain({
  primaryId,
  primaryData,
  peerStream,
  peerVideoEnabled,
  peerAudioEnabled,
  peerAvatarUrls,
  peerListLength,
}: CallMainProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const primaryUserId = primaryData?.userId

  const videoRef = useRef<HTMLVideoElement | null>(null)

  const onVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el
      if (el && peerStream) {
        el.srcObject = peerStream
        el.play().catch(() => { })
      }
    },
    [peerStream]
  )

  useEffect(() => {
    const el = audioRef.current
    if (!el || !peerStream) return
    el.srcObject = peerStream
    let retryId: ReturnType<typeof setInterval> | null = null
    let clickAdded = false

    const cleanup = () => {
      if (retryId) {
        clearInterval(retryId)
        retryId = null
      }
      document.removeEventListener('click', onUserInteraction)
    }

    const onUserInteraction = () => {
      el.play().then(cleanup).catch(() => {})
    }

    const tryPlay = () => {
      el.play()
        .then(cleanup)
        .catch(() => {
          if (!clickAdded) {
            clickAdded = true
            document.addEventListener('click', onUserInteraction, { once: true })
          }
          let attempts = 0
          const maxAttempts = 15
          retryId = setInterval(() => {
            attempts++
            el.play()
              .then(cleanup)
              .catch(() => {})
            if (attempts >= maxAttempts && retryId) {
              clearInterval(retryId)
              retryId = null
            }
          }, 1500)
        })
    }

    const onAddTrack = () => tryPlay()
    tryPlay()
    peerStream.addEventListener('addtrack', onAddTrack)
    return () => {
      peerStream.removeEventListener('addtrack', onAddTrack)
      cleanup()
    }
  }, [peerStream])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !peerStream) return
    el.srcObject = peerStream
    el.muted = true
    el.play().catch(() => {})
  }, [peerStream])

  const showVideo = peerVideoEnabled && !!peerStream

  return (
    <div className={styles.main}>
      {peerStream && (
        <>
          <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
          <video
            key={primaryId}
            ref={onVideoRef}
            autoPlay
            playsInline
            muted
            className={showVideo ? `${styles.video} ${styles.videoVisible}` : styles.videoHidden}
          />
        </>
      )}

      {showVideo && primaryData ? (
        <span className={styles.name}>
          {primaryData.displayName}
        </span>
      ) : (
        <div className={`${styles.placeholder} ${styles.placeholderPeer}`}>
          <div className={`${styles.avatarWrap} ${styles.avatarWrapBordered}`}>
            {primaryData ? (
              primaryUserId != null && peerAvatarUrls[primaryUserId] ? (
                <img src={peerAvatarUrls[primaryUserId]} alt="" className={styles.avatar} />
              ) : (
                <span className={styles.initials}>
                  {(primaryData.displayName?.[0] || '?').toUpperCase()}
                </span>
              )
            ) : (
              <span className={styles.initials}>?</span>
            )}
            {primaryData && !peerAudioEnabled && (
              <div className={`${styles.mutedOverlay} ${styles.mutedOverlayAvatar}`}>
                <MicOff size={56} strokeWidth={1.5} />
              </div>
            )}
          </div>
          <span className={styles.waiting}>
            {peerListLength > 0
              ? ['Камера выключена', !peerAudioEnabled && 'Микрофон выключен']
                .filter(Boolean)
                .join(' • ')
              : 'Ожидание участников'}
          </span>
        </div>
      )}

      {primaryData && !peerAudioEnabled && showVideo && (
        <div className={styles.mutedOverlay}>
          <MicOff size={64} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
