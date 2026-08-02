/**
 * Production Search — requests go to TravelBrain (mock), not legacy travelSession spine.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { BrainComposer } from '../brain-ui/components/BrainComposer'
import { RecommendationDeck } from '../brain-ui/components/RecommendationDeck'
import { BrainLoadingExperience } from '../brain-ui/components/BrainLoadingExperience'
import { BrainErrorBanner } from '../brain-ui/components/BrainErrorBanner'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { DsButton, DsChip, DsText } from '../design-system/components/primitives'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function SearchWorkspace() {
  const { state, sendMessage } = useTravelBrain()
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  const run = async (text: string) => {
    const prompt = text.trim()
    if (!prompt) return
    await sendMessage(prompt.startsWith('Search') || /بحث|احجز|book|flight|hotel/i.test(prompt)
      ? prompt
      : `Search travel options: ${prompt}`)
  }

  return (
    <ProductAppChrome title="البحث">
      <div style={{ display: 'grid', gap: 16 }}>
        <DsText as="h1" variant="display">
          بحث رحّال
        </DsText>
        <DsText variant="callout" tone="secondary">
          طلبات البحث تُمرَّر إلى TravelBrain.processTurn — بدون Amadeus/Booking.
        </DsText>
        <BrainComposer
          value={q}
          placeholder="مثلاً: طيران من الرياض إلى دبي…"
          onChange={setQ}
          onSubmit={() => {
            const text = q
            setQ('')
            void run(text)
          }}
          disabled={state.loading}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <DsChip
            onClick={() => void run('Book a flight from Riyadh to Dubai budget 2500 SAR')}
          >
            الرياض → دبي
          </DsChip>
          <DsChip
            onClick={() => void run('Book a hotel in Istanbul 4 nights budget 4000 SAR')}
          >
            فندق إسطنبول
          </DsChip>
          <DsChip onClick={() => void run('Recommend a package to Istanbul')}>باقة</DsChip>
        </div>
        {state.loading ? (
          <BrainLoadingExperience phase={state.loadingPhase} locale={state.locale} />
        ) : null}
        <BrainErrorBanner error={state.error} />
        <RecommendationDeck recommendations={state.recommendations} timeline={state.timeline} />
        <DsButton variant="ghost" onClick={() => navigate('/chat')}>
          فتح المحادثة
        </DsButton>
      </div>
    </ProductAppChrome>
  )
}
