import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { DsButton, DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function ContinueTripPage() {
  const { state } = useTravelBrain()
  const navigate = useNavigate()
  const recent = state.recentConversations[0]
  const draft = state.travelSession?.draft

  return (
    <ProductAppChrome title="متابعة الرحلة">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          متابعة التخطيط
        </DsText>
        <DsText variant="callout" tone="secondary">
          من ذاكرة TravelBrain المشتركة — بلا مخزن محادثة موازٍ.
        </DsText>
        {recent ? (
          <div className="rh-card-recommend" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <DsText variant="heading">{recent.title}</DsText>
            <DsText variant="caption" tone="secondary">
              {recent.preview}
            </DsText>
            {draft?.destination ? (
              <DsText variant="micro" tone="primary">
                الوجهة: {draft.destination}
                {draft.origin ? ` · من ${draft.origin}` : ''}
              </DsText>
            ) : null}
            <DsButton onClick={() => navigate('/chat')}>متابعة المحادثة</DsButton>
          </div>
        ) : (
          <DsButton onClick={() => navigate('/')}>ابدأ من الرئيسية</DsButton>
        )}
      </div>
    </ProductAppChrome>
  )
}
