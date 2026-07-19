export interface ListeningIndicatorProps {
  active?: boolean
  label?: string
  className?: string
}

export function ListeningIndicator({
  active = false,
  label = 'Listening…',
  className = '',
}: ListeningIndicatorProps) {
  if (!active) return null
  return (
    <span
      role="status"
      data-testid="voice-listening-indicator"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 ${className}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500"
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
