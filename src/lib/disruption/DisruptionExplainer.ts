/**
 * Sprint 37 — natural-language explanations for disruption recovery.
 */

import type {
  DetectedDisruption,
  DisruptionHandlingResult,
  PassengerImpact,
  RankedRecoveryPlan,
  TripUpdateResult,
} from './types'

export class DisruptionExplainer {
  explain(input: {
    disruption: DetectedDisruption
    impact: PassengerImpact
    selectedPlan: RankedRecoveryPlan | null
    tripUpdate: TripUpdateResult | null
    locale?: 'ar' | 'en'
  }): string {
    const locale = input.locale === 'ar' ? 'ar' : 'en'
    const delayHours = Math.round((input.disruption.delayMinutes / 60) * 10) / 10
    const cost = input.selectedPlan?.totalExtraCost ?? 0
    const currency = input.selectedPlan?.currency ?? 'SAR'

    if (locale === 'ar') {
      return [
        input.disruption.summary,
        input.tripUpdate?.hotelDatesMoved ? 'تم تحديث تسجيل الوصول للفندق.' : null,
        input.tripUpdate?.transportationUpdated ? 'تم حجز نقل مطار جديد.' : null,
        input.tripUpdate?.activitiesMoved ? 'تم تأجيل الأنشطة لليوم التالي.' : null,
        `التكلفة الإضافية المقدّرة: ${currency} ${cost}.`,
      ]
        .filter(Boolean)
        .join('\n')
    }

    const lines: string[] = []
    if (input.disruption.eventType === 'flight_delayed') {
      lines.push(`Your flight was delayed by ${delayHours} hours.`)
    } else {
      lines.push(`${input.disruption.summary}.`)
    }

    if (input.tripUpdate?.hotelDatesMoved) {
      lines.push(
        input.tripUpdate.newCheckInDate
          ? `Your hotel check-in has been updated to ${input.tripUpdate.newCheckInDate}.`
          : 'Your hotel check-in has been updated.',
      )
    }
    if (input.tripUpdate?.transportationUpdated) {
      lines.push('A new airport transfer has been reserved.')
    }
    if (input.tripUpdate?.activitiesMoved) {
      lines.push('Your activities were shifted to tomorrow.')
    }
    if (input.selectedPlan) {
      lines.push(`Selected recovery: ${input.selectedPlan.title}.`)
    }
    lines.push(`Estimated additional cost: ${currency} ${cost}.`)
    if (input.selectedPlan) {
      lines.push(
        `Confidence ${(input.selectedPlan.confidenceScore * 100).toFixed(0)}% · residual delay ~${input.selectedPlan.estimatedDelayMinutes} min.`,
      )
    }
    return lines.join('\n')
  }

  explainResult(result: DisruptionHandlingResult, locale: 'ar' | 'en' = 'en'): string {
    return this.explain({
      disruption: result.disruption,
      impact: result.impact,
      selectedPlan: result.selectedPlan,
      tripUpdate: result.tripUpdate,
      locale,
    })
  }
}

export function createDisruptionExplainer(): DisruptionExplainer {
  return new DisruptionExplainer()
}
