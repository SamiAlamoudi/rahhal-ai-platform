export interface VoiceConnectionBadgeProps {
  connected: boolean
  providerId?: string
  className?: string
}

export function VoiceConnectionBadge({
  connected,
  providerId = 'mock',
  className = '',
}: VoiceConnectionBadgeProps) {
  return (
    <span
      data-testid="voice-connection-badge"
      data-connected={connected ? 'true' : 'false'}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
        connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`}
        aria-hidden="true"
      />
      {connected ? 'Connected' : 'Offline'} · {providerId}
    </span>
  )
}
