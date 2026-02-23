/**
 * WebRTC signaling helpers with proper state checks to avoid InvalidStateError.
 * Only renegotiate when in valid signaling state.
 */

export function renegotiatePeer(
  pc: RTCPeerConnection,
  peerId: string,
  drainIceQueue: (id: string) => void,
  sendOverWs: (type: 'offer' | 'answer', toPeerId: string, payload: RTCSessionDescriptionInit) => void
): void {
  if (pc.connectionState === 'closed') return

  const send = (desc: RTCSessionDescriptionInit, type: 'offer' | 'answer') => {
    pc.setLocalDescription(desc).then(() => drainIceQueue(peerId)).catch(() => {})
    sendOverWs(type, peerId, desc)
  }

  const state = pc.signalingState
  if (state === 'have-remote-offer') {
    pc.createAnswer().then((a) => send(a, 'answer')).catch(() => {})
  } else if (state === 'stable') {
    pc.createOffer().then((o) => send(o, 'offer')).catch(() => {})
  }
  // have-local-offer: waiting for remote answer, skip
}

export function canSetRemoteAnswer(pc: RTCPeerConnection): boolean {
  return pc.signalingState === 'have-local-offer'
}

export function canSetRemoteOffer(pc: RTCPeerConnection): boolean {
  return pc.signalingState === 'stable'
}
