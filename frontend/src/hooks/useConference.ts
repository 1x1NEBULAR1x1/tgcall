import { useState, useRef, useEffect, useCallback } from 'react'
import { API_URL, getWsUrl } from '../config'
import type { AuthUser } from '../types'
import type { PeerInfo } from '../types'

export interface UseConferenceProps {
  roomId: string
  token: string | null
  user: AuthUser | null
  botUsername: string | null
  onLeave: () => void
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
}

export function useConference({
  roomId,
  token,
  user: _user,
  botUsername,
  onLeave,
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

  const avatarUrlRef = useRef<string | null>(null)
  const peerAvatarRefs = useRef<Record<number, string>>({})
  const connectionPoorCountRef = useRef(0)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({})
  const iceQueueRef = useRef<Record<string, object[]>>({})
  const myPeerIdRef = useRef<string | null>(null)
  const leaveIntentionalRef = useRef(false)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  const drainIceQueue = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current[peerId]
    const queue = iceQueueRef.current[peerId]
    if (!pc || !queue?.length) return
    iceQueueRef.current[peerId] = []
    queue.forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
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

  const setPeerStream = useCallback((peerId: string, stream: MediaStream) => {
    setPeers((prev) => {
      const next = { ...prev }
      if (next[peerId]) next[peerId] = { ...next[peerId], stream }
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
      .catch(() => {})
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
      const videoConstraints = {
        facingMode: 'user' as const,
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      }
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
      el.play().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || !streamRef.current || !token) return
    leaveIntentionalRef.current = false
    const stream = streamRef.current
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.muted = true
      localVideoRef.current.play().catch(() => {})
    }

    const wsUrl = getWsUrl(
      `/ws/conference?room_id=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
    )

    const setupHandlers = (ws: WebSocket) => {
      ws.onmessage = (event) => {
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(event.data as string) as Record<string, unknown>
        } catch {
          return
        }
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
          const streamForPeer = streamRef.current
          if (!streamForPeer) return
          const peerId = msg.peer_id as string
          iceQueueRef.current[peerId] = []
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' })
          streamForPeer.getTracks().forEach((track) => pc.addTrack(track, streamForPeer))
          pc.ontrack = (e: RTCTrackEvent) =>
            setPeerStream(peerId, e.streams?.[0] || new MediaStream([e.track]))
          pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
            if (e.candidate && ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: 'ice', to_peer_id: peerId, payload: e.candidate }))
          }
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' && typeof pc.restartIce === 'function') {
              pc.restartIce()
              pc.createOffer().then((offer) => {
                pc.setLocalDescription(offer).then(() => drainIceQueue(peerId))
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'offer', to_peer_id: peerId, payload: offer }))
              }).catch(() => {})
            }
          }
          peerConnectionsRef.current[peerId] = pc
          pc.createOffer().then((offer) => {
            pc.setLocalDescription(offer).then(() => drainIceQueue(peerId))
            ws.send(JSON.stringify({ type: 'offer', to_peer_id: peerId, payload: offer }))
          })
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
              const stream = streamRef.current
              pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' })
              if (stream) stream.getTracks().forEach((track) => pc?.addTrack(track, stream))
              pc.ontrack = (e: RTCTrackEvent) =>
                setPeerStream(fromId, e.streams?.[0] || new MediaStream([e.track]))
              pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
                if (e.candidate && ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: 'ice', to_peer_id: fromId, payload: e.candidate }))
              }
              pc.onconnectionstatechange = () => {
                const conn = peerConnectionsRef.current[fromId]
                if (conn?.connectionState === 'failed' && typeof conn.restartIce === 'function') {
                  conn.restartIce()
                  conn.createOffer().then((offer) => {
                    conn.setLocalDescription(offer).then(() => drainIceQueue(fromId))
                    if (ws.readyState === WebSocket.OPEN)
                      ws.send(JSON.stringify({ type: 'offer', to_peer_id: fromId, payload: offer }))
                  }).catch(() => {})
                }
              }
              peerConnectionsRef.current[fromId] = pc
            }
            if (payload && typeof payload === 'object' && pc) {
              const conn = pc
              conn
                .setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                .then(() => conn.createAnswer())
                .then((answer: RTCSessionDescriptionInit) => {
                  conn.setLocalDescription(answer).then(() => drainIceQueue(fromId))
                  ws.send(JSON.stringify({ type: 'answer', to_peer_id: fromId, payload: answer }))
                })
            }
          } else if (msg.type === 'answer' && pc && payload && typeof payload === 'object') {
            pc
              .setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
              .then(() => drainIceQueue(fromId))
          } else if (msg.type === 'ice' && pc && payload) {
            if (!pc.remoteDescription) {
              if (!iceQueueRef.current[fromId]) iceQueueRef.current[fromId] = []
              iceQueueRef.current[fromId].push(payload)
            } else {
              pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit)).catch(() => {})
            }
          }
        }
      }

      ws.onerror = () => {
        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return
        ws.close()
      }
      ws.onclose = () => {
        Object.values(peerConnectionsRef.current).forEach((pc) => pc.close())
        peerConnectionsRef.current = {}
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
          setupHandlers(next)
        }, delay)
      }
    }

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setupHandlers(ws)

    return () => {
      leaveIntentionalRef.current = true
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
    }
  }, [status, roomId, token, addPeer, removePeer, setPeerStream, drainIceQueue])

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
        localVideoRef.current.play().catch(() => {})
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
          localVideoRef.current.play().catch(() => {})
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
    onLeave()
  }, [onLeave])

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
      .catch(() => {})
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
  }
}
