import type { VoiceCenterLocale, VoiceControlId } from '../types'
import { VOICE_CONTROLS } from '../types'

export interface VoiceControlsProps {
  locale?: VoiceCenterLocale
  muted?: boolean
  speakerOn?: boolean
  headphonesOn?: boolean
  onControl: (control: VoiceControlId) => void
}

const CONTROL_LABEL: Record<VoiceControlId, { ar: string; en: string }> = {
  start: { ar: 'ابدأ', en: 'Start' },
  pause: { ar: 'إيقاف مؤقت', en: 'Pause' },
  resume: { ar: 'متابعة', en: 'Resume' },
  stop: { ar: 'إيقاف', en: 'Stop' },
  mute: { ar: 'كتم', en: 'Mute' },
  speaker: { ar: 'مكبر', en: 'Speaker' },
  headphones: { ar: 'سماعة', en: 'Headphones' },
  voice_settings: { ar: 'إعدادات الصوت', en: 'Voice settings' },
  replay: { ar: 'إعادة', en: 'Replay' },
  clear_session: { ar: 'مسح الجلسة', en: 'Clear session' },
}

/** Session controls — UI state only; no speech engine hooks. */
export function VoiceControls({
  locale = 'ar',
  muted = false,
  speakerOn = true,
  headphonesOn = false,
  onControl,
}: VoiceControlsProps) {
  return (
    <div className="rahhal-vc-controls" data-testid="vc-controls">
      {VOICE_CONTROLS.map((control) => {
        const active =
          (control === 'mute' && muted) ||
          (control === 'speaker' && speakerOn) ||
          (control === 'headphones' && headphonesOn)
        return (
          <button
            key={control}
            type="button"
            className={`rahhal-vc-controls__btn${active ? ' is-active' : ''}`}
            data-control={control}
            data-testid={`vc-control-${control}`}
            aria-pressed={active || undefined}
            onClick={() => onControl(control)}
          >
            {locale === 'en' ? CONTROL_LABEL[control].en : CONTROL_LABEL[control].ar}
          </button>
        )
      })}
    </div>
  )
}
