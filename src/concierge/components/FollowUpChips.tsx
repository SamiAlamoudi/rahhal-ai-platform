import { DsChip, DsText } from '../../design-system/components/primitives'
import type { FollowUpQuestion } from '../types'

export function FollowUpChips({
  questions,
  onAsk,
}: {
  questions: FollowUpQuestion[]
  onAsk?: (text: string) => void
}) {
  if (questions.length === 0) return null
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <DsText variant="micro" tone="tertiary">
        Smart follow-up
      </DsText>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {questions.map((q) => (
          <DsChip key={q.id} onClick={() => onAsk?.(q.text)}>
            {q.text}
          </DsChip>
        ))}
      </div>
    </section>
  )
}
