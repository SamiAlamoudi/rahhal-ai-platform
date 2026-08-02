import { DsText } from '../../design-system/components/primitives'
import type { ExplainedRecommendation } from '../types'

export function ExplainedRecommendationCards({ items }: { items: ExplainedRecommendation[] }) {
  if (items.length === 0) return null
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <DsText variant="heading">Smart recommendations</DsText>
      {items.map((item) => (
        <article
          key={item.id}
          className="rh-card-recommend"
          style={{ padding: 16, display: 'grid', gap: 10 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <DsText variant="micro" tone="tertiary">
                {item.kind}
              </DsText>
              <DsText variant="heading">{item.title}</DsText>
              <DsText variant="caption" tone="secondary">
                {item.subtitle}
              </DsText>
            </div>
            {item.priceLabel ? (
              <DsText variant="heading" tone="primary">
                {item.priceLabel}
              </DsText>
            ) : null}
          </div>
          <DsText variant="callout">{item.why}</DsText>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {item.badges.map((b) => (
              <span
                key={b}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'var(--ds-secondary-soft)',
                  color: 'var(--ds-secondary)',
                }}
              >
                {b}
              </span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--ds-ink-tertiary)' }}>
              Confidence {(item.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <DsText variant="micro" tone="primary">
                Pros
              </DsText>
              {item.pros.map((p) => (
                <DsText key={p} variant="caption" tone="secondary">
                  · {p}
                </DsText>
              ))}
            </div>
            <div>
              <DsText variant="micro" tone="primary">
                Cons
              </DsText>
              {item.cons.map((c) => (
                <DsText key={c} variant="caption" tone="secondary">
                  · {c}
                </DsText>
              ))}
            </div>
          </div>
          {item.alternatives.length > 0 ? (
            <div>
              <DsText variant="micro" tone="tertiary">
                Alternatives
              </DsText>
              {item.alternatives.map((a) => (
                <DsText key={a.id} variant="caption" tone="secondary">
                  {a.title} — {a.why}
                </DsText>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  )
}
