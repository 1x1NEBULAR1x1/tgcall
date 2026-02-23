import { useConference } from '../../hooks/useConference'
import { useDebug } from '../../context/DebugContext'
import type { AuthUser } from '../../types'
import { Loader } from '../../shared/ui/Loader'
import btnStyles from '../../shared/ui/buttons.module.css'
import errorStyles from '../../shared/ui/error.module.css'
import { DebugPanel } from '../../components/DebugPanel'
import { InviteModal } from './InviteModal'
import { CallMain } from './CallMain'
import { CallControls } from './CallControls'
import { CallPip } from './CallPip'
import styles from './Conference.module.css'

export interface ConferenceProps {
  roomId: string
  token: string | null
  user: AuthUser | null
  botUsername: string | null
  onLeave: () => void
}

export function Conference({ roomId, token, user, botUsername, onLeave }: ConferenceProps) {
  const { setConferenceDebug, addError } = useDebug()
  const {
    status,
    errorMsg,
    peers,
    peerVideoEnabled,
    peerAudioEnabled,
    videoEnabled,
    audioEnabled,
    flipping,
    reconnecting,
    avatarUrl,
    peerAvatarUrls,
    inviteModalOpen,
    inviteLinkCopied,
    inviteLink,
    setInviteModalOpen,
    copyInviteLink,
    setLocalVideoStream,
    toggleVideo,
    toggleAudio,
    toggleFacingMode,
    handleLeave,
    audioWsMode,
    toggleAudioWs,
    noiseSuppression,
    toggleNoiseSuppression,
  } = useConference({ roomId, token, user, botUsername, onLeave, setConferenceDebug, addError })

  const peerList = Object.entries(peers)
  const primaryPeer = peerList[0]
  const [primaryId, primaryData] = primaryPeer || []
  const primaryStream = primaryData?.stream ?? null
  const peerHasVideo = primaryId ? peerVideoEnabled[primaryId] !== false : false
  const peerHasAudio = primaryId ? peerAudioEnabled[primaryId] !== false : true

  if (status === 'loading') {
    return (
      <div className={`${styles.root} ${styles.loading}`}>
        <Loader label="Подключение к комнате…" />
      </div>
    )
  }

  if (reconnecting) {
    return (
      <div className={styles.view}>
        <div className={styles.main}>
          <div className={styles.reconnectWrap}>
            <Loader label="Переподключение…" />
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={`${styles.root} ${styles.error}`}>
        <p className={errorStyles.label}>{errorMsg}</p>
        <button
          type="button"
          className={`${btnStyles.btn} ${btnStyles.secondary}`}
          onClick={handleLeave}
        >
          Назад
        </button>
      </div>
    )
  }

  return (
    <div className={styles.view}>
      <DebugPanel
        placement="conference-top"
        audioWsMode={audioWsMode}
        onToggleAudioWs={toggleAudioWs}
        noiseSuppression={noiseSuppression}
        onToggleNoiseSuppression={toggleNoiseSuppression}
      />
      <div className={styles.topButtons}>
        <button
          type="button"
          className={styles.inviteBtn}
          onClick={() => setInviteModalOpen(true)}
          aria-label="Пригласить участников"
        >
          Пригласить
        </button>
      </div>

      {inviteModalOpen && (
        <InviteModal
          inviteLink={inviteLink ?? ''}
          inviteLinkCopied={inviteLinkCopied}
          onCopy={copyInviteLink}
          onClose={() => setInviteModalOpen(false)}
        />
      )}

      <CallMain
        primaryId={primaryId}
        primaryData={primaryData}
        peerStream={primaryStream}
        peerVideoEnabled={peerHasVideo}
        peerAudioEnabled={peerHasAudio}
        peerAvatarUrls={peerAvatarUrls}
        peerListLength={peerList.length}
      />

      {(videoEnabled || primaryData) && (
        <CallPip
          videoEnabled={videoEnabled}
          avatarUrl={avatarUrl}
          user={user}
          setLocalVideoStream={setLocalVideoStream}
        />
      )}

      <CallControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        flipping={flipping}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleFacingMode={toggleFacingMode}
        onLeave={handleLeave}
      />
    </div>
  )
}
