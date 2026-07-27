import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import type { HomeLocale } from '../../lib/aiHome'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import {
  resetVoiceSessionId,
  voiceStage,
  voiceTrace,
} from '../../lib/chat/voice/voiceDebugTrace'
import { consultantLine } from '../../lib/premiumExperience'
import { HomeButton } from './HomeButton'

export type ComposerSubmitSource = 'text' | 'voice'

export interface ConversationComposerProps {
  locale: HomeLocale
  value: string
  onChange: (value: string) => void
  /**
   * Same handler for typed CTA and voice auto-submit.
   * Voice source must not require a second “ابدأ المحادثة” click.
   * onChange alone is NEVER submission.
   */
  onSubmit: (value: string, meta?: { source: ComposerSubmitSource }) => void
  /** Optional override; when omitted, built-in speech recognition is used. */
  onVoiceClick?: () => void
  disabled?: boolean
}

type VoiceUiStatus = 'idle' | 'listening' | 'submitting' | 'error'

/** Never remain forever in submitting/thinking after a voice final. */
const VOICE_SUBMIT_WATCHDOG_MS = 12_000

const VOICE_STATUS_AR: Record<VoiceUiStatus, string> = {
  idle: 'جاهز',
  listening: 'أستمع إليك…',
  submitting: 'جاري إرسال طلبك…',
  error: 'تعذر إرسال الرسالة الصوتية',
}

function normalizeVoiceTranscript(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function ConversationComposer({
  locale,
  value,
  onChange,
  onSubmit,
  onVoiceClick,
  disabled,
}: ConversationComposerProps) {
  const [focused, setFocused] = useState(false)
  const [voiceUi, setVoiceUi] = useState<VoiceUiStatus>('idle')
  const [liveCaption, setLiveCaption] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [preservedTranscript, setPreservedTranscript] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value
  const liveCaptionRef = useRef('')
  const preservedTranscriptRef = useRef('')
  const voiceUiRef = useRef<VoiceUiStatus>('idle')
  voiceUiRef.current = voiceUi
  const submittedRef = useRef(false)
  const lastVoiceKeyRef = useRef('')
  const turnIdRef = useRef<string | null>(null)
  const sessionHeardRef = useRef(false)
  const submitWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  const clearSubmitWatchdog = () => {
    if (submitWatchdogRef.current) {
      clearTimeout(submitWatchdogRef.current)
      submitWatchdogRef.current = null
    }
  }

  const markSubmitSkipped = (reason: string, transcriptLen = 0, preview?: string) => {
    voiceStage({
      stage: 'FAILURE',
      success: false,
      turnId: turnIdRef.current,
      reason,
      previousState: 'TRANSCRIPT_CLEANED',
      currentState: 'ERROR',
      recoveryAction: 'retry_voice_or_type',
      transcriptLen,
      preview,
      meta: { failedStage: 'VOICE_SUBMIT' },
    })
  }

  const submitFrom = (raw: string, source: ComposerSubmitSource): boolean => {
    const trimmed = normalizeVoiceTranscript(raw)
    if (!trimmed || disabled) {
      const reason = !trimmed ? 'onSubmit_skipped_empty' : 'onSubmit_skipped_disabled'
      voiceTrace({
        event: 'submission_rejected',
        turnId: turnIdRef.current,
        reason,
        transcriptLen: trimmed.length,
      })
      if (source === 'voice') markSubmitSkipped(reason, trimmed.length)
      return false
    }
    if (submittedRef.current) {
      const reason = 'onSubmit_skipped_already_submitted'
      voiceTrace({
        event: 'submission_rejected',
        turnId: turnIdRef.current,
        reason,
        transcriptLen: trimmed.length,
      })
      if (source === 'voice') markSubmitSkipped(reason, trimmed.length, trimmed)
      return false
    }
    const key = `${source}:${trimmed}`
    if (source === 'voice' && key === lastVoiceKeyRef.current) {
      const reason = 'onSubmit_skipped_duplicate_final'
      voiceTrace({
        event: 'submission_rejected',
        turnId: turnIdRef.current,
        reason,
        transcriptLen: trimmed.length,
      })
      markSubmitSkipped(reason, trimmed.length, trimmed)
      return false
    }

    voiceTrace({
      event: 'submission_requested',
      turnId: turnIdRef.current,
      transcriptLen: trimmed.length,
      preview: trimmed,
      meta: { source },
    })

    submittedRef.current = true
    if (source === 'voice') lastVoiceKeyRef.current = key
    // Preview/composer value update is NOT submission — onSubmit is.
    onChange(trimmed)
    try {
      onSubmit(trimmed, { source })
      voiceTrace({
        event: 'submission_accepted',
        turnId: turnIdRef.current,
        transcriptLen: trimmed.length,
        meta: { source },
      })
      return true
    } catch (e) {
      submittedRef.current = false
      const reason = e instanceof Error ? e.message : 'onSubmit_threw'
      voiceTrace({
        event: 'failure',
        turnId: turnIdRef.current,
        reason,
        transcriptLen: trimmed.length,
      })
      voiceStage({
        stage: 'FAILURE',
        success: false,
        turnId: turnIdRef.current,
        reason,
        previousState: 'SUBMITTING',
        currentState: 'ERROR',
        recoveryAction: 'retry_voice_or_type',
        transcriptLen: trimmed.length,
        preview: trimmed,
        meta: { failedStage: 'VOICE_SUBMIT' },
        error: e,
      })
      return false
    }
  }

  const commitVoiceFinal = (raw: string, origin: 'onResult' | 'listening_ended') => {
    const cleaned = normalizeVoiceTranscript(raw)
    voiceStage({
      stage: 'FINAL_RESULT',
      turnId: turnIdRef.current,
      transcriptLen: cleaned.length,
      preview: cleaned,
      previousState: 'LISTENING',
      currentState: 'FINAL_TRANSCRIPT',
      meta: { origin },
    })
    voiceStage({
      stage: 'TRANSCRIPT_CLEANED',
      turnId: turnIdRef.current,
      transcriptLen: cleaned.length,
      preview: cleaned,
      previousState: 'FINAL_TRANSCRIPT',
      currentState: 'TRANSCRIPT_CLEANED',
    })

    setLiveCaption('')
    liveCaptionRef.current = ''
    if (!cleaned) {
      voiceStage({
        stage: 'FAILURE',
        success: false,
        turnId: turnIdRef.current,
        reason: 'transcript_cleaned_empty',
        previousState: 'TRANSCRIPT_CLEANED',
        currentState: 'ERROR',
        recoveryAction: 'retry_mic_or_type',
        meta: { failedStage: 'TRANSCRIPT_CLEANED', origin },
      })
      setVoiceUi('error')
      setSubmitError(
        t(
          'لم يتم التقاط كلام واضح. أعد المحاولة أو اكتب طلبك.',
          'No clear speech captured. Retry or type your request.',
        ),
      )
      return
    }

    setPreservedTranscript(cleaned)
    preservedTranscriptRef.current = cleaned
    setSubmitError(null)
    setVoiceUi('submitting')
    clearSubmitWatchdog()
    submitWatchdogRef.current = setTimeout(() => {
      submitWatchdogRef.current = null
      if (voiceUiRef.current !== 'submitting') return
      voiceStage({
        stage: 'FAILURE',
        success: false,
        turnId: turnIdRef.current,
        reason: 'voice_submit_watchdog_timeout',
        previousState: 'SUBMITTING',
        currentState: 'ERROR',
        recoveryAction: 'retry_voice_or_type',
        transcriptLen: cleaned.length,
        preview: cleaned,
        meta: { failedStage: 'CHAT_REQUEST', watchdogMs: VOICE_SUBMIT_WATCHDOG_MS },
      })
      setVoiceUi('error')
      setSubmitError(
        t(
          'تعذر إكمال الإرسال الصوتي. اضغط إعادة المحاولة أو اكتب طلبك.',
          'Voice send timed out. Retry or type your request.',
        ),
      )
    }, VOICE_SUBMIT_WATCHDOG_MS)

    voiceStage({
      stage: 'VOICE_SUBMIT',
      turnId: turnIdRef.current,
      transcriptLen: cleaned.length,
      preview: cleaned,
      previousState: 'TRANSCRIPT_CLEANED',
      currentState: 'SUBMITTING',
      meta: { phase: 'start', origin },
    })
    const ok = submitFrom(cleaned, 'voice')
    if (!ok) {
      clearSubmitWatchdog()
      setVoiceUi('error')
      setSubmitError(
        t(
          'تعذر إرسال الرسالة الصوتية. اضغط إعادة المحاولة أو اكتب طلبك.',
          'Could not send the voice message. Retry or type your request.',
        ),
      )
      // Preserve transcript in the composer for retry without refresh.
      onChange(cleaned)
    }
  }

  const speech = useSpeechRecognition({
    lang: locale === 'ar' ? 'ar-SA' : 'en-US',
    silenceMs: 1800,
    onInterim: (interim) => {
      const text = normalizeVoiceTranscript(interim)
      setLiveCaption(text)
      liveCaptionRef.current = text
      if (text) {
        sessionHeardRef.current = true
        // Keep composer value in sync so listening_ended can recover via valueRef.
        onChange(text)
        setVoiceUi('listening')
        voiceStage({
          stage: 'INTERIM_RESULT',
          turnId: turnIdRef.current,
          transcriptLen: text.length,
          preview: text,
          previousState: 'LISTENING',
          currentState: 'LISTENING',
        })
      }
    },
    onResult: (transcript) => {
      commitVoiceFinal(transcript, 'onResult')
    },
  })

  useEffect(() => {
    // After voice submit is accepted, stop home STT so it cannot steal the next turn.
    if (voiceUi === 'submitting' && submittedRef.current) {
      speech.cancel()
    }
    if (voiceUi !== 'submitting') clearSubmitWatchdog()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- edge on submitting only
  }, [voiceUi])

  useEffect(() => () => clearSubmitWatchdog(), [])

  useEffect(() => {
    if (speech.isListening) {
      sessionHeardRef.current = sessionHeardRef.current || Boolean(speech.interimTranscript)
      setVoiceUi((prev) => (prev === 'submitting' || prev === 'error' ? prev : 'listening'))
      return
    }

    // Listening ended — Safari/WebKit sometimes skips onResult after interim-only results.
    if (submittedRef.current || voiceUiRef.current === 'submitting') return
    if (speech.error === 'user-cancelled') {
      setVoiceUi('idle')
      return
    }

    const leftover = normalizeVoiceTranscript(
      speech.finalTranscript
        || liveCaptionRef.current
        || speech.interimTranscript
        || preservedTranscriptRef.current
        || valueRef.current,
    )

    if (leftover) {
      commitVoiceFinal(leftover, 'listening_ended')
      return
    }

    if (sessionHeardRef.current || voiceUiRef.current === 'listening') {
      // Empty automatic WebKit/watchdog end with no speech → idle, not permanent ERROR.
      if (!leftover && !sessionHeardRef.current) {
        setVoiceUi('idle')
        setSubmitError(null)
        return
      }
      // Hook may already have staged FAILURE (empty deliver / watchdog).
      if (speech.status !== 'error' && speech.status !== 'permission-denied') {
        voiceStage({
          stage: 'FAILURE',
          success: false,
          turnId: turnIdRef.current,
          reason: 'listening_ended_without_transcript',
          previousState: 'LISTENING',
          currentState: 'ERROR',
          recoveryAction: 'retry_mic_or_type',
          meta: { failedStage: 'FINAL_RESULT' },
        })
      }
      setVoiceUi('error')
      setSubmitError(
        speech.errorMessage
          || t(
            'انتهت الجلسة دون نص. أعد المحاولة أو اكتب طلبك.',
            'Listening ended with no transcript. Retry or type your request.',
          ),
      )
      return
    }

    setVoiceUi('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional edge on isListening
  }, [speech.isListening])

  useEffect(() => {
    if (
      speech.error === 'unsupported'
      || speech.error === 'permission-denied'
      || speech.status === 'error'
    ) {
      if (!submittedRef.current) setVoiceUi('error')
    }
  }, [speech.error, speech.status])

  const submit = () => {
    setSubmitError(null)
    const ok = submitFrom(value, 'text')
    if (!ok && value.trim()) {
      setSubmitError(
        t('تعذر بدء المحادثة. حاول مرة أخرى.', 'Could not start the conversation. Try again.'),
      )
    }
  }

  const retryVoiceSubmit = () => {
    const text = normalizeVoiceTranscript(preservedTranscript || value)
    if (!text) return
    submittedRef.current = false
    lastVoiceKeyRef.current = ''
    setSubmitError(null)
    setVoiceUi('submitting')
    const ok = submitFrom(text, 'voice')
    if (!ok) {
      setVoiceUi('error')
      setSubmitError(
        t(
          'تعذر إرسال الرسالة الصوتية. اضغط إعادة المحاولة أو اكتب طلبك.',
          'Could not send the voice message. Retry or type your request.',
        ),
      )
    }
  }

  const onForm = (e: FormEvent) => {
    e.preventDefault()
    if (speech.isListening || voiceUi === 'submitting') return
    if (voiceUi === 'error' && preservedTranscript) {
      retryVoiceSubmit()
      return
    }
    submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (speech.isListening || voiceUi === 'submitting') return
      submit()
    }
  }

  const onMicClick = () => {
    if (onVoiceClick) {
      onVoiceClick()
      return
    }
    if (!speech.isSupported) {
      setVoiceUi('error')
      speech.start()
      return
    }
    if (speech.isListening) {
      // Explicit stop — onResult / listening_ended will commit if there is text.
      speech.stop()
      return
    }
    if (voiceUi === 'error' && preservedTranscript.trim()) {
      retryVoiceSubmit()
      return
    }
    submittedRef.current = false
    lastVoiceKeyRef.current = ''
    sessionHeardRef.current = false
    clearSubmitWatchdog()
    turnIdRef.current = `home_${Date.now().toString(36)}`
    resetVoiceSessionId()
    setLiveCaption('')
    liveCaptionRef.current = ''
    setPreservedTranscript('')
    preservedTranscriptRef.current = ''
    setSubmitError(null)
    setVoiceUi('listening')
    onChange('')
    speech.clearError()
    voiceStage({
      stage: 'MIC_PERMISSION',
      turnId: turnIdRef.current,
      previousState: 'IDLE',
      currentState: 'LISTENING',
      meta: { phase: 'home_mic_tap', supported: speech.isSupported },
      success: speech.isSupported,
      reason: speech.isSupported ? null : 'speech_recognition_unsupported',
      recoveryAction: speech.isSupported ? null : 'fallback_to_text',
    })
    speech.start()
    voiceStage({
      stage: 'STT_START',
      turnId: turnIdRef.current,
      previousState: 'LISTENING',
      currentState: 'LISTENING',
      meta: { source: 'home_composer', note: 'start_invoked_await_engine_onstart' },
    })
  }

  const listening = !onVoiceClick && speech.isListening
  const voiceSessionActive =
    listening || voiceUi === 'submitting' || (voiceUi === 'error' && !!preservedTranscript)
  const showVoiceError =
    !onVoiceClick &&
    (voiceUi === 'error'
      || (!!speech.errorMessage &&
        speech.error !== 'user-cancelled' &&
        (speech.status === 'error'
          || speech.status === 'permission-denied'
          || speech.status === 'unsupported')))

  const micLabel = listening
    ? t('إيقاف الجلسة الصوتية', 'Stop voice session')
    : t('بدء الجلسة الصوتية', 'Start voice session')

  const statusLabel =
    locale === 'ar'
      ? VOICE_STATUS_AR[voiceUi === 'error' || showVoiceError ? 'error' : voiceUi]
      : voiceUi === 'listening'
        ? 'Listening…'
        : voiceUi === 'submitting'
          ? 'Sending…'
          : voiceUi === 'error' || showVoiceError
            ? 'Voice send failed'
            : 'Ready'

  return (
    <motion.form
      onSubmit={onForm}
      data-testid="ai-home-composer"
      data-voice-ui={voiceUi}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
      className={`rounded-[1.75rem] border bg-white/95 p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-xl transition-all duration-200 sm:p-4 ${
        focused || listening
          ? 'border-primary-400 ring-4 ring-primary-500/15'
          : 'border-white/80'
      }`}
    >
      <label className="sr-only" htmlFor="ai-home-input">
        {t('اكتب طلب سفرك', 'Describe your trip')}
      </label>
      {!voiceSessionActive ? (
        <textarea
          id="ai-home-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={disabled}
          placeholder={t(
            'مثال: أريد السفر إلى طوكيو لمدة أسبوع…',
            'e.g. I want a week in Tokyo…',
          )}
          className="w-full resize-none bg-transparent px-2 py-2 text-base leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-[1.05rem]"
        />
      ) : (
        <div
          className="min-h-[4.5rem] px-2 py-2 text-base leading-relaxed text-slate-700"
          aria-live="polite"
          data-testid="ai-home-voice-caption"
        >
          <p
            className="text-sm font-medium text-rose-600"
            role="status"
            data-testid="ai-home-voice-status"
            data-state={voiceUi}
          >
            {statusLabel}
          </p>
          <p className="mt-1 text-slate-500">
            {liveCaption
              || speech.interimTranscript
              || preservedTranscript
              || (voiceUi === 'submitting'
                ? t('جاري بدء المحادثة…', 'Starting conversation…')
                : t('…تحدث الآن', '…speak now'))}
          </p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled || voiceUi === 'submitting'}
            data-testid="ai-home-voice"
            data-listening={listening ? 'true' : 'false'}
            aria-label={micLabel}
            aria-pressed={listening}
            title={micLabel}
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-40 ${
              listening
                ? 'voice-mic-pulse scale-105 bg-rose-500 text-white shadow-lg shadow-rose-500/35'
                : 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 hover:scale-[1.03] hover:bg-slate-800'
            }`}
          >
            {listening ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {!voiceSessionActive ? (
            <span className="hidden text-xs text-slate-400 sm:inline">
              {t('تحدث أو اكتب — رحّال يستمع', 'Speak or type — Rahhal is ready')}
            </span>
          ) : null}
        </div>
        {!voiceSessionActive ? (
          <HomeButton
            type="submit"
            size="md"
            disabled={disabled || !value.trim()}
            data-testid="ai-home-send"
            className="min-h-11 rounded-2xl px-5"
          >
            {consultantLine(locale, 'startChat')}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 rtl:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </HomeButton>
        ) : voiceUi === 'error' && preservedTranscript ? (
          <button
            type="button"
            onClick={retryVoiceSubmit}
            data-testid="ai-home-voice-retry"
            className="min-h-11 rounded-2xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700"
          >
            {t('إعادة المحاولة', 'Retry')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (listening) speech.stop()
              else {
                speech.cancel()
                setVoiceUi('idle')
                setLiveCaption('')
                setSubmitError(null)
              }
            }}
            data-testid="ai-home-voice-stop"
            className="min-h-11 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100"
          >
            {t('إيقاف', 'Stop')}
          </button>
        )}
      </div>
      {showVoiceError || submitError ? (
        <p
          className="mt-2 px-1 text-[11px] text-rose-600"
          role="alert"
          data-testid="ai-home-voice-error"
        >
          {submitError
            || (speech.error === 'unsupported'
              ? t(
                  'الإدخال الصوتي غير مدعوم في هذا المتصفح — استخدم الكتابة.',
                  'Voice input is not supported in this browser — use typing.',
                )
              : speech.error === 'permission-denied'
                ? t(
                    'تم رفض إذن الميكروفون. اسمح بالوصول وحاول مرة أخرى.',
                    speech.errorMessage ?? 'Microphone permission denied.',
                  )
                : speech.error === 'no-speech'
                  ? t(
                      'لم يتم رصد كلام. اضغط الميكروفون وحاول مرة أخرى.',
                      speech.errorMessage ?? 'No speech detected.',
                    )
                  : t(
                      'تعذر تشغيل الصوت. يمكنك الكتابة بدلًا من ذلك.',
                      speech.errorMessage ?? 'Voice failed — you can type instead.',
                    ))}
        </p>
      ) : null}
    </motion.form>
  )
}
