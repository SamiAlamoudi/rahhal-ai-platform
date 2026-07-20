/**
 * Sprint 36 — CancellationValidator
 */

import type {
  BookedServiceLine,
  CancellationScope,
  NormalizedRefundPolicy,
  PolicyQuoteInput,
} from './types'

export interface ValidationOutcome {
  cancellable: boolean
  messages: string[]
}

export class CancellationValidator {
  validate(input: PolicyQuoteInput, policies: NormalizedRefundPolicy[]): ValidationOutcome {
    const messages: string[] = []

    if (!input.lines.length) {
      return { cancellable: false, messages: ['No bookable services to cancel'] }
    }

    const scoped = filterLinesByScope(input.lines, input.scope)
    if (!scoped.length) {
      return {
        cancellable: false,
        messages: [`Scope ${input.scope} does not match any booked services`],
      }
    }

    if (input.checkedIn && input.scope !== 'hotel_only') {
      messages.push('Cancellation after check-in may forfeit remaining stay value')
    }

    if (input.reason === 'after_check_in' && input.scope === 'hotel_only') {
      messages.push('Early departure / after check-in hotel rules apply')
    }

    const scopedPolicies = policies.filter((_, i) =>
      scoped.some((l) => l.lineId === input.lines[i]?.lineId),
    )

    // Use policies corresponding to scoped lines by service kind
    const relevant = policies.filter((p) =>
      scoped.some((l) => l.serviceKind === p.serviceKind),
    )

    const asOf = Date.parse(input.asOf ?? new Date().toISOString())
    for (const policy of relevant.length ? relevant : scopedPolicies) {
      if (policy.attributes.frameworkOnly) {
        messages.push(`${policy.serviceKind} policy is framework-only (quote informational)`)
      }
      if (
        policy.cancellationDeadline
        && Date.parse(policy.cancellationDeadline) < asOf
        && !input.airlineCancelled
        && policy.refundability !== 'fully_refundable'
      ) {
        messages.push(
          `${policy.serviceKind} free-cancellation deadline has passed (${policy.cancellationDeadline})`,
        )
      }
      if (!policy.refundable && !input.airlineCancelled && !input.flightDelayed) {
        messages.push(`${policy.serviceKind} is non-refundable under current rules`)
      }
    }

    // Airline-initiated / weather / provider cancellation can still proceed.
    const forceAllow =
      input.airlineCancelled
      || input.reason === 'airline_initiated'
      || input.reason === 'weather'
      || input.reason === 'provider_cancellation'
      || input.reason === 'event_cancellation'

    const allNonRefundable =
      relevant.length > 0
      && relevant.every((p) => !p.refundable)
      && !forceAllow

    if (allNonRefundable && input.scope === 'full_booking') {
      return {
        cancellable: false,
        messages: [
          ...messages,
          'All selected services are non-refundable — cancellation not available',
        ],
      }
    }

    // Partial cancel of a non-refundable line alone is blocked unless forced.
    if (scoped.length === 1 && relevant[0] && !relevant[0].refundable && !forceAllow) {
      return {
        cancellable: false,
        messages: [
          ...messages,
          `${scoped[0].title} cannot be cancelled for a refund under current rules`,
        ],
      }
    }

    return {
      cancellable: true,
      messages: messages.length ? messages : ['Cancellation is allowed under current policies'],
    }
  }
}

export function filterLinesByScope(
  lines: BookedServiceLine[],
  scope: CancellationScope,
): BookedServiceLine[] {
  switch (scope) {
    case 'flight_only':
    case 'return_flight_only':
    case 'one_passenger':
      return lines.filter((l) => l.serviceKind === 'flight')
    case 'hotel_only':
    case 'one_room':
      return lines.filter((l) => l.serviceKind === 'hotel')
    case 'car_only':
      return lines.filter((l) => l.serviceKind === 'car_rental')
    case 'activity_only':
      return lines.filter((l) => l.serviceKind === 'activity')
    case 'full_booking':
    default:
      return [...lines]
  }
}

export function createCancellationValidator(): CancellationValidator {
  return new CancellationValidator()
}
