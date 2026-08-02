import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { BrainErrorBanner } from '../brain-ui/components/BrainErrorBanner'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import {
  ExplainedRecommendationCards,
  LuxuryEmptyState,
  luxuryEmptyFor,
} from '../concierge'
import { DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function RecommendationsPage() {
  const { state, sendMessage } = useTravelBrain()
  const navigate = useNavigate()
  const explained = state.concierge?.recommendations ?? []
  const locale = state.locale === 'ar' ? 'ar' : 'en'

  return (
    <ProductAppChrome title="التوصيات">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          توصيات رحّال
        </DsText>
        <DsText variant="callout" tone="secondary">
          كل توصية مع السبب والثقة والبدائل — بدون مزوّدين خارجيين.
        </DsText>
        <BrainErrorBanner error={state.error} />
        {explained.length === 0 ? (
          <LuxuryEmptyState
            copy={luxuryEmptyFor('recommendations', locale)}
            onAction={() => {
              void sendMessage('Recommend a package to Istanbul budget 5000 SAR')
              navigate('/chat')
            }}
          />
        ) : (
          <ExplainedRecommendationCards items={explained} />
        )}
      </div>
    </ProductAppChrome>
  )
}
