import type { BrainTurnTrace } from '../brain'
import type { BrainUiError } from './types'

export function mapTraceToError(trace: BrainTurnTrace): BrainUiError | null {
  const { safety, draft, decision } = trace

  if (safety.code === 'contradictory_request') {
    return {
      code: 'budget_conflict',
      message: safety.message,
      missingFields: safety.missingFields,
    }
  }

  if (safety.code === 'impossible_itinerary') {
    return {
      code: 'impossible_itinerary',
      message: safety.message,
    }
  }

  if (safety.code === 'missing_information') {
    return {
      code: 'missing_information',
      message: safety.message,
      missingFields: safety.missingFields,
    }
  }

  if (safety.code === 'ambiguous_request') {
    return {
      code: 'ambiguous_request',
      message: safety.message,
    }
  }

  if (
    draft.destination &&
    !['istanbul', 'dubai', 'cairo', 'london', 'riyadh', 'jeddah', 'doha'].includes(
      draft.destination.toLowerCase(),
    ) &&
    decision.action !== 'route_tool'
  ) {
    return {
      code: 'unknown_destination',
      message:
        trace.intent.locale === 'ar'
          ? 'هذه الوجهة غير موجودة في المعرفة التجريبية بعد — جرّب دبي أو إسطنبول.'
          : 'That destination is not in the mock knowledge yet — try Dubai or Istanbul.',
    }
  }

  if (safety.status !== 'ok' && decision.action !== 'route_tool') {
    return {
      code: safety.code ?? 'unknown',
      message: safety.message,
      missingFields: safety.missingFields,
    }
  }

  return null
}
