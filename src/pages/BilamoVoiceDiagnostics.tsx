/**
 * Staging-only voice diagnostics — never shows secrets or transcripts.
 * Gated by import.meta.env.DEV or VITE_VOICE_METRICS=1.
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BilamoShell, Button, Logo } from '../design-system'
import { useBilamoVoiceSession } from '../hooks/useBilamoVoiceSession'
import type { BilamoVoiceMetricsReport } from '../lib/bilamo/voice'
import {
  runDirectAudioProbe,
  type DirectAudioProbeResult,
} from '../lib/bilamo/voice/directAudioProbe'
import { unlockAudioPlayback } from '../lib/chat/voice/audioElementTextToSpeechProvider'
import { probeVoiceAuth } from '../lib/security/voiceAuthProbe'

function voiceDiagnosticsEnabled(): boolean {
  if (import.meta.env.DEV) return true
  return String(import.meta.env.VITE_VOICE_METRICS || '').trim() === '1'
}

export default function BilamoVoiceDiagnostics() {
  const allowed = voiceDiagnosticsEnabled()
  const voice = useBilamoVoiceSession({ enabled: allowed })
  const [report, setReport] = useState<BilamoVoiceMetricsReport | null>(null)
  const [micPermission, setMicPermission] = useState<string>('unknown')
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [probeBusy, setProbeBusy] = useState(false)
  const [probe, setProbe] = useState<DirectAudioProbeResult | null>(null)

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

  useEffect(() => {
    if (!allowed) return
    void probeVoiceAuth().catch(() => undefined)
  }, [allowed, voice.snapshot.state])

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  const snap = voice.snapshot
  const latest = report?.latest
  const agg = report?.aggregates
  const playback = snap.playback

  const failureBundle = [
    `ts=${playback.timestampMs ?? Date.now()}`,
    `corr=${playback.correlationId || '—'}`,
    `stage=${playback.turnStage || '—'}`,
    `fsm=${snap.state}`,
    `reqTransport=${snap.requestedTransport || '—'}`,
    `actTransport=${snap.transportKind || '—'}`,
    `authUser=${yn(playback.authenticatedUser)}`,
    `supabase=${yn(playback.supabaseSessionAvailable)}`,
    `authProbe=${playback.authProbeCode || '—'}`,
    `micPerm=${micPermission}`,
    `media=${yn(playback.mediaStreamActive)}`,
    `speech=${yn(playback.speechDetected)}`,
    `eos=${yn(playback.endOfSpeechDetected)}`,
    `final=${yn(playback.finalTranscriptReceived)}`,
    `dispatched=${yn(playback.requestDispatched)}`,
    `route=${playback.httpRoute || '—'}`,
    `http=${playback.httpStatus ?? '—'}`,
    `code=${playback.safeServerErrorCode || snap.lastSafeErrorCode || playback.lastSafeErrorCode || '—'}`,
    `rtSession=${yn(playback.realtimeSessionCreated)}`,
    `pc=${playback.peerConnectionState || '—'}`,
    `ice=${playback.iceConnectionState || '—'}`,
    `remoteTrack=${yn(playback.remoteTrackReceived)}`,
    `playCalled=${yn(playback.audioPlayRequested)}`,
    `playResult=${playback.playResult || '—'}`,
    `audible=${yn(playback.audioPlaybackStarted)}`,
    `classicFb=${yn(playback.classicFallbackInvoked || snap.fellBackToClassic)}`,
    `classicHttp=${playback.classicFallbackHttpStatus ?? '—'}`,
    `acx=${snap.audioContextState || playback.audioContextState || '—'}`,
    `discard=${playback.discardReason || '—'}`,
    `event=${playback.lastEvent || '—'}`,
    `idleReady=${yn(snap.secondTurnReady)}`,
  ].join('\n')

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
          <Row label="VOICE_SESSION_ACTIVE" value={yn(snap.voiceSessionActive || playback.voiceSessionActive)} />
          <Row label="MANUALLY_STOPPED" value={yn(snap.manuallyStopped || playback.manuallyStopped)} />
          <Row label="STATE" value={snap.state} />
          <Row label="MIC_ACTIVE" value={yn(snap.listening || playback.mediaStreamActive)} />
          <Row label="EOS_DETECTED" value={yn(playback.endOfSpeechDetected)} />
          <Row label="TURN_COMMITTED" value={yn(playback.finalTranscriptReceived || playback.inputCommitted)} />
          <Row label="TURN_ID" value={playback.turnId == null ? '—' : String(playback.turnId)} />
          <Row label="TRANSCRIPT_FINAL" value={yn(playback.finalTranscriptReceived)} />
          <Row label="REALTIME_SESSION" value={yn(playback.realtimeSessionCreated)} />
          <Row label="REMOTE_AUDIO_TRACK" value={yn(playback.remoteTrackReceived)} />
          <Row label="REMOTE_AUDIO_PLAYING" value={yn(playback.audioPlaybackStarted && snap.state === 'speaking')} />
          <Row label="CLASSIC_TTS_HTTP" value={playback.classicFallbackHttpStatus == null ? '—' : String(playback.classicFallbackHttpStatus)} />
          <Row label="CLASSIC_TTS_BYTES" value={playback.classicFallbackInvoked ? 'invoked' : '—'} />
          <Row label="CLASSIC_TTS_PLAYING" value={yn(snap.fellBackToClassic && playback.audioPlaybackStarted)} />
          <Row label="PLAYBACK_ENDED" value={yn(playback.audioPlaybackEnded)} />
          <Row label="AUTO_RELISTEN_TRIGGERED" value={yn(playback.autoRelistenTriggered)} />
          <Row label="LAST_ERROR" value={snap.lastSafeErrorCode || playback.lastSafeErrorCode || snap.error || '—'} />
          <Row label="Timestamp (ms)" value={String(playback.timestampMs ?? '—')} />
          <Row label="Correlation ID" value={playback.correlationId || '—'} />
          <Row label="Turn stage" value={playback.turnStage || '—'} />
          <Row label="Transport requested" value={snap.requestedTransport || '—'} />
          <Row label="Transport actual" value={snap.transportKind || '—'} />
          <Row label="Authenticated user" value={yn(playback.authenticatedUser)} />
          <Row label="Supabase session available" value={yn(playback.supabaseSessionAvailable)} />
          <Row label="Auth probe code" value={playback.authProbeCode || '—'} />
          <Row label="Language" value={playback.language || '—'} />
          <Row label="Dialect" value={playback.dialect || '—'} />
          <Row
            label="Transcript confidence"
            value={playback.transcriptConfidence == null ? '—' : String(playback.transcriptConfidence)}
          />
          <Row label="Normalized intent" value={playback.normalizedIntent || '—'} />
          <Row
            label="Submit latency"
            value={playback.submitLatencyMs == null ? '—' : `${playback.submitLatencyMs} ms`}
          />
          <Row label="Audible" value={yn(playback.audible || playback.audioPlaybackStarted)} />
          <Row label="Mic permission" value={micPermission} />
          <Row label="MediaStream active" value={yn(playback.mediaStreamActive)} />
          <Row label="Speech recognition supported" value={yn(playback.speechRecognitionSupported)} />
          <Row label="Speech detected" value={yn(playback.speechDetected)} />
          <Row label="EOS detected" value={yn(playback.endOfSpeechDetected)} />
          <Row label="Transcript final received" value={yn(playback.finalTranscriptReceived)} />
          <Row label="Request dispatched" value={yn(playback.requestDispatched)} />
          <Row label="HTTP route" value={playback.httpRoute || '—'} />
          <Row label="HTTP status" value={playback.httpStatus == null ? '—' : String(playback.httpStatus)} />
          <Row
            label="Safe server error code"
            value={playback.safeServerErrorCode || snap.lastSafeErrorCode || playback.lastSafeErrorCode || '—'}
          />
          <Row label="Realtime session created" value={yn(playback.realtimeSessionCreated)} />
          <Row label="FSM current state" value={snap.state} />
          <Row label="Last FSM transition" value={playback.lastFsmTransition || '—'} />
          <Row label="Connection" value={snap.connection} />
          <Row label="Peer connection state" value={playback.peerConnectionState || '—'} />
          <Row label="ICE state" value={playback.iceConnectionState || '—'} />
          <Row label="Remote audio track" value={yn(playback.remoteTrackReceived)} />
          <Row
            label="Remote track muted"
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
          <Row label="play() called" value={yn(playback.audioPlayRequested)} />
          <Row label="play() result" value={playback.playResult || '—'} />
          <Row label="Actual playback started" value={yn(playback.audioPlaybackStarted)} />
          <Row label="Playback ended" value={yn(playback.audioPlaybackEnded)} />
          <Row label="Audio playback failed" value={yn(playback.audioPlaybackFailed)} />
          <Row label="Classic fallback attempted" value={yn(playback.classicFallbackInvoked || snap.fellBackToClassic)} />
          <Row
            label="Classic fallback HTTP status"
            value={playback.classicFallbackHttpStatus == null ? '—' : String(playback.classicFallbackHttpStatus)}
          />
          <Row label="AudioContext state" value={snap.audioContextState || playback.audioContextState || '—'} />
          <Row label="Discard reason" value={playback.discardReason || '—'} />
          <Row label="Interrupt acknowledged" value={yn(playback.interruptAcknowledged)} />
          <Row label="Speaking (audible only)" value={String(snap.speaking || snap.state === 'speaking')} />
          <Row label="Second-turn / recovery IDLE" value={yn(snap.secondTurnReady)} />
          <Row label="Stuck-state watchdog count" value={String(playback.stuckWatchdogCount ?? 0)} />
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
          <Row label="Connect OK" value={formatMs(latest?.connectionSetupMs)} />
        </dl>

        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(failureBundle).then(() => {
                setCopyHint('Copied failure bundle (safe fields only).')
                window.setTimeout(() => setCopyHint(null), 2500)
              })
            }}
          >
            Copy failure bundle
          </Button>
          {copyHint ? (
            <p className="text-[12px] text-[var(--bilamo-muted)]">{copyHint}</p>
          ) : (
            <p className="text-[12px] text-[var(--bilamo-muted)]">
              On failure, copy the bundle above (or screenshot this page). Never paste tokens or transcripts.
            </p>
          )}
        </div>

        <div className="bilamo-glass space-y-3 rounded-[1.25rem] px-5 py-4">
          <p className="text-[13px] text-[var(--bilamo-muted)]">
            اختبار الصوت — bypasses STT / conversation / cards. Fixed Arabic TTS only.
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={probeBusy}
            onClick={() => {
              setProbeBusy(true)
              setProbe(null)
              // Must unlock inside this tap gesture before async TTS returns.
              void unlockAudioPlayback()
                .catch(() => undefined)
                .then(() => runDirectAudioProbe())
                .then((result) => setProbe(result))
                .finally(() => setProbeBusy(false))
            }}
          >
            اختبار الصوت
          </Button>
          {probe ? (
            <dl className="space-y-2 text-[13px]">
              <Row label="Probe result" value={probe.result} />
              <Row label="Failure stage" value={probe.failureStage || '—'} />
              <Row label="HTTP status" value={probe.httpStatus == null ? '—' : String(probe.httpStatus)} />
              <Row label="MIME" value={probe.contentType || '—'} />
              <Row label="Bytes" value={String(probe.bytes)} />
              <Row label="AudioContext" value={probe.audioContextState || '—'} />
              <Row label="play() called" value={yn(probe.playCalled)} />
              <Row label="play() result" value={probe.playResult || '—'} />
              <Row label="playing event" value={yn(probe.playingEvent)} />
              <Row label="timeupdate" value={yn(probe.timeupdateSeen)} />
              <Row label="max currentTime" value={probe.maxCurrentTime.toFixed(3)} />
              <Row label="ended" value={yn(probe.ended)} />
              <Row label="readyState" value={probe.elementReadyState == null ? '—' : String(probe.elementReadyState)} />
              <Row label="paused" value={probe.elementPaused == null ? '—' : yn(probe.elementPaused)} />
              <Row label="muted" value={probe.elementMuted == null ? '—' : yn(probe.elementMuted)} />
              <Row label="volume" value={probe.elementVolume == null ? '—' : String(probe.elementVolume)} />
              <Row label="correlation" value={probe.correlationId} />
            </dl>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void unlockAudioPlayback().then(() => voice.connect())
            }}
          >
            Connect
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void unlockAudioPlayback().then(() => voice.startListening())
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

function yn(value: boolean | null | undefined): string {
  if (value == null) return '—'
  return value ? 'yes' : 'no'
}
