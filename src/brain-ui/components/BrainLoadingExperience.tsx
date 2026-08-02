import { DsText } from '../../design-system/components/primitives'
import { phaseLabel } from '../loadingPhases'
import type { BrainLoadingPhase } from '../types'
import type { LocaleCode } from '../../brain/types'

export function BrainLoadingExperience({
  phase,
  locale,
}: {
  phase: BrainLoadingPhase
  locale: LocaleCode
}) {
  if (phase === 'idle') return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="ds-glass rh-ai-aura"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--ds-radius-full)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--ds-secondary)',
          boxShadow: '0 0 0 4px var(--ds-secondary-soft)',
          animation: 'ds-soft-pulse 1.4s var(--ds-ease-breathe) infinite',
        }}
      />
      <DsText variant="caption" tone="secondary">
        {phaseLabel(phase, locale)}
      </DsText>
    </div>
  )
}
