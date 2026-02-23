import { useState } from 'react'
import { useDebug } from '../context/DebugContext'
import { API_URL } from '../config'
import styles from './DebugPanel.module.css'

interface DebugPanelProps {
  placement?: 'default' | 'conference-top'
  audioWsMode?: boolean
  onToggleAudioWs?: () => void
  noiseSuppression?: boolean
  onToggleNoiseSuppression?: () => void
}

type TabId = 'settings' | 'debug'

export function DebugPanel({
  placement = 'default',
  audioWsMode,
  onToggleAudioWs,
  noiseSuppression,
  onToggleNoiseSuppression,
}: DebugPanelProps) {
  const { globalErrors, clearErrors, conferenceDebug } = useDebug()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('settings')
  const [copyFeedback, setCopyFeedback] = useState(false)

  const hasErrors = globalErrors.length > 0
  const hasConference = !!conferenceDebug
  const hasPeerIssues =
    hasConference &&
    Object.values(conferenceDebug.peerStates).some(
      (p) =>
        p.connectionState === 'failed' ||
        p.connectionState === 'disconnected' ||
        p.iceConnectionState === 'failed'
    )

  const copyToClipboard = () => {
    const lines: string[] = []
    lines.push('=== Окружение ===')
    lines.push(`API_URL: ${API_URL || '(same-origin)'}`)
    lines.push(`protocol: ${typeof location !== 'undefined' ? location.protocol : '?'}`)
    if (conferenceDebug) {
      lines.push('')
      lines.push('=== Конференция ===')
      lines.push(`WebSocket: ${conferenceDebug.wsState} ${conferenceDebug.wsUrl || ''}`)
      lines.push(`TURN: ${conferenceDebug.hasTurn ? '✓' : '✗'}`)
      lines.push(`ICE: ${conferenceDebug.iceServers.join(', ')}`)
      lines.push(`Local: vid=${conferenceDebug.localTracks.video ? '✓' : '✗'} aud=${conferenceDebug.localTracks.audio ? '✓' : '✗'}`)
      Object.entries(conferenceDebug.peerStates).forEach(([id, p]) => {
        lines.push(`Peer ${id}: conn=${p.connectionState} ice=${p.iceConnectionState}`)
      })
    }
    if (globalErrors.length > 0) {
      lines.push('')
      lines.push('=== Ошибки ===')
      globalErrors.slice(-10).reverse().forEach((e) => {
        lines.push(`[${e.time}] [${e.type}] ${e.message}`)
        if (e.stack) lines.push(e.stack)
      })
    }
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }

  const panelInner = (
    <>
      <div className={styles.header}>
        <span>Дебаг</span>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setTab('settings')}
          >
            Настройки
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'debug' ? styles.tabActive : ''}`}
            onClick={() => setTab('debug')}
          >
            Дебаг
          </button>
        </div>
      </div>
      <div className={styles.body}>
        {tab === 'settings' && (
          <>
            {conferenceDebug && onToggleAudioWs && (
              <section>
                <h4>Аудио</h4>
                <div className={styles.toggleRow}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!audioWsMode}
                      onChange={onToggleAudioWs}
                    />
                    <span>Аудио через WebSocket</span>
                  </label>
                  {audioWsMode && <span className={styles.badge}>вкл</span>}
                </div>
                {onToggleNoiseSuppression && (
                  <div className={styles.toggleRow}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!noiseSuppression}
                        onChange={onToggleNoiseSuppression}
                      />
                      <span>Шумоподавление</span>
                    </label>
                    {noiseSuppression && <span className={styles.badge}>вкл</span>}
                  </div>
                )}
              </section>
            )}
            {conferenceDebug && (
              <section>
                <h4>Статус подключения</h4>
                <div className={styles.statusBlock}>
                  <div className={conferenceDebug.wsState === 'OPEN' ? styles.statusOk : styles.statusWarn}>
                    WebSocket: {conferenceDebug.wsState}
                  </div>
                  <div className={conferenceDebug.hasTurn ? styles.statusOk : styles.statusWarn}>
                    TURN: {conferenceDebug.hasTurn ? '✓' : '✗'}
                  </div>
                  <div className={styles.statusOk}>
                    Local: vid={conferenceDebug.localTracks.video ? '✓' : '✗'} aud={conferenceDebug.localTracks.audio ? '✓' : '✗'}
                  </div>
                  {Object.keys(conferenceDebug.peerStates).length > 0 && (
                    <>
                      {Object.entries(conferenceDebug.peerStates).map(([id, p]) => (
                        <div
                          key={id}
                          className={
                            p.connectionState === 'connected' && p.iceConnectionState === 'connected'
                              ? styles.statusOk
                              : styles.statusWarn
                          }
                        >
                          Peer {id}: conn={p.connectionState} ice={p.iceConnectionState}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        )}
        {tab === 'debug' && (
          <>
            <section>
              <h4>Окружение</h4>
              <pre className={styles.pre}>
                API_URL: {API_URL || '(same-origin)'}
                {'\n'}
                protocol: {typeof location !== 'undefined' ? location.protocol : '?'}
              </pre>
            </section>
            {conferenceDebug && (
              <section>
                <h4>Конференция</h4>
                <pre className={styles.pre}>
                  WebSocket: {conferenceDebug.wsState} {conferenceDebug.wsUrl && `(${conferenceDebug.wsUrl})`}
                  {'\n'}
                  TURN: {conferenceDebug.hasTurn ? '✓' : '✗'}
                  {conferenceDebug.iceDebug?.metered_error && (
                    <>
                      {'\n'}
                      <span className={styles.warn}>Metered: {conferenceDebug.iceDebug.metered_error}</span>
                    </>
                  )}
                  {'\n'}
                  ICE: {conferenceDebug.iceServers.join(', ')}
                  {'\n'}
                  Local: vid={conferenceDebug.localTracks.video ? '✓' : '✗'} aud={conferenceDebug.localTracks.audio ? '✓' : '✗'}
                  {Object.keys(conferenceDebug.peerStates).length > 0 && (
                    <>
                      {'\n'}
                      {Object.entries(conferenceDebug.peerStates).map(([id, p]) => (
                        <span
                          key={id}
                          className={
                            p.connectionState === 'connected' && p.iceConnectionState === 'connected'
                              ? styles.ok
                              : styles.warn
                          }
                        >
                          {'\n'}Peer {id}: conn={p.connectionState} ice={p.iceConnectionState}
                        </span>
                      ))}
                    </>
                  )}
                </pre>
              </section>
            )}
            <section>
              <div className={styles.sectionHeader}>
                <h4>Ошибки ({globalErrors.length})</h4>
                <div className={styles.actions}>
                  {globalErrors.length > 0 && (
                    <button type="button" className={styles.clearBtn} onClick={clearErrors}>
                      Очистить
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={copyToClipboard}
                  >
                    {copyFeedback ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>
              {globalErrors.length > 0 ? (
                globalErrors.slice(-10).reverse().map((e) => (
                  <div key={e.id} className={styles.error}>
                    <span className={styles.time}>{e.time}</span> [{e.type}] {e.message}
                    {e.stack && <pre className={styles.stack}>{e.stack}</pre>}
                  </div>
                ))
              ) : (
                <p className={styles.noErrors}>Нет ошибок</p>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )

  const panelContent = open && placement !== 'conference-top' && (
    <div className={styles.panel}>
      {panelInner}
    </div>
  )

  return (
    <>
      <div className={`${styles.root} ${placement === 'conference-top' ? styles.rootConferenceTop : ''}`}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setOpen((o) => !o)}
          title="Дебаг"
          data-badge={hasErrors || hasPeerIssues ? '!' : undefined}
        >
          ⚙
        </button>
        {panelContent}
      </div>
      {open && placement === 'conference-top' && (
        <div
          className={styles.backdrop}
          onClick={() => setOpen(false)}
          aria-hidden
        >
          <div
            className={`${styles.panel} ${styles.panelConferenceTop}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Дебаг"
          >
            {panelInner}
          </div>
        </div>
      )}
    </>
  )
}
