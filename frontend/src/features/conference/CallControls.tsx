import { Mic, MicOff, Video, VideoOff, RotateCw, PhoneOff } from 'lucide-react'
import GlassSurface from '../../components/bits/GlassSurface'
import styles from './CallControls.module.css'

interface CallControlsProps {
  audioEnabled: boolean
  videoEnabled: boolean
  flipping: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleFacingMode: () => void
  onLeave: () => void
}

export function CallControls({
  audioEnabled,
  videoEnabled,
  flipping,
  onToggleAudio,
  onToggleVideo,
  onToggleFacingMode,
  onLeave,
}: CallControlsProps) {
  return (
    <div className={styles.controls}>
      <GlassSurface
        width={400}
        height={76}
        borderRadius={24}
        borderWidth={0.06}
        opacity={0.88}
        blur={12}
        className={styles.glass}
        contentClassName={styles.glassContent}
        style={{ width: '100%' }}
      >
        <div className={styles.inner}>
          <button
            type="button"
            className={`${styles.icon} ${audioEnabled ? styles.default : styles.off}`}
            onClick={onToggleAudio}
            aria-label={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            {audioEnabled ? <Mic size={26} strokeWidth={2} /> : <MicOff size={26} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className={`${styles.icon} ${videoEnabled ? styles.default : styles.off}`}
            onClick={onToggleVideo}
            aria-label={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
          >
            {videoEnabled ? <Video size={26} strokeWidth={2} /> : <VideoOff size={26} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className={`${styles.icon} ${styles.default}`}
            onClick={onToggleFacingMode}
            disabled={flipping}
            aria-label="Переключить камеру"
          >
            <RotateCw size={26} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.icon} ${styles.hangup}`}
            onClick={onLeave}
            aria-label="Завершить"
          >
            <PhoneOff size={26} strokeWidth={2} />
          </button>
        </div>
      </GlassSurface>
    </div>
  )
}
