import { NOISE_FLOOR, NOISE_SMOOTH_K, GAIN_SMOOTH_ALPHA } from './constants'

export function createProcessedStream(
  stream: MediaStream,
  onNoiseSuppressionOff: () => boolean
): { stream: MediaStream; cleanup: () => void } {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const processor = ctx.createScriptProcessor(512, 1, 1)
  const dest = ctx.createMediaStreamDestination()
  source.connect(processor)
  processor.connect(dest)

  let gainSmoothed = 1
  processor.onaudioprocess = (e) => {
    if (onNoiseSuppressionOff()) return
    const input = e.inputBuffer.getChannelData(0)
    const output = e.outputBuffer.getChannelData(0)
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!
    const rms = Math.sqrt(sum / input.length)
    const gainTarget =
      rms < NOISE_FLOOR ? 0 : 1 - Math.exp((-NOISE_SMOOTH_K * (rms - NOISE_FLOOR)) / NOISE_FLOOR)
    gainSmoothed = GAIN_SMOOTH_ALPHA * gainSmoothed + (1 - GAIN_SMOOTH_ALPHA) * gainTarget
    for (let i = 0; i < input.length; i++) output[i] = input[i]! * gainSmoothed
  }

  const processedAudio = dest.stream.getAudioTracks()[0]
  const videoTracks = stream.getVideoTracks()
  const combined = new MediaStream([...videoTracks, processedAudio!])

  const cleanup = () => {
    processor.disconnect()
    source.disconnect()
    ctx.close()
  }

  return { stream: combined, cleanup }
}
