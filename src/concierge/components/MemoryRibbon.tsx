import { DsText } from '../../design-system/components/primitives'
import type { ConciergeMemoryFact } from '../types'

export function MemoryRibbon({
  facts,
  narration,
}: {
  facts: ConciergeMemoryFact[]
  narration: string
}) {
  if (facts.length === 0 && !narration) return null
  return (
    <section
      className="rh-glass-signature"
      style={{ padding: 14, borderRadius: 'var(--ds-radius-xl)', display: 'grid', gap: 10 }}
      aria-label="Conversation memory"
    >
      <DsText variant="micro" tone="primary" style={{ letterSpacing: '0.12em' }}>
        REMEMBERED FOR YOU
      </DsText>
      <DsText variant="callout">{narration}</DsText>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {facts.slice(0, 8).map((f) => (
          <span
            key={f.id}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: 'var(--ds-primary-soft)',
              color: 'var(--ds-primary)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {f.label}: {f.value}
          </span>
        ))}
      </div>
    </section>
  )
}
