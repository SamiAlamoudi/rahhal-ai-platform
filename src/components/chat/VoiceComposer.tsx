import { useEffect, useRef, useState } from 'react'
import type { VoiceInputMode, VoiceLocale, VoiceSessionStatus } from '../../lib/chat/voice/voiceTypes'
import { VOICE_LOCALES } from '../../lib/chat/voice/voiceTypes'
import VoiceWaveform from './VoiceWaveform'

interface VoiceComposerProps {
  enabled: boolean
  status: VoiceSessionStatus
  mode: VoiceInputMode
  locale: VoiceLocale
  partialTranscript: string
  permissionError: string | null
  permissionState?: 'granted' | 'denied' | 'prompt' | 'unsupported' | null
  busy: boolean
  online?: boolean
  level?: number
  onModeChange: (mode: VoiceInputMode) => void
  onLocaleChange: (locale: VoiceLocale) => void
  onPushStart: () => void
  onPushEnd: () => void
  onToggleHandsFree: () => void
  onInterrupt: () => void
  onRequestPermission: () => void
}

const STATUS_LABELS: Record<VoiceSessionStatus, string> = {
  idle: 'جاهز',
  requesting_permission: 'طلب إذن الميكروفون…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  responding: 'Responding…',
  processing: 'Thinking…',
  speaking: 'Speaking…',
  reconnecting: 'إعادة الاتصال بالاستماع…',
  error: 'خطأ',
}

export default function VoiceComposer({
  enabled,
  status,
  mode,
  locale,
  partialTranscript,
  permissionError,
  permissionState = null,
  busy,
  online = true,
  level = 0,
  onModeChange,
  onLocaleChange,
  onPushStart,
  onPushEnd,
  onToggleHandsFree,
  onInterrupt,
  onRequestPermission,
}: VoiceComposerProps) {
  const listening = status === 'listening'
  const speaking = status === 'speaking'
  const thinking = status === 'thinking' || status === 'processing'
  const responding = status === 'responding'
  const processing = thinking || responding
  const reconnecting = status === 'reconnecting'
  const holdRef = useRef(false)
  const [smoothLevel, setSmoothLevel] = useState(0)
  const showMicHelp = !!permissionError || permissionState === 'denied' || permissionState === 'unsupported'

  useEffect(() => {
    setSmoothLevel((prev) => prev * 0.55 + level * 0.45)
  }, [level])

  useEffect(() => {
    if (mode !== 'push_to_talk') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (e.repeat || !enabled || processing || speaking || reconnecting) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()
      holdRef.current = true
      onPushStart()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (!holdRef.current) return
      e.preventDefault()
      holdRef.current = false
      onPushEnd()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [mode, enabled, processing, speaking, reconnecting, onPushStart, onPushEnd])

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">المحادثة الصوتية</p>
          <p className="text-[11px] text-slate-400">
            نفس سجل المحادثة والنص — بدون اتصال هاتفي أو فيديو
          </p>
        </div>
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            status === 'error'
              ? 'bg-rose-100 text-rose-700'
              : listening || speaking || reconnecting || thinking || responding
                ? 'bg-primary-50 text-primary-700'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {(listening || speaking || thinking || responding) && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
          )}
          {STATUS_LABELS[status]}
        </span>
      </div>

      {!online && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
          أنت غير متصل — سيتم استئناف المحادثة عند عودة الشبكة
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600" htmlFor="voice-mode">
          الوضع
          <select
            id="voice-mode"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as VoiceInputMode)}
            disabled={!enabled || busy}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="push_to_talk">اضغط للتحدث</option>
            <option value="hands_free">حر اليدين</option>
          </select>
        </label>
        <label className="text-xs text-slate-600" htmlFor="voice-locale">
          اللغة
          <select
            id="voice-locale"
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value as VoiceLocale)}
            disabled={!enabled || busy}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="ar">{VOICE_LOCALES.ar.labelAr}</option>
            <option value="en">{VOICE_LOCALES.en.labelEn}</option>
          </select>
        </label>
      </div>

      {showMicHelp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>{permissionError || 'يلزم إذن الميكروفون لاستخدام الصوت'}</p>
          <button
            type="button"
            onClick={onRequestPermission}
            className="mt-1 font-medium underline"
          >
            إعادة طلب إذن الميكروفون
          </button>
        </div>
      )}

      <VoiceWaveform
        active={listening}
        level={smoothLevel}
        label={listening ? 'Recording waveform' : 'Idle waveform'}
      />

      <div
        className="min-h-[3rem] rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
        aria-live="polite"
      >
        {partialTranscript.trim()
          ? partialTranscript
          : listening
            ? '…تحدث الآن — التوقف القصير (٢–٣ ثوانٍ) لن يقطع التسجيل'
            : 'سيظهر نص كلامك هنا ويُحفظ في سجل المحادثة'}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {mode === 'push_to_talk' ? (
          <button
            type="button"
            disabled={!enabled || processing || speaking || reconnecting || !online}
            aria-label={listening ? 'أفلت لإرسال الرسالة الصوتية' : 'اضغط مع الاستمرار للتحدث'}
            aria-pressed={listening}
            onMouseDown={() => void onPushStart()}
            onMouseUp={() => void onPushEnd()}
            onMouseLeave={() => listening && void onPushEnd()}
            onTouchStart={() => void onPushStart()}
            onTouchEnd={() => void onPushEnd()}
            className={`min-h-12 flex-1 touch-none rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors ${
              listening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
            } disabled:bg-slate-300`}
          >
            {listening ? 'أفلت للإرسال' : 'اضغط مع الاستمرار للتحدث'}
          </button>
        ) : (
          <button
            type="button"
            disabled={!enabled || processing || !online}
            aria-pressed={listening}
            aria-label={listening ? 'إيقاف وضع حر اليدين' : 'تشغيل وضع حر اليدين'}
            onClick={onToggleHandsFree}
            className={`min-h-12 flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors ${
              listening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
            } disabled:bg-slate-300`}
          >
            {listening ? 'إيقاف حر اليدين' : 'تشغيل حر اليدين'}
          </button>
        )}

        {(speaking || processing || listening || reconnecting) && (
          <button
            type="button"
            onClick={onInterrupt}
            aria-label="مقاطعة الرد الصوتي"
            className="min-h-12 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
          >
            مقاطعة
          </button>
        )}
      </div>
      {mode === 'push_to_talk' && (
        <p className="text-[10px] text-slate-400">اختصار لوحة المفاتيح: مسافة للضغط مع الاستمرار</p>
      )}
    </div>
  )
}
