/**
 * Staging-only voice diagnostics — never shows secrets or transcripts.
 * Gated by import.meta.env.DEV or VITE_VOICE_METRICS=1.
 *
 * Isolated Safari audio harness:
 *  - اختبار صوت محلي (local known audio, no network)
 *  - اختبار TTS (classic OpenAI TTS)
 * Both share one persistent HTMLAudioElement.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate } from 'react-router-dom'
import { BilamoShell, Button, Logo } from '../design-system'
import { useBilamoVoiceSession } from '../hooks/useBilamoVoiceSession'
import type { BilamoVoiceMetricsReport } from '../lib/bilamo/voice'
import {
  formatAudioTestBanner,
  getDiagnosticAudioHarnessState,
  resetDiagnosticAudioHarness,
  runDirectAudioProbe,
  runLocalAudioProbe,
  subscribeDiagnosticAudioHarness,
  type DirectAudioProbeResult,
} from '../lib/bilamo/voice/directAudioProbe'
import { captureMicFromUserGesture } from '../lib/bilamo/voice/micGestureCapture'
import { noteVoiceLifecycleStage } from '../lib/bilamo/voice/voiceHttpTrace'
import { unlockAudioPlayback } from '../lib/chat/voice/audioElementTextToSpeechProvider'
import { probeVoiceAuth } from '../lib/security/voiceAuthProbe'

function voiceDiagnosticsEnabled(): boolean {
  if (import.meta.env.DEV) return true
  return String(import.meta.env.VITE_VOICE_METRICS || '').trim() === '1'
}

export default function BilamoVoiceDiagnostics() {
  const allowed = voiceDiagnosticsEnabled()
  // Do NOT auto-prepare on mount — capability probe must not look like an audio attempt.
  const voice = useBilamoVoiceSession({ enabled: false })
  const [report, setReport] = useState<BilamoVoiceMetricsReport | null>(null)
  const [micPermission, setMicPermission] = useState<string>('unknown')
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [authOk, setAuthOk] = useState<boolean | null>(null)

  const harness = useSyncExternalStore(
    subscribeDiagnosticAudioHarness,
    getDiagnosticAudioHarnessState,
    getDiagnosticAudioHarnessState,
  )
  const probe: DirectAudioProbeResult | null = harness.latest
  const audioBanner = formatAudioTestBanner(harness)

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
    void probeVoiceAuth()
      .then((r) => setAuthOk(r.ok))
      .catch(() => setAuthOk(false))
  }, [allowed])

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  const snap = voice.snapshot
  const latest = report?.latest
  const agg = report?.aggregates
  const playback = snap.playback

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const iosMatch = ua.match(/OS (\d+)[_.](\d+)/)
  const capabilityOnly = Boolean(
    playback.httpRoute === '/api/openai/realtime-session'
    || playback.lastEvent === 'REALTIME_CAPABILITY_OK'
    || playback.lastEvent === 'REALTIME_CAPABILITY_FAILED',
  )

  const failureBundle = [
    `AUDIO_TEST=${audioBanner}`,
    `AUDIO_TEST_VERDICT=${harness.verdict}`,
    `AUDIO_TEST_MODE=${probe?.mode || '—'}`,
    `AUDIO_TEST_FAILURE_STAGE=${harness.failureStage || '—'}`,
    `AUDIO_TEST_STAGES=${harness.stages.join(' → ') || '—'}`,
    `AUDIO_TEST_HTTP=${probe?.httpStatus ?? '—'}`,
    `AUDIO_TEST_MIME=${probe?.contentType || '—'}`,
    `AUDIO_TEST_REQUESTED_FORMAT=${probe?.requestedFormat || '—'}`,
    `AUDIO_TEST_BYTES=${probe?.bytes ?? '—'}`,
    `AUDIO_TEST_SIGNATURE=${probe?.fileSignature || '—'}`,
    `AUDIO_TEST_CAN_PLAY_TYPE=${probe?.canPlayType || '—'}`,
    `AUDIO_TEST_DURATION=${probe?.duration ?? '—'}`,
    `AUDIO_TEST_READY_STATE=${probe?.elementReadyState ?? '—'}`,
    `AUDIO_TEST_NETWORK_STATE=${probe?.elementNetworkState ?? '—'}`,
    `AUDIO_TEST_PAUSED=${yn(probe?.elementPaused)}`,
    `AUDIO_TEST_MUTED=${yn(probe?.elementMuted)}`,
    `AUDIO_TEST_VOLUME=${probe?.elementVolume ?? '—'}`,
    `AUDIO_TEST_CURRENT_BEFORE=${probe?.currentTimeBefore ?? '—'}`,
    `AUDIO_TEST_CURRENT_AFTER=${probe?.currentTimeAfter ?? '—'}`,
    `AUDIO_TEST_MAX_CURRENT=${probe?.maxCurrentTime ?? '—'}`,
    `AUDIO_TEST_CTX_BEFORE=${probe?.audioContextStateBefore || '—'}`,
    `AUDIO_TEST_CTX_AFTER=${probe?.audioContextStateAfter || '—'}`,
    `AUDIO_TEST_PLAY=${probe?.playResult || '—'}`,
    `AUDIO_TEST_PLAY_ERROR=${probe?.playError || '—'}`,
    `AUDIO_TEST_PLAY_MSG=${probe?.playErrorMessage || '—'}`,
    `AUDIO_TEST_ELEMENT_ATTACHED=${yn(probe?.elementAttached)}`,
    `AUDIO_TEST_HAS_SRC=${yn(probe?.hasSrc)}`,
    `AUDIO_TEST_HAS_SRC_OBJECT=${yn(probe?.hasSrcObject)}`,
    `AUDIO_TEST_PROGRESS=${yn(probe?.playbackProgressed)}`,
    `AUDIO_TEST_SAFARI=${yn(probe?.isSafari)}`,
    `AUDIO_TEST_IOS=${probe?.iosVersion || '—'}`,
    `VOICE_SESSION_ACTIVE=${yn(snap.voiceSessionActive || playback.voiceSessionActive)}`,
    `CAPABILITY_PROBE_ONLY=${yn(capabilityOnly)}`,
    `LAST_VOICE_EVENT=${playback.lastEvent || '—'}`,
    `browser=${/Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua) ? 'Safari' : (ua.slice(0, 80) || '—')}`,
    `iosVersion=${iosMatch ? `${iosMatch[1]}.${iosMatch[2]}` : '—'}`,
    `authOk=${yn(authOk)}`,
    `micPermission=${micPermission}`,
    `ts=${Date.now()}`,
  ].join('\n')

  const resetAll = () => {
    resetDiagnosticAudioHarness()
    try {
      voice.interrupt()
    } catch {
      /* ignore */
    }
    try {
      voice.clearError()
    } catch {
      /* ignore */
    }
  }

  const bannerClass =
    harness.verdict === 'PASS'
      ? 'border-[color-mix(in_oklab,var(--bilamo-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--bilamo-accent)_12%,transparent)]'
      : harness.verdict === 'FAIL'
        ? 'border-[color-mix(in_oklab,#c45c4a_50%,transparent)] bg-[color-mix(in_oklab,#c45c4a_10%,transparent)]'
        : harness.verdict === 'RUNNING'
          ? 'border-[color-mix(in_oklab,var(--bilamo-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--bilamo-accent)_6%,transparent)]'
          : 'border-[var(--bilamo-border)] bg-[color-mix(in_oklab,var(--bilamo-text)_4%,transparent)]'

  return (
    <BilamoShell>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-6 py-10">
        <header className="space-y-2 text-center">
          <Logo size="sm" className="justify-center" />
          <h1 className="text-[1.2rem] font-medium tracking-[-0.03em] text-[var(--bilamo-text)]">
            Voice diagnostics
          </h1>
          <p className="text-[13px] text-[var(--bilamo-muted)]">
            Staging — isolated Safari audio. Local first, then TTS. Never paste tokens.
          </p>
        </header>

        <section className={`bilamo-glass space-y-4 rounded-[1.25rem] border px-5 py-4 ${bannerClass}`}>
          <p className="text-center text-[15px] font-medium tracking-[-0.02em] text-[var(--bilamo-text)]">
            {audioBanner}
          </p>
          <p className="text-center text-[12.5px] text-[var(--bilamo-muted)]">
            Same persistent audio element for both controls. No mic / realtime / conversation.
          </p>

          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => {
              void runLocalAudioProbe()
            }}
          >
            اختبار صوت محلي
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              void runDirectAudioProbe()
            }}
          >
            اختبار TTS
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resetAll}
          >
            RESET DIAGNOSTICS
          </Button>

          {authOk === false ? (
            <p className="text-center text-[12px] text-[var(--bilamo-muted)]">
              Auth probe failed — اختبار TTS may return HTTP 401. Local test still works offline.
            </p>
          ) : null}

          {probe ? (
            <dl className="space-y-2 text-[13px]">
              <Row label="Verdict" value={probe.verdict} />
              <Row label="Mode" value={probe.mode || '—'} />
              <Row label="Failure stage" value={probe.failureStage || '—'} />
              <Row label="Lifecycle" value={probe.stages.join(' → ') || '—'} />
              <Row label="HTTP status" value={probe.httpStatus == null ? '—' : String(probe.httpStatus)} />
              <Row label="Safe server error" value={probe.safeServerErrorCode || '—'} />
              <Row label="Requested format" value={probe.requestedFormat || '—'} />
              <Row label="MIME" value={probe.contentType || '—'} />
              <Row label="Bytes" value={String(probe.bytes)} />
              <Row label="File signature" value={probe.fileSignature || '—'} />
              <Row label="canPlayType" value={probe.canPlayType || '—'} />
              <Row label="duration" value={probe.duration == null ? '—' : probe.duration.toFixed(3)} />
              <Row label="readyState" value={probe.elementReadyState == null ? '—' : String(probe.elementReadyState)} />
              <Row label="networkState" value={probe.elementNetworkState == null ? '—' : String(probe.elementNetworkState)} />
              <Row label="paused" value={yn(probe.elementPaused)} />
              <Row label="muted" value={yn(probe.elementMuted)} />
              <Row label="volume" value={probe.elementVolume == null ? '—' : String(probe.elementVolume)} />
              <Row label="currentTime before" value={probe.currentTimeBefore == null ? '—' : probe.currentTimeBefore.toFixed(3)} />
              <Row label="currentTime after" value={probe.currentTimeAfter == null ? '—' : probe.currentTimeAfter.toFixed(3)} />
              <Row label="max currentTime" value={probe.maxCurrentTime.toFixed(3)} />
              <Row label="AudioContext before" value={probe.audioContextStateBefore || '—'} />
              <Row label="AudioContext after" value={probe.audioContextStateAfter || '—'} />
              <Row label="play() called" value={yn(probe.playCalled)} />
              <Row label="play() result" value={probe.playResult || '—'} />
              <Row label="play() error name" value={probe.playError || '—'} />
              <Row label="play() error message" value={probe.playErrorMessage || '—'} />
              <Row label="element attached" value={yn(probe.elementAttached)} />
              <Row label="has src" value={yn(probe.hasSrc)} />
              <Row label="has srcObject" value={yn(probe.hasSrcObject)} />
              <Row label="Safari" value={yn(probe.isSafari)} />
              <Row label="iOS version" value={probe.iosVersion || '—'} />
              <Row label="playing event" value={yn(probe.playingEvent)} />
              <Row label="timeupdate" value={yn(probe.timeupdateSeen)} />
              <Row label="playback progressed" value={yn(probe.playbackProgressed)} />
              <Row label="ended" value={yn(probe.ended)} />
              <Row label="correlation" value={probe.correlationId} />
            </dl>
          ) : (
            <p className="text-center text-[12.5px] text-[var(--bilamo-muted)]">
              1) Tap اختبار صوت محلي — if silent, Safari/element/gesture is broken.
              2) Tap اختبار TTS — if local works but TTS fails, MIME/HTTP/blob path is broken.
              PASS requires currentTime progression, not HTTP 200 or play() alone.
            </p>
          )}
        </section>

        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              void navigator.clipboard?.writeText(failureBundle).then(() => {
                setCopyHint('Copied failure bundle (safe fields only).')
                window.setTimeout(() => setCopyHint(null), 2500)
              })
            }}
          >
            COPY FAILURE BUNDLE
          </Button>
          {copyHint ? (
            <p className="text-[12px] text-[var(--bilamo-muted)]">{copyHint}</p>
          ) : (
            <p className="text-[12px] text-[var(--bilamo-muted)]">
              On failure, copy the bundle (or screenshot). Never paste tokens.
            </p>
          )}
        </div>

        <dl className="bilamo-glass space-y-3 rounded-[1.25rem] px-5 py-4 text-[13.5px]">
          <p className="pb-1 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--bilamo-muted)]">
            Session observation (separate from AUDIO TEST)
          </p>
          <Row label="VOICE_SESSION_ACTIVE" value={yn(snap.voiceSessionActive || playback.voiceSessionActive)} />
          <Row label="FINAL_VOICE_STATE" value={snap.state} />
          <Row label="Mic permission" value={micPermission} />
          <Row label="Capability probe only" value={yn(capabilityOnly)} />
          <Row label="Last session event" value={playback.lastEvent || '—'} />
          <Row label="HTTP route (session)" value={playback.httpRoute || '—'} />
          <Row label="Peer connection state" value={playback.peerConnectionState || '—'} />
          <Row
            label="First-audio latency"
            value={formatMs(latest?.timeToFirstAudioMs ?? agg?.timeToFirstAudioMs.last)}
          />
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              noteVoiceLifecycleStage('GESTURE_RECEIVED')
              void (async () => {
                try {
                  await unlockAudioPlayback()
                } catch {
                  /* ignore */
                }
                const mic = await captureMicFromUserGesture()
                if (!mic.ok) return
                await voice.connect({ localStream: mic.stream })
              })()
            }}
          >
            Connect
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void (async () => {
                try {
                  await unlockAudioPlayback()
                } catch {
                  /* ignore */
                }
                const mic = await captureMicFromUserGesture()
                if (!mic.ok) return
                voice.setContinuousListening(true)
                await voice.startListening({ localStream: mic.stream })
              })()
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
      <dd className="max-w-[60%] break-words text-end tabular-nums text-[var(--bilamo-text)]/90">
        {value}
      </dd>
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
