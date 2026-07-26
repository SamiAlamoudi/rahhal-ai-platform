/**
 * Floating voice pipeline console — Preview/DEV only (VITE_VOICE_TRACE=true).
 * No production impact when tracing is disabled (component returns null).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  clearVoiceTrace,
  getVoiceSessionId,
  getVoiceTraceRecords,
  isVoiceTracingEnabled,
  subscribeVoiceTrace,
  type VoiceTraceRecord,
} from '../../lib/chat/voice/voiceDebugTrace'

function useVoiceTraceRecords(): readonly VoiceTraceRecord[] {
  return useSyncExternalStore(subscribeVoiceTrace, getVoiceTraceRecords, () => [])
}

export default function VoiceDebugConsole() {
  const enabled = isVoiceTracingEnabled()
  const records = useVoiceTraceRecords()
  const [open, setOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!enabled || !mounted) return null

  const latest = records[records.length - 1]
  const failed = [...records].reverse().find((r) => !r.success)

  return (
    <div
      data-testid="voice-debug-console"
      className="pointer-events-none fixed inset-x-2 bottom-2 z-[9999] flex justify-center sm:inset-x-auto sm:bottom-4 sm:left-4 sm:justify-start"
      dir="ltr"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-300/80 bg-slate-950/95 text-left text-[11px] text-amber-50 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 px-3 py-2">
          <div className="min-w-0">
            <p className="font-bold tracking-wide text-amber-200">VOICE TRACE (Preview)</p>
            <p className="truncate text-[10px] text-amber-100/70">
              session {getVoiceSessionId()}
              {latest ? ` · last ${latest.stage}` : ''}
              {failed ? ` · FAIL ${failed.stage}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/30"
              onClick={() => clearVoiceTrace()}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/30"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {open ? (
          <ol
            className="max-h-56 list-none space-y-1 overflow-y-auto px-2 py-2 font-mono"
            aria-label="Voice pipeline events"
          >
            {records.length === 0 ? (
              <li className="px-1 py-2 text-amber-100/60">Waiting for mic tap…</li>
            ) : (
              records.map((r) => (
                <li
                  key={r.id}
                  className={`rounded px-1.5 py-1 ${
                    r.success ? 'bg-white/5' : 'bg-rose-500/25 text-rose-50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{r.stage}</span>
                    <span className="text-[10px] opacity-70">
                      {r.success ? 'ok' : 'FAIL'}
                      {r.durationMs != null ? ` · ${r.durationMs}ms` : ''}
                    </span>
                  </div>
                  <div className="opacity-80">
                    {r.timestamp.slice(11, 23)}
                    {r.previousState || r.currentState
                      ? ` · ${r.previousState ?? '?'}→${r.currentState ?? '?'}`
                      : ''}
                  </div>
                  {r.reason ? <div className="text-rose-100">reason: {r.reason}</div> : null}
                  {r.recoveryAction && !r.success ? (
                    <div className="opacity-80">recovery: {r.recoveryAction}</div>
                  ) : null}
                  {r.preview ? <div className="opacity-70">preview: {r.preview}</div> : null}
                  {r.conversationId ? (
                    <div className="opacity-60">conv: {r.conversationId.slice(0, 8)}…</div>
                  ) : null}
                </li>
              ))
            )}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
