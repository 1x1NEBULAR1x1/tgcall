import { useCallback, useEffect, useRef } from 'react'
import { MicOff } from 'lucide-react'
import ElectricBorder from '../../components/bits/ElectricBorder'
import GradientText from '../../components/bits/GradientText'
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

  const onVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
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
    const play = () => el.play().catch(() => {})
    play()
    const onAddTrack = () => play()
    peerStream.addEventListener('addtrack', onAddTrack)
    return () => {
      peerStream.removeEventListener('addtrack', onAddTrack)
    }
  }, [peerStream])

  const showVideo = peerVideoEnabled && !!peerStream

  return (
    <div className={styles.main}>
      {peerStream && (
        <>
          <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
          {showVideo ? (
            <video
              key={primaryId}
              ref={onVideoRef}
              autoPlay
              playsInline
              muted
              className={`${styles.video} ${styles.videoVisible}`}
            />
          ) : null}
        </>
      )}

      {showVideo && primaryData ? (
        <span className={styles.name}>
          <GradientText colors={['#e0f2fe', '#c4b5fd']} animationSpeed={5}>
            {primaryData.displayName}
          </GradientText>
        </span>
      ) : (
        <div className={`${styles.placeholder} ${styles.placeholderPeer}`}>
          <ElectricBorder
            color="#7df9ff"
            speed={1}
            chaos={0.12}
            borderRadius={999}
            round
            style={{ borderRadius: '50%' }}
          >
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
          </ElectricBorder>
          <span className={styles.waiting}>
            <GradientText colors={['#a5f3fc', '#c4b5fd']} animationSpeed={6}>
              {peerListLength > 0
                ? ['Камера выключена', !peerAudioEnabled && 'Микрофон выключен']
                  .filter(Boolean)
                  .join(' • ')
                : 'Ожидание участников'}
            </GradientText>
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
