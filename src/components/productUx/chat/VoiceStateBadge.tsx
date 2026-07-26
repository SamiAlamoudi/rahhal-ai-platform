import { productStatus, type ProductLocale } from '../../../lib/productUx'
import { noteThinkingUiEntered, thinkingEvidence } from '../../../lib/chat/voice/thinkingStuckEvidence'

export type VoiceUiState =
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'offline'
  | 'error'
  | 'ready'

export interface VoiceStateBadgeProps {
  state: VoiceUiState
  locale?: ProductLocale
}

export function VoiceStateBadge({ state, locale = 'ar' }: VoiceStateBadgeProps) {
  const meta = productStatus[state] ?? productStatus.ready
  const label = locale === 'ar' ? meta.labelAr : meta.labelEn

  if (state === 'thinking') {
    noteThinkingUiEntered('VoiceStateBadge')
    thinkingEvidence('REACT_RENDER', {
      reactState: {
        voiceUiState: state,
        voiceStatus: 'thinking',
        waitingComponent: 'VoiceStateBadge',
      },
      meta: {
        component: 'VoiceStateBadge',
        label,
        paintsThinking: true,
      },
    })
  }

  return (
    <span
      data-testid="voice-state-badge"
      data-state={state}
      role="status"
      aria-live="polite"
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      {label}
    </span>
  )
}
