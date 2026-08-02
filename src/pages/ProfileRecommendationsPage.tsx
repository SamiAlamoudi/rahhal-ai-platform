import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { RecommendationDeck } from '../brain-ui/components/RecommendationDeck'
import { DsText } from '../design-system/components/primitives'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function ProfileRecommendationsPage() {
  const { state } = useTravelBrain()
  const prefs = state.preferences

  return (
    <ProductAppChrome title="توصيات الملف">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          لك شخصياً
        </DsText>
        <DsText variant="callout" tone="secondary">
          تفضيلات PreferenceEngine + توصيات RecommendationEngine.
        </DsText>
        <div className="rh-glass-signature" style={{ padding: 14, display: 'grid', gap: 6 }}>
          <DsText variant="micro" tone="primary">
            PROFILE SIGNALS
          </DsText>
          <DsText variant="caption" tone="secondary">
            أسلوب السفر: {prefs?.travelStyle ?? 'unknown'}
          </DsText>
          <DsText variant="caption" tone="secondary">
            مستوى الميزانية: {prefs?.budgetLevel ?? 'unknown'}
          </DsText>
          <DsText variant="caption" tone="secondary">
            شركات مفضّلة: {(prefs?.favoriteAirlines ?? []).join(', ') || '—'}
          </DsText>
        </div>
        <RecommendationDeck
          recommendations={state.recommendations}
          timeline={state.timeline}
        />
      </div>
    </ProductAppChrome>
  )
}
