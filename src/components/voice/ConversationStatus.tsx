import type { VoiceState } from '../../lib/voiceConversation'

const LABELS: Record<VoiceState, string> = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  paused: 'Paused',
  interrupted: 'Interrupted',
  disconnected: 'Disconnected',
  error: 'Error',
}

export interface ConversationStatusProps {
  state: VoiceState
  className?: string
}

export function ConversationStatus({ state, className = '' }: ConversationStatusProps) {
  return (
    <span
      role="status"
      data-testid="voice-conversation-status"
      data-state={state}
      className={`text-xs font-semibold text-slate-700 ${className}`}
    >
      {LABELS[state]}
    </span>
  )
}
