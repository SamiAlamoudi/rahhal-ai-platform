/**
 * Production stabilization — live waveform while recording.
 * Driven by VoiceActivityMonitor levels (0–1); decorative fallback when level=0.
 */

interface VoiceWaveformProps {
  active: boolean
  level?: number
  bars?: number
  className?: string
  label?: string
}

export default function VoiceWaveform({
  active,
  level = 0,
  bars = 24,
  className = '',
  label = 'Recording waveform',
}: VoiceWaveformProps) {
  const heights = Array.from({ length: bars }, (_, i) => {
    if (!active) return 0.15
    const wave = 0.35 + 0.65 * Math.abs(Math.sin((i / bars) * Math.PI * 2 + level * 8))
    const energy = Math.max(0.2, Math.min(1, level * 1.8 + 0.25))
    return Math.max(0.12, wave * energy)
  })

  return (
    <div
      className={`flex h-10 items-end justify-center gap-0.5 rounded-xl bg-slate-50 px-3 py-2 ${className}`}
      role="img"
      aria-label={label}
      aria-hidden={!active}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-[height] duration-75 ${
            active ? 'bg-primary-500' : 'bg-slate-200'
          }`}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  )
}
