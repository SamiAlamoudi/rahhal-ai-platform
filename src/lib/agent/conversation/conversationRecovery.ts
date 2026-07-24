/**
 * Phase 3 Stage 2 — Conversation recovery.
 * Resume unfinished planning / pending clarification / previous destination.
 */

import type {
  ConversationTurnEvent,
  MultiTurnConversationSession,
} from './memoryTypes'
import type { ConversationLocale } from './types'

export interface RecoveryPlan {
  recovered: boolean
  mode:
    | 'none'
    | 'continue_previous_trip'
    | 'resume_unfinished_planning'
    | 'return_to_destination'
    | 'resume_pending_clarification'
  preamble: string | null
  activeGoal: string | null
  tripGoal: string | null
}

export function planConversationRecovery(input: {
  session: MultiTurnConversationSession
  event: ConversationTurnEvent
  userText: string
  locale?: ConversationLocale
}): RecoveryPlan {
  const locale =
    input.locale === 'en' ? 'en' : input.session.locale === 'en' ? 'en' : 'ar'
  const session = input.session
  const lower = input.userText.trim().toLowerCase()

  const resumeCue =
    input.event === 'resuming'
    || /^(continue|resume|go on|back to|أكمل|كمل|متابعة)/i.test(input.userText.trim())
    || /\b(continue|resume) (the |my )?(trip|plan)\b/i.test(lower)

  if (session.pendingClarification && (resumeCue || input.event === 'resuming')) {
    return {
      recovered: true,
      mode: 'resume_pending_clarification',
      preamble:
        locale === 'ar'
          ? 'حسناً، نكمل من حيث توقفنا.'
          : 'Sure — picking up where we left off.',
      activeGoal: session.activeGoal ?? 'clarify',
      tripGoal: session.tripGoal,
    }
  }

  if (resumeCue && session.destinationFacts.destination) {
    return {
      recovered: true,
      mode: 'return_to_destination',
      preamble:
        locale === 'ar'
          ? `نعود إلى ${session.destinationFacts.destination}.`
          : `Returning to ${session.destinationFacts.destination}.`,
      activeGoal: session.activeGoal ?? 'trip_planning',
      tripGoal:
        session.tripGoal
        ?? `trip:${session.destinationFacts.destination}`,
    }
  }

  if (
    resumeCue
    && (session.missingInformation.length > 0 || session.turnNumber > 0)
  ) {
    return {
      recovered: true,
      mode: 'resume_unfinished_planning',
      preamble:
        locale === 'ar'
          ? 'نكمل تخطيط الرحلة من النقطة الحالية.'
          : 'Continuing trip planning from where we are.',
      activeGoal: session.activeGoal ?? 'trip_planning',
      tripGoal: session.tripGoal,
    }
  }

  if (resumeCue && session.tripGoal) {
    return {
      recovered: true,
      mode: 'continue_previous_trip',
      preamble:
        locale === 'ar'
          ? 'نواصل رحلتك السابقة.'
          : 'Continuing your previous trip discussion.',
      activeGoal: session.activeGoal,
      tripGoal: session.tripGoal,
    }
  }

  return {
    recovered: false,
    mode: 'none',
    preamble: null,
    activeGoal: session.activeGoal,
    tripGoal: session.tripGoal,
  }
}

export function applyRecoveryToSession(
  session: MultiTurnConversationSession,
  recovery: RecoveryPlan,
): MultiTurnConversationSession {
  if (!recovery.recovered) return session
  return {
    ...session,
    activeGoal: recovery.activeGoal ?? session.activeGoal,
    tripGoal: recovery.tripGoal ?? session.tripGoal,
  }
}

export function withRecoveryPreamble(
  reply: string,
  recovery: RecoveryPlan,
): string {
  if (!recovery.preamble) return reply
  if (!reply.trim()) return recovery.preamble
  if (reply.startsWith(recovery.preamble)) return reply
  return `${recovery.preamble}\n\n${reply}`
}

export const ConversationRecovery = {
  plan: planConversationRecovery,
  apply: applyRecoveryToSession,
  withPreamble: withRecoveryPreamble,
}
