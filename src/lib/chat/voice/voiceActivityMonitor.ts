/**
 * Production stabilization — voice activity + level monitoring.
 * Uses getUserMedia + AnalyserNode (not MediaRecorder) to detect speech energy
 * and drive waveform / silence tolerance without replacing Web Speech STT.
 */

export type VoiceActivityMonitorOptions = {
  /** RMS above this (0–1) counts as speech. Default 0.015 */
  speechThreshold?: number
  /** How often to sample levels (ms). Default 50 */
  sampleMs?: number
  onLevel?: (level: number) => void
  onSpeakingChange?: (speaking: boolean) => void
  log?: (entry: Record<string, unknown>) => void
}

export type VoiceActivityMonitor = {
  start: () => Promise<void>
  stop: () => void
  isSpeaking: () => boolean
  getLevel: () => number
  isActive: () => boolean
}

export function createVoiceActivityMonitor(
  options: VoiceActivityMonitorOptions = {},
): VoiceActivityMonitor {
  const speechThreshold = options.speechThreshold ?? 0.015
  const sampleMs = options.sampleMs ?? 50
  let stream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let speaking = false
  let level = 0
  let active = false

  const stop = () => {
    active = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    try {
      analyser?.disconnect()
    } catch {
      /* ignore */
    }
    analyser = null
    if (audioContext) {
      void audioContext.close().catch(() => undefined)
      audioContext = null
    }
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    speaking = false
    level = 0
  }

  return {
    isActive: () => active,
    isSpeaking: () => speaking,
    getLevel: () => level,
    stop,
    async start() {
      stop()
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        options.log?.({
          stage: 'microphone',
          event: 'vad_unsupported',
          message: 'getUserMedia unavailable',
        })
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        const Ctx =
          window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctx) {
          options.log?.({ stage: 'microphone', event: 'vad_no_audio_context' })
          stop()
          return
        }
        audioContext = new Ctx()
        const source = audioContext.createMediaStreamSource(stream)
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        const data = new Uint8Array(analyser.fftSize)
        active = true
        options.log?.({ stage: 'microphone', event: 'vad_started' })

        timer = setInterval(() => {
          if (!analyser) return
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i]! - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          level = Math.max(0, Math.min(1, rms * 4))
          const nextSpeaking = rms >= speechThreshold
          if (nextSpeaking !== speaking) {
            speaking = nextSpeaking
            options.onSpeakingChange?.(speaking)
          }
          options.onLevel?.(level)
        }, sampleMs)
      } catch (error) {
        options.log?.({
          stage: 'microphone',
          event: 'vad_start_failed',
          error: error instanceof Error ? error.message : String(error),
        })
        stop()
      }
    },
  }
}
