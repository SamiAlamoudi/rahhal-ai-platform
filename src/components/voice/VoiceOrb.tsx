import type { VoiceState } from '../../lib/voiceConversation'

const STATE_RING: Record<VoiceState, string> = {
  idle: 'border-slate-200 bg-slate-50 text-slate-400',
  listening: 'border-rose-300 bg-rose-50 text-rose-500 voice-mic-pulse',
  thinking: 'border-amber-300 bg-amber-50 text-amber-600',
  speaking: 'border-primary-300 bg-primary-50 text-primary-600',
  paused: 'border-slate-300 bg-slate-100 text-slate-500',
  interrupted: 'border-orange-300 bg-orange-50 text-orange-600',
  disconnected: 'border-slate-300 bg-slate-200 text-slate-500',
  error: 'border-rose-400 bg-rose-100 text-rose-600',
}

export interface VoiceOrbProps {
  state: VoiceState
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'data-testid'?: string
}

const SIZE = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
}

const DOT = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
}

/**
 * Presentational voice orb — architecture UI only (not wired into production pages).
 */
export function VoiceOrb({
  state,
  size = 'md',
  className = '',
  'data-testid': testId = 'voice-orb',
}: VoiceOrbProps) {
  return (
    <div
      data-testid={testId}
      data-state={state}
      aria-label={`Voice state: ${state}`}
      className={`relative flex items-center justify-center rounded-full border-2 ${SIZE[size]} ${STATE_RING[state]} ${className}`}
    >
      <span
        className={`block rounded-full bg-current opacity-70 ${DOT[size]} ${
          state === 'listening' || state === 'speaking' ? 'animate-pulse' : ''
        }`}
      />
    </div>
  )
}
