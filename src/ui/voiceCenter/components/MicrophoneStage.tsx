import type { VoiceCenterLocale, VoiceSessionState } from '../types'

export interface MicrophoneStageProps {
  sessionState: VoiceSessionState
  locale?: VoiceCenterLocale
  onMicClick?: () => void
}

const STATE_LABEL: Record<VoiceSessionState, { ar: string; en: string }> = {
  idle: { ar: 'جاهز', en: 'Idle' },
  listening: { ar: 'يستمع…', en: 'Listening…' },
  processing: { ar: 'يعالج…', en: 'Processing…' },
  speaking: { ar: 'يتحدث…', en: 'Speaking…' },
  paused: { ar: 'متوقف مؤقتاً', en: 'Paused' },
  disconnected: { ar: 'غير متصل', en: 'Disconnected' },
  offline: { ar: 'بدون اتصال', en: 'Offline' },
  permission_required: { ar: 'يلزم إذن الميكروفون', en: 'Permission required' },
  noise_detected: { ar: 'ضجيج مكتشف', en: 'Noise detected' },
  muted: { ar: 'مكتوم', en: 'Muted' },
}

/**
 * Large center microphone + wave / listening / speaking / thinking / idle animations.
 * Visual placeholders only — no STT/TTS.
 */
export function MicrophoneStage({
  sessionState,
  locale = 'ar',
  onMicClick,
}: MicrophoneStageProps) {
  const label =
    locale === 'en' ? STATE_LABEL[sessionState].en : STATE_LABEL[sessionState].ar
  const animClass =
    sessionState === 'listening'
      ? 'is-listening'
      : sessionState === 'processing'
        ? 'is-thinking'
        : sessionState === 'speaking'
          ? 'is-speaking'
          : sessionState === 'idle'
            ? 'is-idle'
            : 'is-static'

  return (
    <section
      className={`rahhal-vc-stage rahhal-vc-stage--${sessionState} ${animClass}`}
      data-testid="vc-microphone-stage"
      data-session-state={sessionState}
      aria-label={label}
    >
      <div className="rahhal-vc-wave" data-testid="vc-wave" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <button
        type="button"
        className="rahhal-vc-mic"
        data-testid="vc-mic-button"
        aria-pressed={sessionState === 'listening' || sessionState === 'speaking'}
        onClick={onMicClick}
      >
        <span className="rahhal-vc-mic__ring" aria-hidden="true" />
        <span className="rahhal-vc-mic__core" aria-hidden="true" />
        <span className="rahhal-vc-mic__label">
          {locale === 'en' ? 'Mic' : 'ميكروفون'}
        </span>
      </button>

      <p className="rahhal-vc-status" data-testid="vc-status" role="status">
        {label}
      </p>
    </section>
  )
}
