import { useState } from 'react'
import { IconSpark } from '../../design-system/icons/OutlinedIcons'
import { RahhalOrb } from '../../design-system/brand/RahhalOrb'
import { DsAvatar, DsChip, DsText } from '../../design-system/components/primitives'
import { DsAiBubble, DsSuggestionCard, DsUserBubble } from '../../design-system/components/travel'
import { DsStreamingLine, DsTypingIndicator } from '../../design-system/components/premium'
import { ScreenFrame } from '../../design-system/screens/ScreenFrame'
import {
  DecisionTimelineBoard,
  ExplainedRecommendationCards,
  FollowUpChips,
  LuxuryEmptyState,
  MemoryRibbon,
} from '../../concierge'
import { useTravelBrain } from '../useTravelBrain'
import { BrainLoadingExperience } from '../components/BrainLoadingExperience'
import { BrainErrorBanner } from '../components/BrainErrorBanner'
import { ConversationTimeline } from '../components/ConversationTimeline'
import { MemoryDebugPanel } from '../components/MemoryDebugPanel'
import { BrainComposer } from '../components/BrainComposer'

export function BrainChatScreen() {
  const { state, sendMessage, startVoice, resetConversation, restoreDecision } = useTravelBrain()
  const [draft, setDraft] = useState('')
  const concierge = state.concierge

  const onSend = async () => {
    const text = draft
    setDraft('')
    await sendMessage(text)
  }

  return (
    <ScreenFrame
      pad={false}
      footer={
        <div
          className="ds-glass"
          style={{
            padding: '12px 16px calc(16px + var(--ds-safe-bottom))',
            borderTop: 'var(--ds-border-width) solid var(--ds-border)',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8, overflow: 'auto' }}>
            <DsChip
              active
              onClick={() =>
                void sendMessage('Book a flight from Riyadh to Istanbul budget 5000 SAR')
              }
            >
              Flexible dates
            </DsChip>
            <DsChip onClick={() => void sendMessage('Recommend a quiet hotel in Dubai')}>
              Quiet hotel
            </DsChip>
            <DsChip onClick={() => void resetConversation()}>Reset</DsChip>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <BrainComposer
                value={draft}
                placeholder="Tell Rahhal what you need…"
                onChange={setDraft}
                onSubmit={() => void onSend()}
                disabled={state.loading}
              />
            </div>
            <RahhalOrb
              interactive
              size={56}
              state={state.voiceListening ? 'listening' : state.thinking ? 'thinking' : 'idle'}
              label="Voice to brain"
              onClick={() => void startVoice()}
            />
            <button
              type="button"
              aria-label="Send message"
              onClick={() => void onSend()}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'var(--ds-border-width) solid var(--ds-border)',
                background: 'var(--ds-surface)',
                color: 'var(--ds-primary)',
                cursor: 'pointer',
              }}
            >
              <IconSpark />
            </button>
          </div>
        </div>
      }
    >
      <div
        style={{
          padding: '12px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <DsText as="h1" variant="heading">
            Concierge
          </DsText>
          <DsText variant="micro" tone="tertiary">
            TravelBrain · luxury memory
          </DsText>
        </div>
        <DsAvatar initials="AI" size={36} alt="Rahhal AI" />
      </div>

      <div className="ds-scroll-fade" style={{ padding: '12px 20px 24px', display: 'grid', gap: 16 }}>
        {state.loading ? <BrainLoadingExperience phase={state.loadingPhase} locale={state.locale} /> : null}
        <BrainErrorBanner error={state.error} />

        {state.messages.length === 0 ? (
          <LuxuryEmptyState
            copy={
              concierge?.emptyInspiration ?? {
                title: 'A quiet room for planning',
                body: 'Tell me what you’re dreaming of — I’ll remember your taste and compose options with care.',
                cta: 'Begin gently',
                illustration: 'horizon',
              }
            }
            onAction={() => void sendMessage('Plan a calm week in Istanbul')}
          />
        ) : null}

        {concierge ? (
          <MemoryRibbon facts={concierge.memoryFacts} narration={concierge.memoryNarration} />
        ) : null}

        {state.messages.map((m) =>
          m.role === 'user' ? (
            <DsUserBubble key={m.id}>{m.text}</DsUserBubble>
          ) : (
            <DsAiBubble key={m.id} meta={m.streaming ? 'Streaming…' : 'Rahhal'}>
              {m.streaming ? <DsStreamingLine text={m.text} /> : m.text}
            </DsAiBubble>
          ),
        )}

        {state.thinking ? <DsTypingIndicator label="Rahhal is thinking" /> : null}

        {concierge ? (
          <>
            <ExplainedRecommendationCards items={concierge.recommendations} />
            <FollowUpChips
              questions={concierge.followUps}
              onAsk={(text) => void sendMessage(text)}
            />
            <DecisionTimelineBoard
              entries={concierge.decisionTimeline}
              onRestore={(id) => restoreDecision(id)}
            />
          </>
        ) : null}

        <ConversationTimeline steps={state.conversationTimeline} />
        <MemoryDebugPanel enabled={state.developerMode} trace={state.lastTrace} />

        <div style={{ display: 'grid', gap: 8 }}>
          <div onClick={() => void sendMessage('Recommend softer evening flight arrivals to Dubai')}>
            <DsSuggestionCard label="Show me softer evening arrivals" />
          </div>
          <div onClick={() => void sendMessage('Compare packages for Istanbul')}>
            <DsSuggestionCard label="Compare two Istanbul packages" />
          </div>
        </div>
      </div>
    </ScreenFrame>
  )
}
