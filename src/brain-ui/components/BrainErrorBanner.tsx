import { DsText } from '../../design-system/components/primitives'
import type { BrainUiError } from '../types'

export function BrainErrorBanner({ error }: { error: BrainUiError | null }) {
  if (!error) return null
  return (
    <div
      role="alert"
      className="rh-surface-signature"
      style={{
        padding: 14,
        borderRadius: 'var(--ds-radius-lg)',
        borderInlineStart: '3px solid var(--ds-danger, #c45c4a)',
        display: 'grid',
        gap: 6,
      }}
    >
      <DsText variant="micro" tone="tertiary" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {error.code.replace(/_/g, ' ')}
      </DsText>
      <DsText variant="callout">{error.message}</DsText>
      {error.missingFields && error.missingFields.length > 0 ? (
        <DsText variant="micro" tone="secondary">
          {error.missingFields.join(' · ')}
        </DsText>
      ) : null}
    </div>
  )
}
