/**
 * Premium Travel Concierge dashboard — mock intelligence only.
 */

import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import {
  DecisionTimelineBoard,
  ExplainedRecommendationCards,
  LuxuryEmptyState,
  MemoryRibbon,
  TravelDashboardPanel,
  TravelDnaPanel,
  TripIntelGrid,
  luxuryEmptyFor,
} from '../concierge'
import { DsButton, DsText } from '../design-system/components/primitives'
import { useNavigate } from 'react-router-dom'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function ConciergePage() {
  const { state, sendMessage, restoreDecision } = useTravelBrain()
  const navigate = useNavigate()
  const c = state.concierge
  const locale = state.locale === 'ar' ? 'ar' : 'en'

  return (
    <ProductAppChrome title="كونسيرج">
      <div style={{ display: 'grid', gap: 20 }}>
        <div>
          <DsText as="h1" variant="display">
            Travel Concierge
          </DsText>
          <DsText variant="callout" tone="secondary">
            Memory · explainability · trip intelligence · readiness — mock only.
          </DsText>
        </div>

        {!c ? (
          <LuxuryEmptyState
            copy={luxuryEmptyFor('dashboard', locale)}
            onAction={() => {
              void sendMessage('Book a flight from Riyadh to Istanbul budget 5000 SAR')
              navigate('/chat')
            }}
          />
        ) : (
          <>
            <TravelDashboardPanel model={c.dashboard} />
            <MemoryRibbon facts={c.memoryFacts} narration={c.memoryNarration} />
            <TravelDnaPanel dna={c.dna} />
            <TripIntelGrid sections={c.tripIntel} />
            <ExplainedRecommendationCards items={c.recommendations} />
            <DecisionTimelineBoard
              entries={c.decisionTimeline}
              onRestore={(id) => restoreDecision(id)}
            />
            <DsButton
              variant="soft"
              onClick={() => {
                void sendMessage('Add a quiet boutique hotel matching my luxury stays')
                navigate('/chat')
              }}
            >
              Continue with the concierge
            </DsButton>
          </>
        )}
      </div>
    </ProductAppChrome>
  )
}
