import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import {
  ARABIC_DIALECT_OPTIONS,
  OPENAI_TTS_VOICES,
  SPEAKING_SPEED_OPTIONS,
  VOICE_ENERGY_OPTIONS,
  loadVoiceExperiencePrefs,
  saveVoiceExperiencePrefs,
  type ArabicDialectPreference,
  type OpenAiTtsVoiceId,
  type VoiceEnergyPreference,
  type VoiceExperiencePrefs,
  type VoiceGenderPreference,
  type VoiceSpeakingSpeed,
} from '../../lib/chat/voice/voiceExperiencePrefs'

const sectionClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600'
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100'

/**
 * Voice Experience settings — persisted per user, never written into trip memory.
 */
export function VoiceExperienceSettingsPanel() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [prefs, setPrefs] = useState<VoiceExperiencePrefs>(() => loadVoiceExperiencePrefs(userId))
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    setPrefs(loadVoiceExperiencePrefs(userId))
  }, [userId])

  const update = <K extends keyof VoiceExperiencePrefs>(key: K, value: VoiceExperiencePrefs[K]) => {
    const next = saveVoiceExperiencePrefs({ [key]: value }, userId)
    setPrefs(next)
    setSavedAt(new Date().toLocaleTimeString('ar-SA'))
  }

  const voices = OPENAI_TTS_VOICES.filter((v) => {
    if (prefs.gender === 'any') return true
    return v.gender === prefs.gender
  })

  return (
    <section className={sectionClass} aria-labelledby="voice-experience-heading">
      <h2 id="voice-experience-heading" className="text-sm font-bold text-slate-900">
        تجربة الصوت
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        تفضيلات الصوت واللهجة وسرعة الكلام. لا تُحقن في ذاكرة الرحلة ولا تغيّر حقائق السفر.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="voice-gender">تفضيل الصوت</label>
          <select
            id="voice-gender"
            className={inputClass}
            value={prefs.gender}
            onChange={(e) => update('gender', e.target.value as VoiceGenderPreference)}
          >
            <option value="female">صوت أنثوي</option>
            <option value="male">صوت ذكوري</option>
            <option value="any">الكل</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="voice-id">صوت OpenAI</label>
          <select
            id="voice-id"
            className={inputClass}
            value={prefs.voiceId}
            onChange={(e) => update('voiceId', e.target.value as OpenAiTtsVoiceId)}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.labelAr} ({v.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="voice-dialect">لهجة العربية</label>
          <select
            id="voice-dialect"
            className={inputClass}
            value={prefs.dialect}
            onChange={(e) => update('dialect', e.target.value as ArabicDialectPreference)}
          >
            {ARABIC_DIALECT_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.labelAr}{d.verifiedNativeQuality ? '' : ' (توجيه لطيف)'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            لا ندّعي جودة لهجة أصلية إلا بعد تحقق صوتي. عند ضعف الجودة نعود لعربية واضحة طبيعية.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="voice-speed">سرعة الكلام</label>
          <select
            id="voice-speed"
            className={inputClass}
            value={prefs.speed}
            onChange={(e) => update('speed', e.target.value as VoiceSpeakingSpeed)}
          >
            {SPEAKING_SPEED_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.labelAr}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="voice-energy">طاقة الصوت</label>
          <select
            id="voice-energy"
            className={inputClass}
            value={prefs.energy}
            onChange={(e) => update('energy', e.target.value as VoiceEnergyPreference)}
          >
            {VOICE_ENERGY_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.labelAr}</option>
            ))}
          </select>
        </div>
      </div>

      {savedAt && (
        <p className="mt-3 text-xs text-emerald-700" role="status">
          تم حفظ تفضيلات الصوت · {savedAt}
        </p>
      )}
    </section>
  )
}
