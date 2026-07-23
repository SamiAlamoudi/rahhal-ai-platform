export interface ConversationWaveProps {
  active?: boolean
  bars?: number
  className?: string
}

/**
 * Decorative waveform for listening/speaking states — no audio analysis.
 */
export function ConversationWave({
  active = false,
  bars = 5,
  className = '',
}: ConversationWaveProps) {
  const count = Math.min(12, Math.max(3, bars))
  return (
    <div
      data-testid="voice-conversation-wave"
      data-active={active ? 'true' : 'false'}
      className={`flex h-6 items-end gap-0.5 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`w-0.5 rounded-full bg-primary-400 ${
            active ? 'animate-pulse' : 'opacity-30'
          }`}
          style={{
            height: `${8 + ((i * 7) % 16)}px`,
            animationDelay: active ? `${i * 80}ms` : undefined,
          }}
        />
      ))}
    </div>
  )
}
