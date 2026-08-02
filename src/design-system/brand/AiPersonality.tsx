/**
 * Rahhal AI visual personality — each cognitive state has a signature mark.
 */

import type { ReactNode } from 'react'
import {
  IconCheck,
  IconCompass,
  IconPackage,
  IconPlane,
  IconSearch,
  IconSpark,
  IconWallet,
} from '../icons/OutlinedIcons'
import { DsText } from '../components/primitives'

export type RahhalAiState =
  | 'thinking'
  | 'reasoning'
  | 'memory'
  | 'recommendations'
  | 'searching'
  | 'comparing'
  | 'booking'
  | 'confirmation'

export const RAHHAL_AI_STATES: Array<{
  id: RahhalAiState
  label: string
  labelAr: string
  tone: string
}> = [
  { id: 'thinking', label: 'Thinking', labelAr: 'يفكّر', tone: 'var(--ds-tide-500)' },
  { id: 'reasoning', label: 'Reasoning', labelAr: 'يستنتج', tone: 'var(--ds-ocean-500)' },
  { id: 'memory', label: 'Memory', labelAr: 'يتذكّر', tone: 'var(--ds-ocean-600)' },
  { id: 'recommendations', label: 'Recommendations', labelAr: 'يقترح', tone: 'var(--ds-tide-600)' },
  { id: 'searching', label: 'Searching', labelAr: 'يبحث', tone: 'var(--ds-ocean-400)' },
  { id: 'comparing', label: 'Comparing', labelAr: 'يقارن', tone: 'var(--ds-tide-400)' },
  { id: 'booking', label: 'Booking', labelAr: 'يحجز', tone: 'var(--ds-ocean-700)' },
  { id: 'confirmation', label: 'Confirmation', labelAr: 'تأكيد', tone: 'var(--ds-success-500)' },
]

function iconFor(state: RahhalAiState): ReactNode {
  switch (state) {
    case 'thinking':
    case 'reasoning':
      return <IconSpark size={16} />
    case 'memory':
      return <IconCompass size={16} />
    case 'recommendations':
      return <IconPackage size={16} />
    case 'searching':
      return <IconSearch size={16} />
    case 'comparing':
      return <IconPlane size={16} />
    case 'booking':
      return <IconWallet size={16} />
    case 'confirmation':
      return <IconCheck size={16} />
  }
}

export function RahhalAiStateChip({
  state,
  bilingual = true,
}: {
  state: RahhalAiState
  bilingual?: boolean
}) {
  const meta = RAHHAL_AI_STATES.find((s) => s.id === state)!
  return (
    <span
      className="rh-glass-signature rh-ai-aura"
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 'var(--ds-radius-full)',
        color: meta.tone,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: meta.tone,
          animation: 'rh-ai-pulse 1.6s var(--ds-ease-breathe) infinite',
        }}
      />
      {iconFor(state)}
      <DsText variant="caption" style={{ color: 'inherit', fontWeight: 700 }}>
        {meta.label}
        {bilingual ? ` · ${meta.labelAr}` : ''}
      </DsText>
    </span>
  )
}

export function RahhalAiPersonalityRow() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {RAHHAL_AI_STATES.map((s) => (
        <RahhalAiStateChip key={s.id} state={s.id} />
      ))}
    </div>
  )
}
