/**
 * Sprint 89 Phase 1 — ReferenceResolver.
 * Resolves anaphora / relative references against memory hints + entities.
 * Ambiguous refs are returned, never invented destinations.
 * No search / tools.
 */

import type {
  ReferenceKind,
  ReferenceResolverResult,
  ResolvedReference,
  UnderstandingConfidence,
} from './types'
import { UNDERSTANDING_CONTRACT_VERSION } from './types'

export type ReferenceResolverInput = {
  text: string
  destination?: string | null
  origin?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  hotelPreference?: string | null
  preferredAirline?: string | null
  shortlistLabels?: string[]
  recentTexts?: string[]
}

function conf(level: UnderstandingConfidence['level'], score: number): UnderstandingConfidence {
  return { level, score }
}

export class ReferenceResolver {
  resolve(input: ReferenceResolverInput): ReferenceResolverResult {
    const text = input.text.trim()
    const lower = text.toLowerCase()
    const recent = (input.recentTexts ?? []).join(' \n ').toLowerCase()
    const resolved: ResolvedReference[] = []
    const ambiguous: ResolvedReference[] = []

    const push = (
      phrase: string,
      field: string,
      resolvesTo: string | null | undefined,
      kind: ReferenceKind,
      confidence: UnderstandingConfidence,
      isAmbiguous = false,
    ) => {
      if (!resolvesTo) {
        if (isAmbiguous) {
          ambiguous.push({
            phrase,
            field,
            resolvesTo: '',
            kind,
            confidence: conf('unknown', 0),
            ambiguous: true,
          })
        }
        return
      }
      const row: ResolvedReference = {
        phrase,
        field,
        resolvesTo,
        kind,
        confidence,
        ambiguous: isAmbiguous,
      }
      if (isAmbiguous) ambiguous.push(row)
      else if (!resolved.some((r) => r.phrase === phrase && r.resolvesTo === resolvesTo)) {
        resolved.push(row)
      }
    }

    if (/\bthere\b|هناك|لهناك/.test(lower) || /هناك/.test(text)) {
      if (input.destination) {
        push('there', 'trip.destination', input.destination, 'destination', conf('confirmed', 0.9))
      } else {
        push('there', 'trip.destination', null, 'destination', conf('unknown', 0), true)
      }
    }

    if (/\bsame place\b|نفس المكان|نفس الوجهة/.test(lower) || /نفس المكان|نفس الوجهة/.test(text)) {
      if (input.destination) {
        push('same place', 'trip.destination', input.destination, 'destination', conf('confirmed', 0.92))
      } else {
        const fromRecent =
          /(tokyo|dubai|paris|istanbul|morocco|turkey|طوكيو|دبي|باريس|إسطنبول|اسطنبول|المغرب|تركيا)/i.exec(
            recent,
          )
        if (fromRecent?.[1]) {
          push(
            'same place',
            'trip.destination',
            fromRecent[1],
            'destination',
            conf('medium_confidence_inferred', 0.65),
          )
        } else {
          push('same place', 'trip.destination', null, 'destination', conf('unknown', 0), true)
        }
      }
    }

    if (/\bsame hotel\b|نفس الفندق|نفس الإقامة/.test(lower) || /نفس الفندق/.test(text)) {
      if (input.hotelPreference) {
        push('same hotel', 'trip.hotelPreference', input.hotelPreference, 'hotel', conf('confirmed', 0.88))
      } else if ((input.shortlistLabels ?? []).length === 1) {
        push(
          'same hotel',
          'trip.hotelPreference',
          input.shortlistLabels![0]!,
          'hotel',
          conf('high_confidence_inferred', 0.8),
        )
      } else if ((input.shortlistLabels ?? []).length > 1) {
        push('same hotel', 'trip.hotelPreference', null, 'hotel', conf('conflicting', 0.4), true)
      } else {
        push('same hotel', 'trip.hotelPreference', null, 'hotel', conf('unknown', 0), true)
      }
    }

    if (/\bsame budget\b|نفس الميزانية|نفس السعر/.test(lower) || /نفس الميزانية/.test(text)) {
      if (input.budgetAmount != null) {
        push(
          'same budget',
          'trip.budget',
          `${input.budgetAmount} ${input.budgetCurrency ?? 'SAR'}`,
          'budget',
          conf('confirmed', 0.9),
        )
      } else {
        push('same budget', 'trip.budget', null, 'budget', conf('unknown', 0), true)
      }
    }

    if (/\bthat airline\b|نفس الطيران|تلك الشركة|نفس الخط/.test(lower)) {
      if (input.preferredAirline) {
        push(
          'that airline',
          'trip.preferredAirline',
          input.preferredAirline,
          'airline',
          conf('confirmed', 0.88),
        )
      } else {
        push('that airline', 'trip.preferredAirline', null, 'airline', conf('unknown', 0), true)
      }
    }

    if (/\bnext week\b|الأسبوع القادم|الاسبوع القادم/.test(lower) || /الأسبوع القادم/.test(text)) {
      push('next week', 'trip.dates', 'relative:next_week', 'date', conf('high_confidence_inferred', 0.8))
    }

    if (/\bthe first (?:one|option)\b|الأول|الخيار الأول/.test(lower) || /الخيار الأول/.test(text)) {
      const labels = input.shortlistLabels ?? []
      if (labels.length >= 1) {
        push('first option', 'shortlist.selection', labels[0]!, 'offer', conf('high_confidence_inferred', 0.82))
      } else {
        push('first option', 'shortlist.selection', null, 'offer', conf('unknown', 0), true)
      }
    }

    return {
      contractVersion: UNDERSTANDING_CONTRACT_VERSION,
      resolved,
      ambiguous,
    }
  }
}

export function createReferenceResolver(): ReferenceResolver {
  return new ReferenceResolver()
}
