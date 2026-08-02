import { DsButton, DsText } from '../../design-system/components/primitives'
import type { DecisionTimelineEntry } from '../types'
import { compareDecisions } from '../timeline/DecisionTimeline'
import { useState } from 'react'

export function DecisionTimelineBoard({
  entries,
  onRestore,
}: {
  entries: DecisionTimelineEntry[]
  onRestore?: (id: string) => void
}) {
  const [compareIds, setCompareIds] = useState<string[]>([])

  if (entries.length === 0) return null

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1]!, id]
      return [...prev, id]
    })
  }

  const compared =
    compareIds.length === 2 ? compareDecisions(entries, compareIds[0]!, compareIds[1]!) : null

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <DsText variant="heading">Conversation timeline</DsText>
      <DsText variant="caption" tone="secondary">
        Review · change · restore · compare
      </DsText>
      <div className="rh-timeline-signature">
        {entries.map((e) => (
          <div key={e.id} className="rh-timeline-signature__stop" style={{ display: 'grid', gap: 6 }}>
            <DsText variant="heading">{e.title}</DsText>
            <DsText variant="caption" tone="secondary">
              {e.summary}
            </DsText>
            <DsText variant="micro" tone="tertiary">
              {e.status} · {new Date(e.at).toLocaleString()}
            </DsText>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <DsButton size="sm" variant="soft" onClick={() => onRestore?.(e.id)}>
                Restore
              </DsButton>
              <DsButton size="sm" variant="ghost" onClick={() => toggleCompare(e.id)}>
                {compareIds.includes(e.id) ? 'Selected' : 'Compare'}
              </DsButton>
            </div>
          </div>
        ))}
      </div>
      {compared?.a && compared.b ? (
        <div
          className="rh-float-layer"
          style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <div>
            <DsText variant="micro" tone="primary">
              A
            </DsText>
            <DsText variant="caption">{compared.a.payload.reply}</DsText>
          </div>
          <div>
            <DsText variant="micro" tone="primary">
              B
            </DsText>
            <DsText variant="caption">{compared.b.payload.reply}</DsText>
          </div>
        </div>
      ) : null}
    </section>
  )
}
