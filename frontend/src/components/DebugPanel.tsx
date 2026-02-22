import { useState } from 'react'
import { useDebug } from '../context/DebugContext'
import { API_URL } from '../config'
import styles from './DebugPanel.module.css'

export function DebugPanel() {
  const { globalErrors, clearErrors, conferenceDebug } = useDebug()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

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

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((o) => !o)}
        title="Дебаг"
        data-badge={hasErrors || hasPeerIssues ? '!' : undefined}
      >
        ⚙
      </button>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>Дебаг</span>
            <div className={styles.actions}>
              {globalErrors.length > 0 && (
                <button type="button" className={styles.clearBtn} onClick={clearErrors}>
                  Очистить
                </button>
              )}
              <button type="button" onClick={() => setExpanded((e) => !e)}>
                {expanded ? '−' : '+'}
              </button>
            </div>
          </div>
          <div className={styles.body}>
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
                  {conferenceDebug.iceDebug?.metered_tried && !conferenceDebug.iceDebug?.metered_ok && !conferenceDebug.iceDebug?.metered_error && (
                    <>
                      {'\n'}
                      <span className={styles.warn}>Metered: нет ответа (проверь .env)</span>
                    </>
                  )}
                  {'\n'}
                  ICE: {conferenceDebug.iceServers.slice(0, 3).join(', ')}
                  {conferenceDebug.iceServers.length > 3 && ` +${conferenceDebug.iceServers.length - 3}`}
                  {'\n'}
                  Local: vid={conferenceDebug.localTracks.video ? '✓' : '✗'} aud={conferenceDebug.localTracks.audio ? '✓' : '✗'}
                </pre>
                {Object.keys(conferenceDebug.peerStates).length > 0 && (
                  <>
                    <h4>Peer connections</h4>
                    {Object.entries(conferenceDebug.peerStates).map(([id, p]) => (
                      <div
                        key={id}
                        className={
                          p.connectionState === 'connected' && p.iceConnectionState === 'connected'
                            ? styles.ok
                            : styles.warn
                        }
                      >
                        {id}: conn={p.connectionState} ice={p.iceConnectionState}
                      </div>
                    ))}
                  </>
                )}
              </section>
            )}

            {globalErrors.length > 0 && (
              <section>
                <h4>Ошибки ({globalErrors.length})</h4>
                {globalErrors.slice(-10).reverse().map((e) => (
                  <div key={e.id} className={styles.error}>
                    <span className={styles.time}>{e.time}</span> [{e.type}] {e.message}
                    {expanded && e.stack && (
                      <pre className={styles.stack}>{e.stack}</pre>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
