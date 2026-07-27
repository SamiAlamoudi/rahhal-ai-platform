/**
 * Floating voice / Thinking evidence console — Preview/DEV only (VITE_VOICE_TRACE=true).
 * Shows actual executed events for real iPhone capture (no DevTools required).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { getVoiceSessionId, isVoiceTracingEnabled } from '../../lib/chat/voice/voiceDebugTrace'
import {
  buildThinkingEvidenceExport,
  clearThinkingEvidence,
  formatThinkingEvidenceJson,
  getThinkingEvidence,
  getThinkingStuckSnapshot,
  subscribeThinkingEvidence,
  type ThinkingEvidenceRecord,
  type ThinkingStuckSnapshot,
} from '../../lib/chat/voice/thinkingStuckEvidence'

function useThinkingEvidence(): readonly ThinkingEvidenceRecord[] {
  return useSyncExternalStore(subscribeThinkingEvidence, getThinkingEvidence, () => [])
}

function useStuckSnapshot(): ThinkingStuckSnapshot | null {
  return useSyncExternalStore(subscribeThinkingEvidence, getThinkingStuckSnapshot, () => null)
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function VoiceDebugConsole() {
  const enabled = isVoiceTracingEnabled()
  const events = useThinkingEvidence()
  const stuck = useStuckSnapshot()
  const [open, setOpen] = useState(true)
  const [details, setDetails] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const json = useMemo(() => formatThinkingEvidenceJson(), [events, stuck])

  if (!enabled || !mounted) return null

  const latest = events[events.length - 1]
  const failed = [...events].reverse().find((r) => !r.success)

  const onCopy = async () => {
    const payload = formatThinkingEvidenceJson()
    const ok = await copyText(payload)
    setCopyStatus(ok ? 'تم النسخ' : 'انسخ يدوياً من المربع')
    setDetails(true)
    window.setTimeout(() => setCopyStatus(null), 4000)
  }

  const onClear = () => {
    clearThinkingEvidence()
    setCopyStatus(null)
  }

  return (
    <div
      data-testid="voice-debug-console"
      className="pointer-events-none fixed inset-x-2 bottom-2 z-[9999] flex justify-center sm:inset-x-auto sm:bottom-4 sm:left-4 sm:justify-start"
      dir="rtl"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-300/80 bg-slate-950/95 text-right text-[11px] text-amber-50 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 px-3 py-2" dir="ltr">
          <div className="min-w-0 text-left">
            <p className="font-bold tracking-wide text-amber-200">VOICE TRACE (Preview)</p>
            <p className="truncate text-[10px] text-amber-100/70">
              session {getVoiceSessionId()}
              {latest ? ` · last ${latest.event}` : ''}
              {failed ? ` · FAIL ${failed.event}` : ''}
              {stuck ? ' · STUCK' : ''}
            </p>
          </div>
          <button
            type="button"
            className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/30"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide' : 'Show'}
          </button>
        </div>

        {open ? (
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="flex flex-wrap gap-1 border-b border-amber-500/20 px-2 py-2" dir="rtl">
              <button
                type="button"
                data-testid="voice-trace-copy"
                className="rounded bg-emerald-500/25 px-2 py-1 text-[11px] font-bold text-emerald-100 hover:bg-emerald-500/35"
                onClick={() => void onCopy()}
              >
                نسخ السجل
              </button>
              <button
                type="button"
                data-testid="voice-trace-details"
                className="rounded bg-amber-500/25 px-2 py-1 text-[11px] font-bold text-amber-100 hover:bg-amber-500/35"
                onClick={() => setDetails((v) => !v)}
              >
                عرض التفاصيل
              </button>
              <button
                type="button"
                data-testid="voice-trace-clear"
                className="rounded bg-rose-500/25 px-2 py-1 text-[11px] font-bold text-rose-100 hover:bg-rose-500/35"
                onClick={onClear}
              >
                مسح السجل
              </button>
              {copyStatus ? (
                <span className="px-1 text-[10px] font-semibold text-emerald-200">{copyStatus}</span>
              ) : null}
            </div>

            {stuck ? (
              <div
                data-testid="voice-trace-stuck-snapshot"
                className="space-y-0.5 border-b border-rose-500/40 bg-rose-950/50 px-2 py-2 font-mono text-[10px] text-rose-50"
                dir="ltr"
              >
                <p className="font-bold text-rose-200">THINKING STUCK SNAPSHOT (≥15s)</p>
                <p>LAST SUCCESSFUL STAGE: {stuck.lastSuccessfulEvent ?? 'none'}</p>
                <p>FIRST MISSING OR FAILING STAGE: {stuck.firstMissingOrFailingEvent ?? 'unknown'}</p>
                <p>CURRENT VOICE STATE: {stuck.currentVoiceState ?? '?'}</p>
                <p>
                  CURRENT REACT STATE:{' '}
                  {stuck.currentReactState
                    ? JSON.stringify(stuck.currentReactState)
                    : 'null'}
                </p>
                <p>WAITING COMPONENT: {stuck.waitingComponent ?? '?'}</p>
                <p>MESSAGE COUNT: {stuck.messageCount ?? 0}</p>
                <p>ASSISTANT MESSAGE PRESENT: {stuck.assistantMessagePresent ? 'YES' : 'NO'}</p>
                <p>ASSISTANT BUBBLE RENDERED: {stuck.assistantBubbleRendered ? 'YES' : 'NO'}</p>
              </div>
            ) : null}

            <ol
              className="list-none space-y-1 px-2 py-2 font-mono"
              aria-label="Actual voice/thinking evidence events"
              dir="ltr"
            >
              {events.length === 0 ? (
                <li className="px-1 py-2 text-amber-100/60">
                  Waiting for actual runtime events (mic / Thinking…)…
                </li>
              ) : (
                events.map((r, idx) => (
                  <li
                    key={`${r.timestamp}-${r.event}-${idx}`}
                    className={`rounded px-1.5 py-1 ${
                      r.success ? 'bg-white/5' : 'bg-rose-500/25 text-rose-50'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{r.event}</span>
                      <span className="text-[10px] opacity-70">
                        {r.success ? 'ok' : 'FAIL'}
                      </span>
                    </div>
                    <div className="opacity-80">
                      {r.timestamp.slice(11, 23)}
                      {r.previousState || r.nextState
                        ? ` · ${r.previousState ?? '?'}→${r.nextState ?? '?'}`
                        : ''}
                    </div>
                    <div className="opacity-70">
                      session {r.sessionId ?? '—'}
                      {r.turnId ? ` · turn ${r.turnId}` : ''}
                      {r.conversationId ? ` · conv ${r.conversationId.slice(0, 10)}` : ''}
                    </div>
                    <div className="opacity-70">
                      msgs {r.messageCount ?? '—'}
                      {r.assistantMessageId
                        ? ` · assistant ${r.assistantMessageId.slice(0, 10)}`
                        : ''}
                    </div>
                    {r.waitingComponent ? (
                      <div className="opacity-80">waiting: {r.waitingComponent}</div>
                    ) : null}
                    {r.errorReason ? (
                      <div className="text-rose-100">reason: {r.errorReason}</div>
                    ) : null}
                  </li>
                ))
              )}
            </ol>

            {details ? (
              <div className="border-t border-amber-500/20 px-2 py-2" dir="ltr">
                <p className="mb-1 text-[10px] font-semibold text-amber-200">
                  JSON evidence (selectable) · window.__THINKING_EVIDENCE__
                </p>
                <textarea
                  data-testid="voice-trace-json"
                  readOnly
                  value={json}
                  className="h-40 w-full resize-y rounded border border-amber-500/30 bg-black/50 p-2 font-mono text-[9px] text-amber-50"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <p className="mt-1 text-[9px] text-amber-100/50">
                  events: {buildThinkingEvidenceExport().events.length}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
