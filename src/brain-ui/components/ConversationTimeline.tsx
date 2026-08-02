import { DsText } from '../../design-system/components/primitives'
import type { ConversationTimelineStep } from '../types'

const LABELS: Record<ConversationTimelineStep['kind'], string> = {
  user_ask: 'User asks',
  brain_reasoning: 'Brain reasoning',
  decision: 'Decision',
  recommendation: 'Recommendation',
  summary: 'Summary',
}

export function ConversationTimeline({ steps }: { steps: ConversationTimelineStep[] }) {
  if (steps.length === 0) return null
  return (
    <div className="rh-timeline-signature" style={{ display: 'grid', gap: 4 }}>
      <DsText variant="micro" tone="tertiary" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Conversation timeline
      </DsText>
      {steps.map((step) => (
        <div key={step.id} className="rh-timeline-signature__stop" style={{ display: 'grid', gap: 2 }}>
          <DsText variant="micro" tone="primary">
            {LABELS[step.kind]}
          </DsText>
          <DsText variant="caption" tone="secondary">
            {step.text}
          </DsText>
        </div>
      ))}
    </div>
  )
}
