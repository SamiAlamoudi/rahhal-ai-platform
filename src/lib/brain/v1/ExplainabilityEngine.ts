/**
 * Sprint 82 — ExplainabilityEngine (Brain v1).
 * Explains WHY a recommendation was selected vs alternatives.
 */

import type { BrainV1Explanation, BrainV1Offer } from './types'

function fmtDuration(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h} hour${h === 1 ? '' : 's'}`
  return `${m} minutes`
}

export class ExplainabilityEngine {
  explain(ranked: BrainV1Offer[]): BrainV1Explanation | null {
    const top = ranked[0]
    if (!top) return null
    const second = ranked[1] ?? null

    const priceDiff =
      top.price != null && second?.price != null ? top.price - second.price : null
    const durationMinutesDiff =
      top.durationMinutes != null && second?.durationMinutes != null
        ? top.durationMinutes - second.durationMinutes
        : null
    const stopsDiff =
      top.stops != null && second?.stops != null ? top.stops - second.stops : null

    const { ar, en } = this.composeText(top, second, {
      priceDiff,
      durationMinutesDiff,
      stopsDiff,
    })

    return {
      offerId: top.id,
      ar,
      en,
      comparedToId: second?.id ?? null,
      deltas: { priceDiff, durationMinutesDiff, stopsDiff },
    }
  }

  private composeText(
    top: BrainV1Offer,
    second: BrainV1Offer | null,
    deltas: {
      priceDiff: number | null
      durationMinutesDiff: number | null
      stopsDiff: number | null
    },
  ): { ar: string; en: string } {
    if (!second) {
      const why = top.reasons?.[0] ?? 'best overall fit'
      return {
        ar: `اخترت ${top.title} لأنه الأنسب إجمالاً (${why}).`,
        en: `I chose ${top.title} because it is the best overall fit (${why}).`,
      }
    }

    const currency = top.currency || second.currency || 'SAR'
    const partsEn: string[] = []
    const partsAr: string[] = []

    if (deltas.priceDiff != null && deltas.durationMinutesDiff != null) {
      const priceAbs = Math.abs(Math.round(deltas.priceDiff))
      const savedMin = -deltas.durationMinutesDiff
      if (deltas.priceDiff > 0 && savedMin > 0) {
        partsEn.push(
          `it is only ${priceAbs} ${currency} more expensive but saves ${fmtDuration(savedMin)}`,
        )
        partsAr.push(
          `أغلى بـ ${priceAbs} ${currency} فقط لكنه يوفر ${fmtDuration(savedMin)}`,
        )
      } else if (deltas.priceDiff < 0 && savedMin > 0) {
        partsEn.push(
          `it is ${priceAbs} ${currency} cheaper and also saves ${fmtDuration(savedMin)}`,
        )
        partsAr.push(
          `أرخص بـ ${priceAbs} ${currency} ويوفر أيضاً ${fmtDuration(savedMin)}`,
        )
      } else if (deltas.priceDiff < 0) {
        partsEn.push(`it is ${priceAbs} ${currency} cheaper`)
        partsAr.push(`أرخص بـ ${priceAbs} ${currency}`)
      } else if (savedMin > 0) {
        partsEn.push(`it saves ${fmtDuration(savedMin)}`)
        partsAr.push(`يوفر ${fmtDuration(savedMin)}`)
      }
    } else if (deltas.priceDiff != null) {
      const priceAbs = Math.abs(Math.round(deltas.priceDiff))
      if (deltas.priceDiff < 0) {
        partsEn.push(`it is ${priceAbs} ${currency} cheaper`)
        partsAr.push(`أرخص بـ ${priceAbs} ${currency}`)
      } else if (deltas.priceDiff > 0) {
        partsEn.push(
          `it costs ${priceAbs} ${currency} more but scores higher overall`,
        )
        partsAr.push(
          `أغلى بـ ${priceAbs} ${currency} لكنه أفضل إجمالاً`,
        )
      }
    }

    if (deltas.stopsDiff != null && deltas.stopsDiff < 0) {
      partsEn.push('it has fewer stops')
      partsAr.push('بتوقفات أقل')
    }

    if (top.reasons?.includes('Preferred airline')) {
      partsEn.push('it matches your preferred airline')
      partsAr.push('يطابق شركة الطيران المفضلة لديك')
    }
    if (top.reasons?.includes('Refundable') || top.reasons?.includes('Free cancellation')) {
      partsEn.push('it is more flexible to cancel or refund')
      partsAr.push('أكثر مرونة للإلغاء أو الاسترداد')
    }

    if (partsEn.length === 0) {
      partsEn.push(
        `it has a higher overall score (${top.score ?? 0} vs ${second.score ?? 0})`,
      )
      partsAr.push(
        `درجته الإجمالية أعلى (${top.score ?? 0} مقابل ${second.score ?? 0})`,
      )
    }

    return {
      en: `I chose this ${top.kind} because ${partsEn.join(' and ')}.`,
      ar: `اخترت هذا الخيار لأن ${partsAr.join(' و')}.`,
    }
  }
}

export function createExplainabilityEngine(): ExplainabilityEngine {
  return new ExplainabilityEngine()
}
