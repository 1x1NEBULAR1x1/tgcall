import { useState, useRef, useEffect, useCallback } from 'react'
import { API_URL, getWsUrl } from '../config'
import { safeJson } from '../utils/safeJson'
import type { AuthUser } from '../types'
import type { PeerInfo } from '../types'
import type { ConferenceDebugInfo, IceDebugInfo } from '../context/DebugContext'
import {
  renegotiatePeer,
  canSetRemoteAnswer,
  canSetRemoteOffer,
  AUDIO_SAMPLE_RATE,
  AUDIO_CHUNK_SAMPLES,
  NOISE_FLOOR,
  NOISE_SMOOTH_K,
  GAIN_SMOOTH_ALPHA,
} from './conference'
import { createProcessedStream } from './conference/processedStream'

export interface UseConferenceProps {
  roomId: string
  token: string | null
  user: AuthUser | null
  botUsername: string | null
  onLeave: () => void
  setConferenceDebug?: (info: ConferenceDebugInfo | null) => void
  addError?: (type: 'error' | 'unhandledrejection', message: string, stack?: string) => void
}

export type ConferenceStatus = 'loading' | 'ready' | 'error'

export interface UseConferenceResult {
  status: ConferenceStatus
  errorMsg: string
  peers: Record<string, PeerInfo>
  peerVideoEnabled: Record<string, boolean>
  peerAudioEnabled: Record<string, boolean>
  videoEnabled: boolean
  audioEnabled: boolean
  flipping: boolean
  reconnecting: boolean
  avatarUrl: string | null
  peerAvatarUrls: Record<number, string>
  inviteModalOpen: boolean
  inviteLinkCopied: boolean
  inviteLink: string
  setInviteModalOpen: (v: boolean) => void
  copyInviteLink: () => void
  setLocalVideoStream: (el: HTMLVideoElement | null) => void
  toggleVideo: () => void
  toggleAudio: () => void
  toggleFacingMode: () => void
  handleLeave: () => void
  audioWsMode: boolean
  toggleAudioWs: () => void
  noiseSuppression: boolean
  toggleNoiseSuppression: () => void
}

export function useConference({
  roomId,
  token,
  user: _user,
  botUsername,
  onLeave,
  setConferenceDebug,
  addError,
}: UseConferenceProps): UseConferenceResult {
  const [status, setStatus] = useState<ConferenceStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({})
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [facingMode, setFacingMode] = useState('user')
  const [flipping, setFlipping] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [lowQualityMode, setLowQualityMode] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [peerAvatarUrls, setPeerAvatarUrls] = useState<Record<number, string>>({})
  const [peerVideoEnabled, setPeerVideoEnabled] = useState<Record<string, boolean>>({})
  const [peerAudioEnabled, setPeerAudioEnabled] = useState<Record<string, boolean>>({})
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const [audioWsMode, setAudioWsMode] = useState(false)
  const [noiseSuppression, setNoiseSuppression] = useState(true)

  const avatarUrlRef = useRef<string | null>(null)
  const peerAvatarRefs = useRef<Record<number, string>>({})
  const connectionPoorCountRef = useRef(0)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({})
  const peerStreamsRef = useRef<Record<string, MediaStream>>({})
  const connectedOnceRef = useRef<Record<string, boolean>>({})
  const iceQueueRef = useRef<Record<string, object[]>>({})
  const myPeerIdRef = useRef<string | null>(null)
  const leaveIntentionalRef = useRef(false)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const iceServersListRef = useRef<RTCIceServer[]>([])
  const wsUrlRef = useRef<string>('')
  const iceDebugRef = useRef<IceDebugInfo | null>(null)
  const audioWsModeRef = useRef(false)
  const noiseSuppressionRef = useRef(false)
  const audioCaptureCleanupRef = useRef<(() => void) | null>(null)
  const audioPlaybackCtxRef = useRef<AudioContext | null>(null)
  const audioPlaybackNextTimeRef = useRef(0)
  const processedStreamRef = useRef<MediaStream | null>(null)
  const processedStreamCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    audioWsModeRef.current = audioWsMode
  }, [audioWsMode])
  useEffect(() => {
    noiseSuppressionRef.current = noiseSuppression
  }, [noiseSuppression])

  const updateDebug = useCallback(() => {
    if (!setConferenceDebug) return
    const ws = wsRef.current
    const wsState = ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] ?? 'UNKNOWN' : 'null'
    const peerStates: Record<string, { connectionState: string; iceConnectionState: string }> = {}
    Object.entries(peerConnectionsRef.current).forEach(([id, pc]) => {
      peerStates[id] = {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      }
    })
    const list = iceServersListRef.current
    const iceUrls = list.flatMap((s) => (typeof s.urls === 'string' ? [s.urls] : Array.isArray(s.urls) ? s.urls : []))
    const hasTurn = iceUrls.some((u) => u.includes('turn:') || u.includes('turns:'))
    const stream = streamRef.current
    setConferenceDebug({
      wsUrl: wsUrlRef.current,
      wsState,
      iceServers: iceUrls,
      hasTurn,
      iceDebug: iceDebugRef.current,
      peerStates,
      localTracks: {
        video: !!stream?.getVideoTracks()[0],
        audio: !!stream?.getAudioTracks()[0],
      },
    })
  }, [setConferenceDebug])

  const drainIceQueue = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current[peerId]
    const queue = iceQueueRef.current[peerId]
    if (!pc || !queue?.length) return
    iceQueueRef.current[peerId] = []
    queue.forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { })
    })
  }, [])

  const addPeer = useCallback(
    (peerId: string, displayName: string, stream: MediaStream | null = null, userId: number | null = null) => {
      setPeers((prev) => ({
        ...prev,
        [peerId]: { displayName, stream, userId: userId ?? prev[peerId]?.userId },
      }))
    },
    []
  )

  const addPeerTrack = useCallback((peerId: string, track: MediaStreamTrack) => {
    let stream = peerStreamsRef.current[peerId]
    if (!stream) {
      stream = new MediaStream()
      peerStreamsRef.current[peerId] = stream
    }
    if (stream.getTracks().some((t) => t.id === track.id)) return
    stream.addTrack(track)
    const streamToSet = stream.clone()
    setPeers((prev) => {
      const next = { ...prev }
      const existing = next[peerId]
      const peer = existing ?? { displayName: 'Участник', stream: null as MediaStream | null, userId: null as number | null }
      next[peerId] = { ...peer, stream: streamToSet }
      return next
    })
  }, [])

  const removePeer = useCallback((peerId: string) => {
    setPeers((prev) => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
    setPeerVideoEnabled((prev) => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
    setPeerAudioEnabled((prev) => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
    const pc = peerConnectionsRef.current[peerId]
    if (pc) {
      pc.close()
      delete peerConnectionsRef.current[peerId]
    }
    delete peerStreamsRef.current[peerId]
    delete connectedOnceRef.current[peerId]
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`${API_URL}/avatar`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return
        if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current)
        const url = URL.createObjectURL(blob)
        avatarUrlRef.current = url
        setAvatarUrl(url)
      })
      .catch(() => { })
    return () => {
      cancelled = true
      if (avatarUrlRef.current) {
        URL.revokeObjectURL(avatarUrlRef.current)
        avatarUrlRef.current = null
      }
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent)
      const videoConstraints = isMobile
        ? { facingMode: 'user' as const, width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 } }
        : { width: { ideal: 640 }, height: { ideal: 480 } }
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : 'Нет доступа к микрофону')
          setStatus('error')
          return
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = false
      }
      setVideoEnabled(!!videoTrack?.enabled)
      setAudioEnabled(!!stream.getAudioTracks()[0]?.enabled)
      setStatus('ready')
    }
    run()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  const setLocalVideoStream = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el
    if (el && streamRef.current) {
      el.srcObject = streamRef.current
      el.muted = true
      el.play().catch(() => { })
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || !streamRef.current || !token) return
    leaveIntentionalRef.current = false
    const stream = streamRef.current
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.muted = true
      localVideoRef.current.play().catch(() => { })
    }

    const wsUrl = getWsUrl(
      `/ws/conference?room_id=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
    )

    const defaultIceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]

    const hasTurn = (list: RTCIceServer[]) =>
      list.some((s) => {
        const u = (typeof s.urls === 'string' ? s.urls : Array.isArray(s.urls) ? s.urls.join(' ') : '') || ''
        return u.includes('turn:') || u.includes('turns:')
      })

    let cancelled = false
    const run = async () => {
      let iceServers = defaultIceServers
      iceDebugRef.current = null
      try {
        const r = await fetch(`${API_URL}/ice-servers?debug=1`)
        if (r.ok) {
          const d = await safeJson<{ iceServers?: RTCIceServer[]; _debug?: IceDebugInfo }>(r)
          if (d?.iceServers?.length) iceServers = d.iceServers
          if (d?._debug) iceDebugRef.current = d._debug
        }
      } catch { /* use defaults */ }
      if (cancelled) return

      const playAudioChunk = (buf: ArrayBuffer) => {
        if (!audioWsModeRef.current) return
        let ctx = audioPlaybackCtxRef.current
        if (!ctx) {
          ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
          audioPlaybackCtxRef.current = ctx
        }
        const samples = new Int16Array(buf)
        const float32 = new Float32Array(samples.length)
        for (let i = 0; i < samples.length; i++) float32[i] = samples[i]! / 32768
        const now = ctx.currentTime
        if (audioPlaybackNextTimeRef.current < now) audioPlaybackNextTimeRef.current = now
        const startTime = audioPlaybackNextTimeRef.current
        audioPlaybackNextTimeRef.current = startTime + float32.length / AUDIO_SAMPLE_RATE
        const audioBuf = ctx.createBuffer(1, float32.length, AUDIO_SAMPLE_RATE)
        audioBuf.copyToChannel(float32, 0)
        const source = ctx.createBufferSource()
        source.buffer = audioBuf
        source.connect(ctx.destination)
        source.start(startTime)
      }

      const setupHandlers = (ws: WebSocket, iceServersList: RTCIceServer[]) => {
        iceServersListRef.current = iceServersList
        wsUrlRef.current = wsUrl
        ws.binaryType = 'arraybuffer'
        updateDebug()
        const rtcOptions: RTCConfiguration = {
          iceServers: iceServersList,
          bundlePolicy: 'max-bundle',
        }
        if (hasTurn(iceServersList)) {
          rtcOptions.iceTransportPolicy = 'relay' // форсировать TURN — помогает при разных сетях
        }
        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            playAudioChunk(event.data)
            return
          }
          let msg: Record<string, unknown>
          try {
            const raw = event.data
            if (typeof raw !== 'string' || !raw.trim()) return
            msg = JSON.parse(raw) as Record<string, unknown>
          } catch {
            return
          }
          try {
            if (msg.type === 'you_joined') {
              myPeerIdRef.current = (msg.peer_id as string) ?? null
              reconnectAttemptRef.current = 0
              setReconnecting(false)
              const joinedPeers = (msg.peers as Array<{ peer_id: string; first_name?: string; user_id?: number; video_enabled?: boolean; audio_enabled?: boolean }>) || []
              joinedPeers.forEach((p) => addPeer(p.peer_id, p.first_name || 'Участник', null, p.user_id ?? null))
              const videoMap: Record<string, boolean> = {}
              const audioMap: Record<string, boolean> = {}
              joinedPeers.forEach((p) => {
                videoMap[p.peer_id] = p.video_enabled !== false
                audioMap[p.peer_id] = p.audio_enabled !== false
              })
              setPeerVideoEnabled((prev) => ({ ...prev, ...videoMap }))
              setPeerAudioEnabled((prev) => ({ ...prev, ...audioMap }))
              const str = streamRef.current
              if (ws.readyState === WebSocket.OPEN && str) {
                ws.send(JSON.stringify({ type: 'video_status', enabled: !!str.getVideoTracks()[0]?.enabled }))
                ws.send(JSON.stringify({ type: 'audio_status', enabled: !!str.getAudioTracks()[0]?.enabled }))
              }
              // Новый участник инициирует RTC-соединения с уже находящимися в комнате
              const streamForPeer = audioWsModeRef.current ? streamRef.current : (processedStreamRef.current || streamRef.current)
              if (streamForPeer && ws.readyState === WebSocket.OPEN) {
                joinedPeers.forEach((p) => {
                  const peerId = p.peer_id
                  if (peerConnectionsRef.current[peerId]) return
                  iceQueueRef.current[peerId] = []
                  const pc = new RTCPeerConnection(rtcOptions)
                  const tracksToAdd = (audioWsModeRef.current
                    ? streamForPeer.getTracks().filter((t) => t.kind === 'video')
                    : streamForPeer.getTracks()
                  ).filter((t) => t.readyState !== 'ended')
                  tracksToAdd.forEach((track) => {
                    try {
                      pc.addTrack(track, streamForPeer)
                    } catch (err) {
                      addError?.('error', `addTrack: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined)
                    }
                  })
                  pc.ontrack = (e: RTCTrackEvent) => addPeerTrack(peerId, e.track)
                  pc.oniceconnectionstatechange = () => updateDebug()
                  pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
                    if (e.candidate && ws.readyState === WebSocket.OPEN)
                      ws.send(JSON.stringify({ type: 'ice', to_peer_id: peerId, payload: e.candidate }))
                  }
                  pc.onconnectionstatechange = () => {
                    updateDebug()
                    if (pc.connectionState === 'connected') connectedOnceRef.current[peerId] = true
                    if (pc.connectionState === 'failed' && connectedOnceRef.current[peerId] && typeof pc.restartIce === 'function') {
                      pc.restartIce()
                      const send = (desc: RTCSessionDescriptionInit, type: 'offer' | 'answer') => {
                        pc.setLocalDescription(desc).then(() => drainIceQueue(peerId)).catch(() => { })
                        if (ws.readyState === WebSocket.OPEN)
                          ws.send(JSON.stringify({ type, to_peer_id: peerId, payload: desc }))
                      }
                      if (pc.signalingState === 'have-remote-offer') {
                        pc.createAnswer().then((a) => send(a, 'answer')).catch(() => { })
                      } else {
                        pc.createOffer().then((o) => send(o, 'offer')).catch(() => { })
                      }
                    }
                  }
                  peerConnectionsRef.current[peerId] = pc
                  pc.createOffer().then((offer) => {
                    pc.setLocalDescription(offer).then(() => drainIceQueue(peerId))
                    ws.send(JSON.stringify({ type: 'offer', to_peer_id: peerId, payload: offer }))
                  })
                })
              }
              return
            }
            if (msg.type === 'video_status') {
              const peerId = msg.peer_id as string
              const enabled = msg.enabled as boolean
              if (peerId) setPeerVideoEnabled((prev) => ({ ...prev, [peerId]: enabled }))
              return
            }
            if (msg.type === 'audio_status') {
              const peerId = msg.peer_id as string
              const enabled = msg.enabled as boolean
              if (peerId) setPeerAudioEnabled((prev) => ({ ...prev, [peerId]: enabled }))
              return
            }
            if (msg.type === 'audio_ws_mode') {
              const enabled = msg.enabled as boolean
              setAudioWsMode(!!enabled)
              if (enabled) {
                Object.values(peerConnectionsRef.current).forEach((pc) => {
                  const sender = pc.getSenders().find((s) => s.track?.kind === 'audio')
                  if (sender) {
                    try {
                      sender.replaceTrack(null)
                    } catch (err) {
                      addError?.('error', `replaceTrack: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined)
                    }
                  }
                })
              } else {
                const stream = processedStreamRef.current || streamRef.current
                if (stream) {
                  const audioTrack = stream.getAudioTracks()[0]
                  if (audioTrack && audioTrack.readyState !== 'ended') {
                    const sendOverWs = (type: 'offer' | 'answer', toPeerId: string, payload: RTCSessionDescriptionInit) => {
                      if (ws.readyState === WebSocket.OPEN)
                        ws.send(JSON.stringify({ type, to_peer_id: toPeerId, payload }))
                    }
                    Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
                      if (pc.connectionState === 'closed') return
                      const sender = pc.getSenders().find((s) => s.track?.kind === 'audio') ?? pc.getSenders().find((s) => !s.track)
                      try {
                        if (sender) {
                          sender.replaceTrack(audioTrack).then(() => {
                            renegotiatePeer(pc, peerId, drainIceQueue, sendOverWs)
                          }).catch(() => {})
                        } else {
                          pc.addTrack(audioTrack, stream)
                          renegotiatePeer(pc, peerId, drainIceQueue, sendOverWs)
                        }
                      } catch (err) {
                        addError?.('error', `addTrack: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined)
                      }
                    })
                  }
                }
              }
              return
            }
            if (msg.type === 'peer_joined') {
              addPeer(
                msg.peer_id as string,
                (msg.first_name as string) || 'Участник',
                null,
                msg.user_id as number | undefined
              )
              const joinedPeerId = msg.peer_id as string
              setPeerVideoEnabled((prev) => ({ ...prev, [joinedPeerId]: (msg.video_enabled as boolean) !== false }))
              setPeerAudioEnabled((prev) => ({ ...prev, [joinedPeerId]: (msg.audio_enabled as boolean) !== false }))
              // RTC инициирует новый участник (в you_joined), здесь только добавляем в UI
              return
            }
            if (msg.type === 'peer_left') {
              removePeer(msg.peer_id as string)
              return
            }
            if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') {
              const fromId = msg.from_peer_id as string
              const payload = msg.payload
              if (!fromId) return
              let pc = peerConnectionsRef.current[fromId]
              if (msg.type === 'offer') {
                if (!pc) {
                  iceQueueRef.current[fromId] = []
                  const stream = audioWsModeRef.current ? streamRef.current : (processedStreamRef.current || streamRef.current)
                  pc = new RTCPeerConnection(rtcOptions)
                  if (stream) {
                    const tracksToAdd = (audioWsModeRef.current
                      ? stream.getTracks().filter((t) => t.kind === 'video')
                      : stream.getTracks()
                    ).filter((t) => t.readyState !== 'ended')
                    tracksToAdd.forEach((track) => {
                      try {
                        pc?.addTrack(track, stream)
                      } catch (err) {
                        addError?.('error', `addTrack: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined)
                      }
                    })
                  }
                  pc.ontrack = (e: RTCTrackEvent) => addPeerTrack(fromId, e.track)
                  pc.oniceconnectionstatechange = () => updateDebug()
                  pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
                    if (e.candidate && ws.readyState === WebSocket.OPEN)
                      ws.send(JSON.stringify({ type: 'ice', to_peer_id: fromId, payload: e.candidate }))
                  }
                  pc.onconnectionstatechange = () => {
                    updateDebug()
                    const conn = peerConnectionsRef.current[fromId]
                    if (conn?.connectionState === 'connected') connectedOnceRef.current[fromId] = true
                    if (conn?.connectionState === 'failed' && connectedOnceRef.current[fromId] && typeof conn.restartIce === 'function') {
                      conn.restartIce()
                      const send = (desc: RTCSessionDescriptionInit, type: 'offer' | 'answer') => {
                        conn.setLocalDescription(desc).then(() => drainIceQueue(fromId)).catch(() => { })
                        if (ws.readyState === WebSocket.OPEN)
                          ws.send(JSON.stringify({ type, to_peer_id: fromId, payload: desc }))
                      }
                      if (conn.signalingState === 'have-remote-offer') {
                        conn.createAnswer().then((a) => send(a, 'answer')).catch(() => { })
                      } else {
                        conn.createOffer().then((o) => send(o, 'offer')).catch(() => { })
                      }
                    }
                  }
                  peerConnectionsRef.current[fromId] = pc
                }
                if (payload && typeof payload === 'object' && pc && canSetRemoteOffer(pc)) {
                  const conn = pc
                  conn
                    .setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                    .then(() => conn.createAnswer())
                    .then((answer: RTCSessionDescriptionInit) => {
                      conn.setLocalDescription(answer).then(() => drainIceQueue(fromId))
                      ws.send(JSON.stringify({ type: 'answer', to_peer_id: fromId, payload: answer }))
                    })
                    .catch(() => {})
                }
              } else if (msg.type === 'answer' && pc && payload && typeof payload === 'object') {
                if (!canSetRemoteAnswer(pc)) return
                pc
                  .setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                  .then(() => drainIceQueue(fromId))
                  .catch(() => {})
              } else if (msg.type === 'ice' && pc && payload) {
                if (!pc.remoteDescription) {
                  if (!iceQueueRef.current[fromId]) iceQueueRef.current[fromId] = []
                  iceQueueRef.current[fromId].push(payload)
                } else {
                  pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit)).catch(() => { })
                }
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            addError?.('error', `Conference: ${msg}`, err instanceof Error ? err.stack : undefined)
            console.error('Conference ws message error:', err)
          }
        }

        ws.onopen = () => updateDebug()
        ws.onerror = () => {
          updateDebug()
          if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return
          ws.close()
        }
        ws.onclose = () => {
          updateDebug()
          Object.values(peerConnectionsRef.current).forEach((pc) => pc.close())
          peerConnectionsRef.current = {}
          peerStreamsRef.current = {}
          connectedOnceRef.current = {}
          setPeers({})
          setPeerVideoEnabled({})
          setPeerAudioEnabled({})
          if (leaveIntentionalRef.current) return
          setReconnecting(true)
          const attempt = reconnectAttemptRef.current
          reconnectAttemptRef.current = Math.min(attempt + 1, 15)
          const delay = Math.min(1200 * Math.pow(1.6, attempt), 20000)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            const next = new WebSocket(wsUrl)
            wsRef.current = next
            setupHandlers(next, iceServersList)
          }, delay)
        }
      }

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      setupHandlers(ws, iceServers)
    }

    run()

    return () => {
      cancelled = true
      leaveIntentionalRef.current = true
      setConferenceDebug?.(null)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close())
      peerConnectionsRef.current = {}
      peerStreamsRef.current = {}
      connectedOnceRef.current = {}
    }
  }, [status, roomId, token, addPeer, removePeer, addPeerTrack, drainIceQueue, updateDebug, setConferenceDebug])

  const toggleVideo = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setVideoEnabled(videoTrack.enabled)
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'video_status', enabled: videoTrack.enabled }))
        }
      }
    }
  }, [])

  const toggleAudio = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setAudioEnabled(audioTrack.enabled)
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio_status', enabled: audioTrack.enabled }))
        }
      }
    }
  }, [])

  const toggleFacingMode = useCallback(async () => {
    if (flipping || !streamRef.current || !streamRef.current.getVideoTracks().length) return
    const nextMode = facingMode === 'user' ? 'environment' : 'user'
    setFlipping(true)
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: true,
      })
      const oldStream = streamRef.current
      oldStream.getTracks().forEach((t) => t.stop())
      streamRef.current = newStream
      setVideoEnabled(!!newStream.getVideoTracks()[0]?.enabled)
      setAudioEnabled(!!newStream.getAudioTracks()[0]?.enabled)
      setFacingMode(nextMode)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream
        localVideoRef.current.muted = true
        localVideoRef.current.play().catch(() => { })
      }
      const newVideoTrack = newStream.getVideoTracks()[0]
      if (newVideoTrack) {
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(newVideoTrack)
        })
      }
    } catch {
      setFlipping(false)
      return
    }
    setFlipping(false)
  }, [facingMode, flipping])

  const applyStreamQuality = useCallback(
    async (low: boolean) => {
      const str = streamRef.current
      if (!str || !str.getVideoTracks().length) return
      const constraints = low
        ? {
          video: {
            facingMode,
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 },
          },
          audio: true,
        }
        : {
          video: {
            facingMode,
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: true,
        }
      try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        const oldStream = str
        const newVideo = newStream.getVideoTracks()[0]
        const newAudio = newStream.getAudioTracks()[0]
        if (!newVideo) return
        oldStream.getTracks().forEach((t) => t.stop())
        streamRef.current = newStream
        setVideoEnabled(newVideo.enabled)
        setAudioEnabled(!!newAudio?.enabled)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream
          localVideoRef.current.muted = true
          localVideoRef.current.play().catch(() => { })
        }
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
          const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio')
          if (videoSender) videoSender.replaceTrack(newVideo)
          if (audioSender && newAudio) audioSender.replaceTrack(newAudio)
        })
        setLowQualityMode(low)
      } catch {
        setLowQualityMode(false)
      }
    },
    [facingMode]
  )

  useEffect(() => {
    if (!audioWsMode || !streamRef.current || !wsRef.current) return
    const stream = streamRef.current
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack?.enabled) return
    const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(AUDIO_CHUNK_SAMPLES, 1, 1)
    source.connect(processor)
    processor.connect(ctx.destination)
    let gainSmoothed = 1
    processor.onaudioprocess = (e) => {
      if (!audioWsModeRef.current) return
      const str = streamRef.current
      if (!str?.getAudioTracks()[0]?.enabled) return
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      const input = e.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(input.length)
      let gain = 1
      if (noiseSuppressionRef.current) {
        let sum = 0
        for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!
        const rms = Math.sqrt(sum / input.length)
        const gainTarget = rms < NOISE_FLOOR ? 0 : 1 - Math.exp(-NOISE_SMOOTH_K * (rms - NOISE_FLOOR) / NOISE_FLOOR)
        gainSmoothed = GAIN_SMOOTH_ALPHA * gainSmoothed + (1 - GAIN_SMOOTH_ALPHA) * gainTarget
        gain = gainSmoothed
      }
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]! * gain))
        int16[i] = s < 0 ? s * 32768 : s * 32767
      }
      ws.send(int16.buffer)
    }
    audioCaptureCleanupRef.current = () => {
      processor.disconnect()
      source.disconnect()
      ctx.close()
      audioCaptureCleanupRef.current = null
    }
    return () => {
      audioCaptureCleanupRef.current?.()
    }
  }, [audioWsMode, status])

  useEffect(() => {
    if (audioWsMode || !streamRef.current || status !== 'ready') return
    const stream = streamRef.current
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack || audioTrack.readyState === 'ended') return
    if (!noiseSuppressionRef.current) {
      processedStreamCleanupRef.current?.()
      processedStreamRef.current = null
      return
    }
    try {
      const { stream: combined, cleanup } = createProcessedStream(
        stream,
        () => !noiseSuppressionRef.current
      )
      processedStreamRef.current = combined
      processedStreamCleanupRef.current = () => {
        cleanup()
        processedStreamRef.current = null
        processedStreamCleanupRef.current = null
      }
      const processedAudio = combined.getAudioTracks()[0]
      const sendOverWs = (type: 'offer' | 'answer', toPeerId: string, payload: RTCSessionDescriptionInit) => {
        if (wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(JSON.stringify({ type, to_peer_id: toPeerId, payload }))
      }
      Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
        if (pc.connectionState === 'closed') return
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio') ?? pc.getSenders().find((s) => !s.track)
        if (sender && processedAudio) {
          sender.replaceTrack(processedAudio).then(() => renegotiatePeer(pc, peerId, drainIceQueue, sendOverWs)).catch(() => {})
        }
      })
    } catch (err) {
      addError?.('error', `WebRTC noise suppression: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined)
    }
    return () => {
      processedStreamCleanupRef.current?.()
      if (!noiseSuppressionRef.current && streamRef.current) {
        const rawAudio = streamRef.current.getAudioTracks()[0]
        if (rawAudio?.readyState !== 'ended') {
          const sendOverWs = (type: 'offer' | 'answer', toPeerId: string, payload: RTCSessionDescriptionInit) => {
            if (wsRef.current?.readyState === WebSocket.OPEN)
              wsRef.current.send(JSON.stringify({ type, to_peer_id: toPeerId, payload }))
          }
          Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
            if (pc.connectionState === 'closed') return
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio') ?? pc.getSenders().find((s) => !s.track)
            if (sender && rawAudio) {
              sender.replaceTrack(rawAudio).then(() => renegotiatePeer(pc, peerId, drainIceQueue, sendOverWs)).catch(() => {})
            }
          })
        }
      }
    }
  }, [status, audioWsMode, noiseSuppression, addError, drainIceQueue])

  useEffect(() => {
    if (status !== 'ready' || Object.keys(peerConnectionsRef.current).length === 0) return
    const interval = setInterval(() => {
      const pcs = Object.values(peerConnectionsRef.current)
      const anyPoor = pcs.some(
        (pc) => pc.connectionState === 'disconnected' || pc.connectionState === 'failed'
      )
      const allGood = pcs.length > 0 && pcs.every((pc) => pc.connectionState === 'connected')
      if (anyPoor) {
        connectionPoorCountRef.current += 1
        if (connectionPoorCountRef.current >= 2 && !lowQualityMode) applyStreamQuality(true)
      } else {
        connectionPoorCountRef.current = 0
        if (allGood && lowQualityMode) applyStreamQuality(false)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [status, lowQualityMode, applyStreamQuality])

  const handleLeave = useCallback(() => {
    leaveIntentionalRef.current = true
    audioCaptureCleanupRef.current?.()
    audioPlaybackCtxRef.current?.close()
    onLeave()
  }, [onLeave])

  const toggleAudioWs = useCallback(() => {
    const next = !audioWsModeRef.current
    setAudioWsMode(next)
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio_ws_mode', enabled: next }))
    }
  }, [])

  const toggleNoiseSuppression = useCallback(() => {
    setNoiseSuppression((s) => !s)
  }, [])

  const peerList = Object.entries(peers)
  const primaryPeer = peerList[0]
  const primaryUserId = primaryPeer?.[1]?.userId

  useEffect(() => {
    if (!token || !primaryUserId) return
    if (peerAvatarRefs.current[primaryUserId]) return
    let cancelled = false
    fetch(`${API_URL}/avatar/${primaryUserId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return
        if (peerAvatarRefs.current[primaryUserId])
          URL.revokeObjectURL(peerAvatarRefs.current[primaryUserId])
        const url = URL.createObjectURL(blob)
        peerAvatarRefs.current[primaryUserId] = url
        setPeerAvatarUrls((prev) => ({ ...prev, [primaryUserId]: url }))
      })
      .catch(() => { })
    return () => {
      cancelled = true
    }
  }, [token, primaryUserId])

  const inviteLink = botUsername
    ? `https://t.me/${botUsername}?start=${encodeURIComponent(roomId || 'main')}`
    : ''
  const copyInviteLink = useCallback(() => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteLinkCopied(true)
      setTimeout(() => setInviteLinkCopied(false), 2000)
    })
  }, [inviteLink])

  return {
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
  }
}
