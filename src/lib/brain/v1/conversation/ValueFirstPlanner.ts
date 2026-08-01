/**
 * Sprint 85/87 — Value-First Planner.
 * Builds preliminary value from Destination Knowledge reasoning (scores + fields).
 * Never fabricates live prices, availability, schedules, or provider data.
 */

import {
  indicativeBudgetForSlots,
  readTaggedDuration,
  reasonFromDestinationKnowledge,
} from '../destinationKnowledge'
import type { TravelPlanSlots } from '../planning/types'
import type {
  ConversationAssumption,
  ConversationValueItem,
} from './types'

export class ValueFirstPlanner {
  canProvideValue(slots: TravelPlanSlots): boolean {
    return Boolean(slots.destination)
  }

  build(input: {
    slots: TravelPlanSlots
    assumptions: ConversationAssumption[]
    recommendations?: string[]
  }): ConversationValueItem[] {
    const dest = input.slots.destination
    if (!dest) return []

    const reasoning = reasonFromDestinationKnowledge({
      destination: dest,
      specialRequests: input.slots.specialRequests,
      adults: input.slots.adults,
      children: input.slots.children,
      durationDays: readTaggedDuration(input.slots.specialRequests),
    })
    const budget = indicativeBudgetForSlots(input.slots)
    const items: ConversationValueItem[] = []

    if (reasoning) {
      const key = reasoning.knowledge.key
      if (reasoning.recommendedCityNamesEn.length > 1) {
        items.push({
          id: `${key}_cities`,
          kind: 'destination_option',
          titleAr: `مدن ${reasoning.knowledge.displayNameAr}`,
          titleEn: `${reasoning.knowledge.displayNameEn} cities`,
          detailAr: `${reasoning.cityContrastAr} مقترح أولي: ${reasoning.recommendedCityNamesAr.slice(0, 3).join('، ')}.`,
          detailEn: `${reasoning.cityContrastEn} First cut: ${reasoning.recommendedCityNamesEn.slice(0, 3).join(', ')}.`,
          preliminary: true,
        })
      } else {
        items.push({
          id: `${key}_focus`,
          kind: 'destination_option',
          titleAr: `تركيز على ${reasoning.knowledge.displayNameAr}`,
          titleEn: `Focus on ${reasoning.knowledge.displayNameEn}`,
          detailAr: `${reasoning.cityContrastAr || `نحدّث التركيز إلى ${reasoning.knowledge.displayNameAr} مع خطة مبدئية قابلة للتعديل.`}`,
          detailEn: `${reasoning.cityContrastEn || `Focusing the plan on ${reasoning.knowledge.displayNameEn} with a revisable preliminary direction.`}`,
          preliminary: true,
        })
      }

      items.push({
        id: `${key}_season`,
        kind: 'criteria',
        titleAr: 'الموسم والمناخ',
        titleEn: 'Season and climate',
        detailAr: `${reasoning.seasonAr} ${reasoning.climateAr}`,
        detailEn: `${reasoning.seasonEn} ${reasoning.climateEn}`,
        preliminary: true,
      })

      const durationNote = readTaggedDuration(input.slots.specialRequests)
      items.push({
        id: `${key}_duration`,
        kind: 'estimate',
        titleAr: 'المدة المقترحة',
        titleEn: 'Suggested duration',
        detailAr: durationNote
          ? `مدة مناسبة لهذه الرحلة حوالي ${durationNote} أيام (إرشادي).`
          : `مدة مناسبة غالباً ${reasoning.duration.min}–${reasoning.duration.max} أيام (مقترح ${reasoning.duration.recommended}).`,
        detailEn: durationNote
          ? `About ${durationNote} days fits this trip shape (indicative).`
          : `Typically ${reasoning.duration.min}–${reasoning.duration.max} days (suggested ${reasoning.duration.recommended}).`,
        preliminary: true,
      })

      if (budget) {
        items.push({
          id: `${key}_budget`,
          kind: 'estimate',
          titleAr: 'تقدير ميزانية إرشادي',
          titleEn: 'Indicative budget',
          detailAr: `تقدير ميزانية أولي حوالي ${budget.amount.toLocaleString('ar-SA')} ر.س للشخص تقريباً — ${budget.noteAr}`,
          detailEn: `Rough mid-band around ${budget.amount.toLocaleString('en-US')} SAR per person — ${budget.noteEn}`,
          preliminary: true,
        })
      }

      items.push({
        id: `${key}_itinerary`,
        kind: 'itinerary_direction',
        titleAr: 'اتجاه خطة مبدئية',
        titleEn: 'Preliminary itinerary direction',
        detailAr: reasoning.itinerarySketchAr.slice(0, 3).join(' · '),
        detailEn: reasoning.itinerarySketchEn.slice(0, 3).join(' · '),
        preliminary: true,
      })

      items.push({
        id: `${key}_style`,
        kind: 'tip',
        titleAr: 'ملاحظة حسب نوع الرحلة',
        titleEn: 'Trip-style note',
        detailAr: reasoning.styleNoteAr,
        detailEn: reasoning.styleNoteEn,
        preliminary: true,
      })

      items.push({
        id: `${key}_logistics`,
        kind: 'tip',
        titleAr: 'طيران ومطارات وتأشيرة',
        titleEn: 'Flight, airports, visa',
        detailAr: `${reasoning.flightAr} مطارات: ${reasoning.airportSummaryAr}. ${reasoning.visaAr}`,
        detailEn: `${reasoning.flightEn} Airports: ${reasoning.airportSummaryEn}. ${reasoning.visaEn}`,
        preliminary: true,
      })
    } else {
      items.push({
        id: 'generic_dest',
        kind: 'destination_option',
        titleAr: `تصور أولي لـ${dest}`,
        titleEn: `Preliminary direction for ${dest}`,
        detailAr: `بناءً على المعلومات الحالية أستطيع تجهيز تصور أولي لـ${dest} مع افتراضات قابلة للتعديل.`,
        detailEn: `Based on what I know so far, I can prepare a preliminary direction for ${dest} using reversible assumptions.`,
        preliminary: true,
      })
      items.push({
        id: 'planning_frame',
        kind: 'criteria',
        titleAr: 'إطار التخطيط المبدئي',
        titleEn: 'Preliminary planning frame',
        detailAr:
          'سأبدأ بخطة متوازنة متوسطة المدى مع تواريخ مرنة — تقديرية فقط حتى نؤكد البحث المباشر لاحقاً.',
        detailEn:
          'I will start with a balanced mid-range plan and flexible dates — indicative only until a live search is confirmed later.',
        preliminary: true,
      })
    }

    for (const [index, tip] of (input.recommendations ?? []).entries()) {
      items.push({
        id: `rec_${index}`,
        kind: 'tip',
        titleAr: 'ملاحظة ترشيح',
        titleEn: 'Recommendation note',
        detailAr: tip,
        detailEn: tip,
        preliminary: true,
      })
    }

    return items
  }

  nextBestAction(hasQuestion: boolean, destination: string | null): string {
    if (!destination) return 'Ask for destination to unlock preliminary planning value'
    if (hasQuestion) return 'Provide preliminary value, then ask one high-impact question'
    return 'Continue refining the preliminary plan without blocking questions'
  }
}

export function createValueFirstPlanner(): ValueFirstPlanner {
  return new ValueFirstPlanner()
}
