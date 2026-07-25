import type { VoiceCenterLocale, VoiceShortcutId } from '../types'
import { VOICE_SHORTCUTS } from '../types'

export interface VoiceShortcutsProps {
  locale?: VoiceCenterLocale
  onShortcut?: (id: VoiceShortcutId) => void
}

const SHORTCUT_LABEL: Record<VoiceShortcutId, { ar: string; en: string }> = {
  plan_trip: { ar: 'خطّط رحلة', en: 'Plan a trip' },
  ask_visa: { ar: 'اسأل عن التأشيرة', en: 'Ask about visa' },
  recommend_destination: { ar: 'اقترح وجهة', en: 'Recommend destination' },
  executive_travel: { ar: 'سفر تنفيذي', en: 'Executive travel' },
  budget_planning: { ar: 'تخطيط الميزانية', en: 'Budget planning' },
  nearby_attractions: { ar: 'معالم قريبة', en: 'Nearby attractions' },
}

/** Quick voice intents — placeholders that only update local UI text. */
export function VoiceShortcuts({ locale = 'ar', onShortcut }: VoiceShortcutsProps) {
  return (
    <div className="rahhal-vc-shortcuts" data-testid="vc-shortcuts">
      {VOICE_SHORTCUTS.map((id) => (
        <button
          key={id}
          type="button"
          className="rahhal-vc-shortcuts__btn"
          data-shortcut={id}
          data-testid={`vc-shortcut-${id}`}
          onClick={() => onShortcut?.(id)}
        >
          {locale === 'en' ? SHORTCUT_LABEL[id].en : SHORTCUT_LABEL[id].ar}
        </button>
      ))}
    </div>
  )
}
