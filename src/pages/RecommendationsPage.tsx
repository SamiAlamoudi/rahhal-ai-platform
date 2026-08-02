import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { RecommendationDeck } from '../brain-ui/components/RecommendationDeck'
import { BrainErrorBanner } from '../brain-ui/components/BrainErrorBanner'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { DsButton, DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function RecommendationsPage() {
  const { state, getRecommendations, sendMessage } = useTravelBrain()
  const navigate = useNavigate()
  const recs = state.recommendations ?? getRecommendations()

  return (
    <ProductAppChrome title="التوصيات">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          توصيات رحّال
        </DsText>
        <DsText variant="callout" tone="secondary">
          مباشرة من RecommendationEngine عبر TravelBrain — بدون مزوّدين خارجيين.
        </DsText>
        <BrainErrorBanner error={state.error} />
        {!state.recommendations ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <DsText variant="body" tone="secondary">
              ابدأ محادثة لبناء توصيات مخصصة.
            </DsText>
            <DsButton
              onClick={() => {
                void sendMessage('Recommend a package to Istanbul budget 5000 SAR')
                navigate('/chat')
              }}
            >
              اقترح لي الآن
            </DsButton>
          </div>
        ) : (
          <RecommendationDeck recommendations={recs} timeline={state.timeline} />
        )}
      </div>
    </ProductAppChrome>
  )
}
