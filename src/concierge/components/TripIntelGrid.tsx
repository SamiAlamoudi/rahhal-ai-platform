import { DsText } from '../../design-system/components/primitives'
import type { TripIntelSection } from '../types'

export function TripIntelGrid({ sections }: { sections: TripIntelSection[] }) {
  if (sections.length === 0) return null
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <DsText variant="heading">Trip intelligence</DsText>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        {sections.map((s) => (
          <article
            key={s.id}
            className="rh-surface-signature"
            style={{
              padding: 14,
              display: 'grid',
              gap: 6,
              borderInlineStart:
                s.tone === 'caution'
                  ? '3px solid #c45c4a'
                  : s.tone === 'highlight'
                    ? '3px solid var(--ds-secondary)'
                    : '3px solid transparent',
            }}
          >
            <DsText variant="micro" tone="primary">
              {s.title}
            </DsText>
            <DsText variant="caption" tone="secondary">
              {s.body}
            </DsText>
          </article>
        ))}
      </div>
    </section>
  )
}
