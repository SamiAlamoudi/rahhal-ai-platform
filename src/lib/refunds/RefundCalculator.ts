/**
 * Sprint 36 — RefundCalculator
 * Deterministic refund math from normalized policies + booked lines.
 */

import { filterLinesByScope } from './CancellationValidator'
import { RefundTimelineEstimator } from './RefundTimelineEstimator'
import type {
  BookedServiceLine,
  NormalizedRefundPolicy,
  PolicyQuoteInput,
  RefundBreakdown,
  RefundLineBreakdown,
} from './types'

export class RefundCalculator {
  private readonly timeline = new RefundTimelineEstimator()

  calculate(
    input: PolicyQuoteInput,
    policies: NormalizedRefundPolicy[],
  ): RefundBreakdown {
    const scoped = filterLinesByScope(input.lines, input.scope)
    const platformFeePaid = round2(Math.max(0, input.platformFee ?? 0))
    const currency = input.currency
    const lines: RefundLineBreakdown[] = []

    for (const line of scoped) {
      const policy =
        policies.find(
          (p) =>
            p.serviceKind === line.serviceKind && p.providerId === line.providerId,
        )
        ?? policies.find((p) => p.serviceKind === line.serviceKind)

      if (!policy) continue
      lines.push(this.calculateLine(line, policy, input))
    }

    const totalPaidServices = round2(scoped.reduce((s, l) => s + l.amountPaid, 0))
    const totalRefundServices = round2(lines.reduce((s, l) => s + l.refundAmount, 0))
    const totalPenalties = round2(lines.reduce((s, l) => s + l.penaltyAmount, 0))

    // Platform fee is non-refundable by default.
    const platformFeeRefunded = 0
    const totalPaid = round2(totalPaidServices + platformFeePaid)
    const totalRefund = round2(totalRefundServices + platformFeeRefunded)
    const window = this.timeline.estimate(
      policies.filter((p) => scoped.some((l) => l.serviceKind === p.serviceKind)),
    )

    const explanation = [
      ...lines.flatMap((l) => [
        `${l.title}: paid ${fmt(l.amountPaid, currency)}, refund ${fmt(l.refundAmount, currency)}` +
          (l.penaltyAmount > 0 ? ` (penalty ${fmt(l.penaltyAmount, currency)})` : ''),
      ]),
      `Platform fee: paid ${fmt(platformFeePaid, currency)}, refund ${fmt(platformFeeRefunded, currency)}`,
      `Total refund: ${fmt(totalRefund, currency)}`,
      `Expected arrival: ${window.label}`,
    ]

    return {
      currency,
      lines,
      platformFeePaid,
      platformFeeRefunded,
      totalPaid,
      totalRefund,
      totalPenalties,
      expectedArrivalBusinessDaysMin: window.minDays,
      expectedArrivalBusinessDaysMax: window.maxDays,
      explanation,
    }
  }

  private calculateLine(
    line: BookedServiceLine,
    policy: NormalizedRefundPolicy,
    input: PolicyQuoteInput,
  ): RefundLineBreakdown {
    const notes: string[] = [...policy.specialConditions]

    // Airline / provider initiated → full refund of paid amount (taxes included).
    if (
      input.airlineCancelled
      || input.reason === 'airline_initiated'
      || (input.reason === 'provider_cancellation' && policy.attributes.airlineInitiatedFullRefund)
      || (input.reason === 'weather' && policy.attributes.weatherCancellationFullRefund)
      || input.reason === 'event_cancellation'
    ) {
      return {
        lineId: line.lineId,
        serviceKind: line.serviceKind,
        title: line.title,
        amountPaid: line.amountPaid,
        refundAmount: round2(line.amountPaid),
        penaltyAmount: 0,
        taxesRefundable: policy.taxesRefundable,
        taxesNonRefundable: 0,
        providerFeeKept: 0,
        platformFeeKept: 0,
        refundPercent: 100,
        notes: [...notes, 'Full refund due to provider/airline/weather/event cancellation'],
      }
    }

    let refundPercent = clamp(policy.refundPercent, 0, 100)
    let penalty = Math.max(0, policy.penaltyAmount)

    // Deadline passed → apply late / non-refundable treatment.
    const asOf = Date.parse(input.asOf ?? new Date().toISOString())
    if (
      policy.cancellationDeadline
      && Date.parse(policy.cancellationDeadline) < asOf
    ) {
      if (policy.attributes.lateCancellationPenalty || policy.attributes.firstNightPenalty) {
        refundPercent = Math.min(refundPercent, policy.attributes.firstNightPenalty ? 0 : 50)
        if (policy.attributes.firstNightPenalty && line.serviceKind === 'hotel') {
          const nightly = Number(line.metadata?.nightly ?? line.amountPaid * 0.35)
          penalty = Math.max(penalty, round2(nightly))
          notes.push('First-night penalty applied (deadline passed)')
        } else {
          notes.push('Late cancellation penalty applied')
        }
      } else if (!policy.refundable) {
        refundPercent = 0
        notes.push('Past cancellation deadline — non-refundable')
      }
    }

    // No-show
    if (input.reason === 'no_show' || policy.attributes.noShowPenalty) {
      if (input.reason === 'no_show') {
        refundPercent = 0
        penalty = Math.max(penalty, line.amountPaid)
        notes.push('No-show — fare/rate forfeited')
      }
    }

    // After check-in / early departure (hotel)
    if (
      (input.checkedIn || input.reason === 'early_departure' || input.reason === 'after_check_in')
      && line.serviceKind === 'hotel'
    ) {
      const remainingRatio = Number(line.metadata?.remainingStayRatio ?? 0.5)
      refundPercent = Math.min(refundPercent, round2(remainingRatio * 100))
      notes.push('Early departure / after check-in — unused nights only')
    }

    // Partial passenger cancel on flight
    if (input.scope === 'one_passenger' && line.serviceKind === 'flight') {
      const total = Math.max(1, input.passengersTotal ?? line.quantity)
      const cancelling = Math.min(total, Math.max(1, input.passengersCancelling ?? 1))
      const share = cancelling / total
      const base = round2(line.amountPaid * share)
      const refundAmount = round2(Math.max(0, base * (refundPercent / 100) - penalty * share))
      return {
        lineId: line.lineId,
        serviceKind: line.serviceKind,
        title: `${line.title} (${cancelling}/${total} travelers)`,
        amountPaid: base,
        refundAmount,
        penaltyAmount: round2(penalty * share),
        taxesRefundable: round2(policy.taxesRefundable * share),
        taxesNonRefundable: round2(policy.taxesNonRefundable * share),
        providerFeeKept: round2(policy.providerFee * share),
        platformFeeKept: 0,
        refundPercent,
        notes: [...notes, 'Per-passenger cancellation share applied'],
      }
    }

    // One room cancel
    if (input.scope === 'one_room' && line.serviceKind === 'hotel') {
      const total = Math.max(1, input.roomsTotal ?? line.quantity)
      const cancelling = Math.min(total, Math.max(1, input.roomsCancelling ?? 1))
      const share = cancelling / total
      const base = round2(line.amountPaid * share)
      const refundAmount = round2(Math.max(0, base * (refundPercent / 100) - penalty * share))
      return {
        lineId: line.lineId,
        serviceKind: line.serviceKind,
        title: `${line.title} (${cancelling}/${total} rooms)`,
        amountPaid: base,
        refundAmount,
        penaltyAmount: round2(penalty * share),
        taxesRefundable: round2(policy.taxesRefundable * share),
        taxesNonRefundable: round2(policy.taxesNonRefundable * share),
        providerFeeKept: round2(policy.providerFee * share),
        platformFeeKept: 0,
        refundPercent,
        notes: [...notes, 'Per-room cancellation share applied'],
      }
    }

    // Return flight only — assume half of flight amount when not specified.
    let amountPaid = line.amountPaid
    if (input.scope === 'return_flight_only' && line.serviceKind === 'flight') {
      amountPaid = round2(line.amountPaid * Number(line.metadata?.returnShare ?? 0.5))
      notes.push('Return segment only')
    }

    const taxesKept = Math.max(0, policy.taxesNonRefundable)
    const providerKept = Math.max(0, policy.providerFee)
    let refundAmount: number

    // Airline-style partial refund: paid − fixed penalty (when penalty is the fare rule).
    if (
      line.serviceKind === 'flight'
      && penalty > 0
      && refundPercent > 0
      && policy.refundability === 'partially_refundable'
    ) {
      refundAmount = round2(Math.max(0, amountPaid - penalty))
      notes.push(`Airline penalty ${fmt(penalty, line.currency)} deducted from fare`)
    } else {
      const gross = round2(amountPaid * (refundPercent / 100))
      refundAmount = round2(Math.max(0, gross - penalty))
    }

    if (refundPercent > 0 && refundPercent < 100) {
      if (taxesKept > 0) notes.push(`Non-refundable taxes ${fmt(taxesKept, line.currency)}`)
      if (providerKept > 0) notes.push(`Provider fee retained ${fmt(providerKept, line.currency)}`)
    }

    if (refundPercent === 0) {
      refundAmount = 0
      // Airport taxes sometimes refundable even on non-refundable fares.
      if (policy.taxesRefundable > 0 && line.serviceKind === 'flight') {
        refundAmount = round2(policy.taxesRefundable)
        notes.push('Non-refundable fare — airport taxes may still be returned')
      }
    }

    // Car deposit / insurance
    if (line.serviceKind === 'car_rental') {
      if (policy.attributes.depositRefundable && Number(line.metadata?.deposit ?? 0) > 0) {
        notes.push('Deposit is refundable subject to inspection')
      }
      if (!policy.attributes.insuranceRefundable && Number(line.metadata?.insurance ?? 0) > 0) {
        const insurance = Number(line.metadata?.insurance ?? 0)
        refundAmount = round2(Math.max(0, refundAmount - insurance))
        notes.push('Insurance premium non-refundable')
      }
      if (policy.attributes.oneWayFeeNonRefundable && Number(line.metadata?.oneWayFee ?? 0) > 0) {
        const fee = Number(line.metadata?.oneWayFee ?? 0)
        refundAmount = round2(Math.max(0, refundAmount - fee))
        notes.push('One-way fee non-refundable')
      }
    }

    return {
      lineId: line.lineId,
      serviceKind: line.serviceKind,
      title: line.title,
      amountPaid,
      refundAmount,
      penaltyAmount: round2(penalty),
      taxesRefundable: policy.taxesRefundable,
      taxesNonRefundable: policy.taxesNonRefundable,
      providerFeeKept: policy.providerFee,
      platformFeeKept: 0,
      refundPercent,
      notes,
    }
  }
}

export function createRefundCalculator(): RefundCalculator {
  return new RefundCalculator()
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`
}
