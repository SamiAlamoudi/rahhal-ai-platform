import type {
  VoiceCenterLocale,
  VoicePersonalityModel,
  VoiceStyle,
} from '../types'
import { VOICE_STYLES } from '../types'

export interface VoicePersonalityPanelProps {
  model: VoicePersonalityModel
  locale?: VoiceCenterLocale
  onChange: (next: VoicePersonalityModel) => void
}

const STYLE_LABEL: Record<VoiceStyle, { ar: string; en: string }> = {
  natural: { ar: 'طبيعي', en: 'Natural' },
  professional: { ar: 'احترافي', en: 'Professional' },
  executive: { ar: 'تنفيذي', en: 'Executive' },
}

/** Voice / language / accent / speed / style selectors — placeholders only. */
export function VoicePersonalityPanel({
  model,
  locale = 'ar',
  onChange,
}: VoicePersonalityPanelProps) {
  return (
    <section className="rahhal-vc-personality" data-testid="vc-personality">
      <h3>{locale === 'en' ? 'Voice personality' : 'شخصية الصوت'}</h3>

      <label>
        <span>{locale === 'en' ? 'Voice' : 'الصوت'}</span>
        <select
          data-testid="vc-voice-selector"
          data-placeholder="true"
          value={model.voiceId ?? ''}
          onChange={(e) =>
            onChange({ ...model, voiceId: e.target.value || null })
          }
        >
          <option value="">
            {locale === 'en' ? 'Select voice (placeholder)' : 'اختر صوتاً (واجهة)'}
          </option>
          <option value="rahhal-a">Rahhal A</option>
          <option value="rahhal-b">Rahhal B</option>
        </select>
      </label>

      <label>
        <span>{locale === 'en' ? 'Language' : 'اللغة'}</span>
        <select
          data-testid="vc-language-selector"
          value={model.language}
          onChange={(e) =>
            onChange({
              ...model,
              language: e.target.value === 'en' ? 'en' : 'ar',
            })
          }
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </label>

      <label>
        <span>{locale === 'en' ? 'Accent' : 'اللهجة'}</span>
        <select
          data-testid="vc-accent-selector"
          data-placeholder="true"
          value={model.accent ?? ''}
          onChange={(e) =>
            onChange({ ...model, accent: e.target.value || null })
          }
        >
          <option value="">
            {locale === 'en' ? 'Accent (placeholder)' : 'لهجة (واجهة)'}
          </option>
          <option value="gulf">Gulf</option>
          <option value="levant">Levant</option>
          <option value="egypt">Egypt</option>
        </select>
      </label>

      <label>
        <span>{locale === 'en' ? 'Speech speed' : 'سرعة الكلام'}</span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          data-testid="vc-speech-speed"
          value={model.speechSpeed}
          onChange={(e) =>
            onChange({ ...model, speechSpeed: Number(e.target.value) })
          }
        />
      </label>

      <div className="rahhal-vc-personality__styles" data-testid="vc-voice-style">
        {VOICE_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            data-style={style}
            className={model.style === style ? 'is-active' : undefined}
            aria-pressed={model.style === style}
            onClick={() => onChange({ ...model, style })}
          >
            {locale === 'en' ? STYLE_LABEL[style].en : STYLE_LABEL[style].ar}
          </button>
        ))}
      </div>
    </section>
  )
}
