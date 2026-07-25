import type { MemoryCenterLocale, MemoryTimelineItem } from '../types'

export interface MemoryTimelinePanelProps {
  timeline: MemoryTimelineItem[]
  locale: MemoryCenterLocale
}

export function MemoryTimelinePanel({
  timeline,
  locale,
}: MemoryTimelinePanelProps) {
  return (
    <section className="rahhal-mc-panel" data-testid="mc-memory-timeline">
      <h2>{locale === 'en' ? 'Memory timeline' : 'الجدول الزمني للذاكرة'}</h2>
      <ul className="rahhal-mc-timeline">
        {timeline.map((item) => (
          <li key={item.id} data-testid="mc-timeline-item">
            <em style={{ color: 'var(--rahhal-mc-accent)', fontStyle: 'normal' }}>
              {item.whenLabel}
            </em>
            <strong>{item.title}</strong>
            <span className="rahhal-mc-muted">
              {item.category} · {item.confidence}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
