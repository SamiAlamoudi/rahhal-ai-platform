import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { ConversationTimeline } from '../brain-ui/components/ConversationTimeline'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { DsButton, DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function TimelinePage() {
  const { state, getTimeline, sendMessage } = useTravelBrain()
  const navigate = useNavigate()
  const items = getTimeline()

  return (
    <ProductAppChrome title="الجدول">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          جدول الرحلة
        </DsText>
        <DsText variant="callout" tone="secondary">
          من TravelBrain.timeline — ومحادثة الاستدلال أدناه.
        </DsText>
        {items.length === 0 ? (
          <DsButton
            onClick={() => {
              void sendMessage('Book a flight from Riyadh to Istanbul for 4 nights')
              navigate('/chat')
            }}
          >
            ابدأ لبناء الجدول
          </DsButton>
        ) : (
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
        )}
        <ConversationTimeline steps={state.conversationTimeline} />
      </div>
    </ProductAppChrome>
  )
}
