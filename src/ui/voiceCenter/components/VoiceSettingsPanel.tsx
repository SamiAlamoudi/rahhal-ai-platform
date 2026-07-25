import type { VoiceCenterLocale, VoiceSettingsPlaceholders } from '../types'

export interface VoiceSettingsPanelProps {
  settings: VoiceSettingsPlaceholders
  locale?: VoiceCenterLocale
  onChange: (next: VoiceSettingsPlaceholders) => void
}

/** Audio enhancement toggles — placeholders; no real DSP. */
export function VoiceSettingsPanel({
  settings,
  locale = 'ar',
  onChange,
}: VoiceSettingsPanelProps) {
  const rows: Array<{
    key: keyof VoiceSettingsPlaceholders
    ar: string
    en: string
  }> = [
    {
      key: 'noiseSuppression',
      ar: 'كبح الضجيج',
      en: 'Noise suppression',
    },
    {
      key: 'echoCancellation',
      ar: 'إلغاء الصدى',
      en: 'Echo cancellation',
    },
    {
      key: 'autoPunctuation',
      ar: 'ترقيم تلقائي',
      en: 'Auto punctuation',
    },
    {
      key: 'autoLanguageDetection',
      ar: 'اكتشاف اللغة تلقائياً',
      en: 'Auto language detection',
    },
  ]

  return (
    <section className="rahhal-vc-settings" data-testid="vc-settings">
      <h3>{locale === 'en' ? 'Voice settings' : 'إعدادات الصوت'}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <label>
              <input
                type="checkbox"
                data-testid={`vc-setting-${row.key}`}
                data-placeholder="true"
                checked={settings[row.key]}
                onChange={(e) =>
                  onChange({ ...settings, [row.key]: e.target.checked })
                }
              />
              <span>{locale === 'en' ? row.en : row.ar}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
