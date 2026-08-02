import { DsText } from '../../design-system/components/primitives'
import type { TravelDnaProfile } from '../types'

export function TravelDnaPanel({ dna }: { dna: TravelDnaProfile }) {
  return (
    <section className="rh-surface-signature" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <DsText variant="micro" tone="primary" style={{ letterSpacing: '0.12em' }}>
        TRAVEL DNA
      </DsText>
      <DsText variant="heading">{dna.primary}</DsText>
      <DsText variant="callout" tone="secondary">
        {dna.summary}
      </DsText>
      <div style={{ display: 'grid', gap: 8 }}>
        {dna.traits.slice(0, 6).map((t) => (
          <div key={t.trait} style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <DsText variant="caption">{t.trait}</DsText>
              <DsText variant="micro" tone="tertiary">
                {(t.score * 100).toFixed(0)}%
              </DsText>
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                background: 'var(--ds-primary-soft)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(t.score * 100)}%`,
                  height: '100%',
                  background: 'var(--ds-primary)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
