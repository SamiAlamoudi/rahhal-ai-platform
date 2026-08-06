import { useCallback, useEffect, useRef, useState } from 'react'

const BAND_COUNT = 32

export type BilamoMicState = {
  active: boolean
  level: number
  bands: number[]
  error: string | null
  start: () => Promise<boolean>
  stop: () => void
}

function emptyBands() {
  return Array.from({ length: BAND_COUNT }, () => 0)
}

/**
 * Real microphone energy + frequency bands for Orb waveform.
 * Uses getUserMedia + AnalyserNode (same approach as voiceActivityMonitor).
 */
export function useBilamoMic(): BilamoMicState {
  const [active, setActive] = useState(false)
  const [level, setLevel] = useState(0)
  const [bands, setBands] = useState<number[]>(emptyBands)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const smoothRef = useRef(0)
  const bandsSmoothRef = useRef(emptyBands())

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try {
      analyserRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    analyserRef.current = null
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => undefined)
      ctxRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    smoothRef.current = 0
    bandsSmoothRef.current = emptyBands()
    setLevel(0)
    setBands(emptyBands())
    setActive(false)
  }, [])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const time = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(time)
    let sum = 0
    for (let i = 0; i < time.length; i += 1) {
      const v = (time[i]! - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / time.length)
    const nextLevel = Math.max(0, Math.min(1, rms * 4.2))
    smoothRef.current = smoothRef.current * 0.65 + nextLevel * 0.35
    setLevel(smoothRef.current)

    const freq = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(freq)
    const step = Math.max(1, Math.floor(freq.length / BAND_COUNT))
    const nextBands = emptyBands()
    for (let i = 0; i < BAND_COUNT; i += 1) {
      let acc = 0
      for (let j = 0; j < step; j += 1) {
        acc += freq[i * step + j] ?? 0
      }
      const raw = Math.min(1, acc / step / 180)
      bandsSmoothRef.current[i] = bandsSmoothRef.current[i]! * 0.55 + raw * 0.45
      nextBands[i] = bandsSmoothRef.current[i]!
    }
    setBands(nextBands)

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(async () => {
    stop()
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone unavailable')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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
        setError('Audio context unavailable')
        for (const track of stream.getTracks()) track.stop()
        return false
      }
      const ctx = new Ctx()
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.72
      source.connect(analyser)

      streamRef.current = stream
      ctxRef.current = ctx
      analyserRef.current = analyser
      setActive(true)
      rafRef.current = requestAnimationFrame(tick)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission denied')
      stop()
      return false
    }
  }, [stop, tick])

  useEffect(() => () => stop(), [stop])

  return { active, level, bands, error, start, stop }
}
