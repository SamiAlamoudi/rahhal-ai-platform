import type { VoiceInputMode, VoiceLocale, VoiceSessionStatus } from '../../lib/chat/voice/voiceTypes'
import { VOICE_LOCALES } from '../../lib/chat/voice/voiceTypes'

interface VoiceComposerProps {
  enabled: boolean
  status: VoiceSessionStatus
  mode: VoiceInputMode
  locale: VoiceLocale
  partialTranscript: string
  permissionError: string | null
  busy: boolean
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
  listening: 'جاري الاستماع…',
  processing: 'جاري معالجة الرد…',
  speaking: 'رحّال يتحدث…',
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
  busy,
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
  const processing = status === 'processing' || status === 'reconnecting'

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">المحادثة الصوتية</p>
          <p className="text-[11px] text-slate-400">
            نفس سجل المحادثة والنص — بدون اتصال هاتفي أو فيديو
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
          status === 'error'
            ? 'bg-rose-100 text-rose-700'
            : listening || speaking
              ? 'bg-primary-50 text-primary-700'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          الوضع
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as VoiceInputMode)}
            disabled={!enabled || busy}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="push_to_talk">اضغط للتحدث</option>
            <option value="hands_free">حر اليدين</option>
          </select>
        </label>
        <label className="text-xs text-slate-600">
          اللغة
          <select
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

      {(permissionError || status === 'error') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>{permissionError || 'حدث خطأ في الصوت'}</p>
          <button
            type="button"
            onClick={onRequestPermission}
            className="mt-1 font-medium underline"
          >
            إعادة طلب إذن الميكروفون
          </button>
        </div>
      )}

      <div className="min-h-[3rem] rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {partialTranscript.trim()
          ? partialTranscript
          : listening
            ? '…تحدث الآن'
            : 'سيظهر نص كلامك هنا ويُحفظ في سجل المحادثة'}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {mode === 'push_to_talk' ? (
          <button
            type="button"
            disabled={!enabled || processing || speaking}
            onMouseDown={() => void onPushStart()}
            onMouseUp={() => void onPushEnd()}
            onMouseLeave={() => listening && void onPushEnd()}
            onTouchStart={(e) => {
              e.preventDefault()
              void onPushStart()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              void onPushEnd()
            }}
            className={`min-h-12 flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors ${
              listening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
            } disabled:bg-slate-300`}
          >
            {listening ? 'أفلت للإرسال' : 'اضغط مع الاستمرار للتحدث'}
          </button>
        ) : (
          <button
            type="button"
            disabled={!enabled || processing}
            onClick={onToggleHandsFree}
            className={`min-h-12 flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors ${
              listening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
            } disabled:bg-slate-300`}
          >
            {listening ? 'إيقاف حر اليدين' : 'تشغيل حر اليدين'}
          </button>
        )}

        {(speaking || processing || listening) && (
          <button
            type="button"
            onClick={onInterrupt}
            className="min-h-12 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
          >
            مقاطعة
          </button>
        )}
      </div>
    </div>
  )
}
