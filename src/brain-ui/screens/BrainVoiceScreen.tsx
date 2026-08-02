import { RahhalOrb } from '../../design-system/brand/RahhalOrb'
import { DsButton, DsText } from '../../design-system/components/primitives'
import { DsAiBubble } from '../../design-system/components/travel'
import { ScreenFrame } from '../../design-system/screens/ScreenFrame'
import { useTravelBrain } from '../useTravelBrain'
import { BrainLoadingExperience } from '../components/BrainLoadingExperience'
import { BrainErrorBanner } from '../components/BrainErrorBanner'

export function BrainVoiceScreen({ onSwitchToChat }: { onSwitchToChat?: () => void }) {
  const { state, startVoice, stopVoice } = useTravelBrain()
  const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant')
  const lastUser = [...state.messages].reverse().find((m) => m.role === 'user')

  const orbState = state.voiceListening
    ? 'listening'
    : state.thinking
      ? 'thinking'
      : state.loading
        ? 'speaking'
        : state.error
          ? 'error'
          : 'idle'

  return (
    <ScreenFrame pad={false}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          gap: 22,
          padding: '48px 24px',
          background:
            'radial-gradient(80% 60% at 50% 40%, rgba(42,157,143,0.14), transparent), var(--ds-brand-wash)',
        }}
      >
        <DsText variant="caption" tone="primary" style={{ letterSpacing: '0.12em' }}>
          {state.voiceListening ? 'LISTENING' : state.loading ? 'THINKING' : 'VOICE · MOCK'}
        </DsText>
        <DsText as="h1" variant="display" style={{ maxWidth: 300 }}>
          {lastUser?.text ? `“${lastUser.text.slice(0, 64)}…”` : '“A calm week in Istanbul…”'}
        </DsText>
        <RahhalOrb
          interactive
          size={128}
          state={orbState}
          label={state.voiceListening ? 'Stop listening' : 'Start voice'}
          onClick={() => {
            if (state.voiceListening) stopVoice()
            else void startVoice()
          }}
        />
        <DsText variant="callout" tone="secondary" style={{ maxWidth: 280 }}>
          Mock transcription → TravelBrain → answer. No STT, no TTS, no APIs.
        </DsText>
        {state.loading ? <BrainLoadingExperience phase={state.loadingPhase} locale={state.locale} /> : null}
        <BrainErrorBanner error={state.error} />
        {lastAssistant?.text ? (
          <div style={{ width: '100%', maxWidth: 340, textAlign: 'start' }}>
            <DsAiBubble meta="Rahhal">{lastAssistant.text}</DsAiBubble>
          </div>
        ) : null}
        <DsButton variant="ghost" onClick={onSwitchToChat}>
          Switch to text
        </DsButton>
      </div>
    </ScreenFrame>
  )
}
