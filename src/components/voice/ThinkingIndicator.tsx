export interface ThinkingIndicatorProps {
  active?: boolean
  label?: string
  className?: string
}

export function ThinkingIndicator({
  active = false,
  label = 'Thinking…',
  className = '',
}: ThinkingIndicatorProps) {
  if (!active) return null
  return (
    <span
      role="status"
      data-testid="voice-thinking-indicator"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 ${className}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
