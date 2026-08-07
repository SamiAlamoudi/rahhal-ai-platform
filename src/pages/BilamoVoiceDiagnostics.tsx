/**
 * Staging-only voice diagnostics — never shows secrets or transcripts.
 * Gated by import.meta.env.DEV or VITE_VOICE_METRICS=1.
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BilamoShell, Button, Logo } from '../design-system'
import { useBilamoVoiceSession } from '../hooks/useBilamoVoiceSession'
import type { BilamoVoiceMetricsReport } from '../lib/bilamo/voice'

function voiceDiagnosticsEnabled(): boolean {
  if (import.meta.env.DEV) return true
  return String(import.meta.env.VITE_VOICE_METRICS || '').trim() === '1'
}

export default function BilamoVoiceDiagnostics() {
  const allowed = voiceDiagnosticsEnabled()
  const voice = useBilamoVoiceSession({ enabled: allowed })
  const [report, setReport] = useState<BilamoVoiceMetricsReport | null>(null)
  const [micPermission, setMicPermission] = useState<string>('unknown')

  useEffect(() => {
    if (!allowed) return
    const tick = () => setReport(voice.getMetricsReport())
    tick()
    const id = window.setInterval(tick, 800)
    return () => window.clearInterval(id)
  }, [allowed, voice])

  useEffect(() => {
    if (!allowed || typeof navigator === 'undefined' || !navigator.permissions?.query) return
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setMicPermission(status.state)
        status.onchange = () => setMicPermission(status.state)
      })
      .catch(() => setMicPermission('unavailable'))
  }, [allowed])

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  const snap = voice.snapshot
  const latest = report?.latest
  const agg = report?.aggregates
  const playback = snap.playback

  return (
    <BilamoShell>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-6 py-10">
        <header className="space-y-2 text-center">
          <Logo size="sm" className="justify-center" />
          <h1 className="text-[1.2rem] font-medium tracking-[-0.03em] text-[var(--bilamo-text)]">
            Voice diagnostics
          </h1>
          <p className="text-[13px] text-[var(--bilamo-muted)]">
            Staging only — no transcripts, keys, or raw payloads.
          </p>
        </header>

        <dl className="bilamo-glass space-y-3 rounded-[1.25rem] px-5 py-4 text-[13.5px]">
          <Row label="Transport requested" value={snap.requestedTransport || '—'} />
          <Row label="Transport active" value={snap.transportKind || '—'} />
          <Row label="Realtime session created" value={yn(Boolean(snap.transportKind === 'realtime_webrtc' && snap.connection === 'connected'))} />
          <Row label="FSM current state" value={snap.state} />
          <Row label="Last FSM transition" value={playback.lastFsmTransition || '—'} />
          <Row label="Connection" value={snap.connection} />
          <Row label="Peer connection state" value={playback.peerConnectionState || '—'} />
          <Row label="ICE state" value={playback.iceConnectionState || '—'} />
          <Row label="Mic permission" value={micPermission} />
          <Row label="Mic track state" value={String(snap.listening)} />
          <Row label="AudioContext" value={snap.audioContextState || '—'} />
          <Row label="Speech detected" value={yn(playback.speechDetected)} />
          <Row label="End-of-speech detected" value={yn(playback.endOfSpeechDetected)} />
          <Row label="Input committed" value={yn(playback.inputCommitted)} />
          <Row label="Final transcript received" value={yn(playback.finalTranscriptReceived)} />
          <Row label="Assistant response created" value={yn(playback.assistantResponseCreated)} />
          <Row label="Remote audio track received" value={yn(playback.remoteTrackReceived)} />
          <Row
            label="Remote track muted/unmuted"
            value={
              playback.remoteTrackMuted == null
                ? '—'
                : playback.remoteTrackMuted
                  ? 'muted'
                  : 'unmuted'
            }
          />
          <Row label="Remote track readyState" value={playback.remoteTrackReadyState || '—'} />
          <Row label="Audio element attached" value={yn(playback.audioElementAttached)} />
          <Row label="play() requested" value={yn(playback.audioPlayRequested)} />
          <Row label="play() result" value={playback.playResult || '—'} />
          <Row label="Actual playback started" value={yn(playback.audioPlaybackStarted)} />
          <Row label="Playback ended" value={yn(playback.audioPlaybackEnded)} />
          <Row label="Audio playback failed" value={yn(playback.audioPlaybackFailed)} />
          <Row label="Classic fallback invoked" value={yn(playback.classicFallbackInvoked || snap.fellBackToClassic)} />
          <Row label="Interrupt acknowledged" value={yn(playback.interruptAcknowledged)} />
          <Row label="Speaking (audible only)" value={String(snap.speaking || snap.state === 'speaking')} />
          <Row label="Second-turn ready" value={yn(snap.secondTurnReady)} />
          <Row label="Stuck-state watchdog count" value={String(playback.stuckWatchdogCount ?? 0)} />
          <Row label="Last safe error code" value={snap.lastSafeErrorCode || playback.lastSafeErrorCode || '—'} />
          <Row label="Last playback event" value={playback.lastEvent || '—'} />
          <Row
            label="First-audio latency"
            value={formatMs(latest?.timeToFirstAudioMs ?? agg?.timeToFirstAudioMs.last)}
          />
          <Row
            label="First audio p50 / p95"
            value={`${formatMs(agg?.timeToFirstAudioMs.p50)} / ${formatMs(agg?.timeToFirstAudioMs.p95)}`}
          />
          <Row
            label="Interrupt latency"
            value={formatMs(latest?.interruptionLatencyMs ?? agg?.interruptionLatencyMs.last)}
          />
          <Row
            label="Reconnect samples"
            value={String(agg?.reconnectLatencyMs.count ?? 0)}
          />
          <Row label="Connect OK" value={formatMs(latest?.connectionSetupMs)} />
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void voice.connect()
            }}
          >
            Connect
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void voice.startListening()
            }}
          >
            Start mic
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              voice.interrupt()
            }}
          >
            Interrupt
          </Button>
        </div>
      </div>
    </BilamoShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--bilamo-border)] pb-2 last:border-0 last:pb-0">
      <dt className="text-[var(--bilamo-muted)]">{label}</dt>
      <dd className="tabular-nums text-[var(--bilamo-text)]/90">{value}</dd>
    </div>
  )
}

function formatMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} ms`
}

function yn(value: boolean): string {
  return value ? 'yes' : 'no'
}
