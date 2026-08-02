import { DsButton, DsText } from '../../design-system/components/primitives'
import { RahhalIllustration } from '../../design-system/brand/Illustrations'
import type { LuxuryEmptyCopy } from '../empty/LuxuryEmptyStates'

export function LuxuryEmptyState({
  copy,
  onAction,
}: {
  copy: LuxuryEmptyCopy
  onAction?: () => void
}) {
  return (
    <section
      className="rh-atmosphere"
      style={{
        padding: 28,
        borderRadius: 'var(--ds-radius-2xl)',
        display: 'grid',
        gap: 14,
        justifyItems: 'center',
        textAlign: 'center',
        background: 'var(--rh-gradient-pearl)',
        boxShadow: 'var(--rh-shadow-float)',
      }}
    >
      <RahhalIllustration kind={copy.illustration} size={120} title={copy.title} />
      <DsText as="h2" variant="display">
        {copy.title}
      </DsText>
      <DsText variant="callout" tone="secondary" style={{ maxWidth: 360 }}>
        {copy.body}
      </DsText>
      {onAction ? (
        <DsButton onClick={onAction}>{copy.cta}</DsButton>
      ) : (
        <DsText variant="micro" tone="primary">
          {copy.cta}
        </DsText>
      )}
    </section>
  )
}
