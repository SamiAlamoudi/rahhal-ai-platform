import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { ConversationTimeline } from '../brain-ui/components/ConversationTimeline'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import {
  DecisionTimelineBoard,
  LuxuryEmptyState,
  luxuryEmptyFor,
} from '../concierge'
import { DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function TimelinePage() {
  const { state, getTimeline, sendMessage, restoreDecision } = useTravelBrain()
  const navigate = useNavigate()
  const items = getTimeline()
  const decisions = state.concierge?.decisionTimeline ?? []
  const locale = state.locale === 'ar' ? 'ar' : 'en'

  return (
    <ProductAppChrome title="الجدول">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          جدول الرحلة
        </DsText>
        <DsText variant="callout" tone="secondary">
          قرارات المحادثة للمراجعة والاستعادة والمقارنة — مع جدول الأيام.
        </DsText>
        {items.length === 0 && decisions.length === 0 ? (
          <LuxuryEmptyState
            copy={luxuryEmptyFor('timeline', locale)}
            onAction={() => {
              void sendMessage('Book a flight from Riyadh to Istanbul for 4 nights')
              navigate('/chat')
            }}
          />
        ) : (
          <>
            <DecisionTimelineBoard
              entries={decisions}
              onRestore={(id) => restoreDecision(id)}
            />
            <div className="rh-timeline-signature">
              {items.map((item, idx) => (
                <div key={`${item.day}-${idx}`} className="rh-timeline-signature__stop">
                  <DsText variant="heading">{item.dateLabel}</DsText>
                  <DsText variant="caption" tone="secondary">
                    {item.title}
                  </DsText>
                </div>
              ))}
            </div>
          </>
        )}
        <ConversationTimeline steps={state.conversationTimeline} />
      </div>
    </ProductAppChrome>
  )
}
