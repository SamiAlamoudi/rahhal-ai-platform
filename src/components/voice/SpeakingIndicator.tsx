export interface SpeakingIndicatorProps {
  active?: boolean
  label?: string
  className?: string
}

export function SpeakingIndicator({
  active = false,
  label = 'Speaking…',
  className = '',
}: SpeakingIndicatorProps) {
  if (!active) return null
  return (
    <span
      role="status"
      data-testid="voice-speaking-indicator"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 ${className}`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="h-3 w-0.5 animate-pulse bg-primary-500" />
        <span className="h-3 w-0.5 animate-pulse bg-primary-400 [animation-delay:120ms]" />
        <span className="h-3 w-0.5 animate-pulse bg-primary-500 [animation-delay:240ms]" />
      </span>
      {label}
    </span>
  )
}
