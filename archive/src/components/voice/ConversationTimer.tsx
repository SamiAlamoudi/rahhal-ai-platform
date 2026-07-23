import { useEffect, useState } from 'react'

export interface ConversationTimerProps {
  running: boolean
  startedAt: string | null
  className?: string
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ConversationTimer({
  running,
  startedAt,
  className = '',
}: ConversationTimerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running || !startedAt) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [running, startedAt])

  const elapsed =
    running && startedAt ? Math.max(0, now - Date.parse(startedAt)) : 0

  return (
    <span
      data-testid="voice-conversation-timer"
      className={`font-mono text-[11px] text-slate-500 ${className}`}
    >
      {formatElapsed(elapsed)}
    </span>
  )
}
