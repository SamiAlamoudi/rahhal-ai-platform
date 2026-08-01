/**
 * Sprint 85/87 — Value-First Planner.
 * Decide whether useful preliminary value can be produced before asking.
 * Never fabricates live prices, availability, schedules, or provider data.
 */

import {
  getDestinationInsight,
  indicativeBudgetForSlots,
  inferTripStyle,
  readTaggedDuration,
} from '../destinationInsights'
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

    const insight = getDestinationInsight(dest, input.slots.specialRequests)
    const style = inferTripStyle({
      durationDays: readTaggedDuration(input.slots.specialRequests),
      specialRequests: input.slots.specialRequests,
      adults: input.slots.adults,
      children: input.slots.children,
    })
    const budget = indicativeBudgetForSlots(input.slots)
    const items: ConversationValueItem[] = []

    if (insight) {
      if (insight.cities.length > 1 && insight.cityContrastAr && insight.cityContrastEn) {
        items.push({
          id: `${insight.destinationKey}_cities`,
          kind: 'destination_option',
          titleAr: `مدن ${insight.displayNameAr}`,
          titleEn: `${insight.displayNameEn} cities`,
          detailAr: `${insight.cityContrastAr} مقترح أولي: ${insight.cities.slice(0, 3).join('، ')}.`,
          detailEn: `${insight.cityContrastEn} First cut: ${insight.citiesEn.slice(0, 3).join(', ')}.`,
          preliminary: true,
        })
      } else {
        items.push({
          id: `${insight.destinationKey}_focus`,
          kind: 'destination_option',
          titleAr: `تركيز على ${insight.displayNameAr}`,
          titleEn: `Focus on ${insight.displayNameEn}`,
          detailAr: `نحدّث التركيز إلى ${insight.displayNameAr} مع خطة مبدئية قابلة للتعديل.`,
          detailEn: `Focusing the plan on ${insight.displayNameEn} with a revisable preliminary direction.`,
          preliminary: true,
        })
      }

      items.push({
        id: `${insight.destinationKey}_season`,
        kind: 'criteria',
        titleAr: 'الموسم والطقس',
        titleEn: 'Season and weather',
        detailAr: `${insight.seasonNoteAr} ${insight.weatherNoteAr}`,
        detailEn: `${insight.seasonNoteEn} ${insight.weatherNoteEn}`,
        preliminary: true,
      })

      const duration = insight.typicalDurationDays.recommended
      const durationNote = readTaggedDuration(input.slots.specialRequests)
      items.push({
        id: `${insight.destinationKey}_duration`,
        kind: 'estimate',
        titleAr: 'المدة المقترحة',
        titleEn: 'Suggested duration',
        detailAr: durationNote
          ? `مدة مناسبة لهذه الرحلة حوالي ${durationNote} أيام (إرشادي).`
          : `مدة مناسبة غالباً ${insight.typicalDurationDays.min}–${insight.typicalDurationDays.max} أيام (مقترح ${duration}).`,
        detailEn: durationNote
          ? `About ${durationNote} days fits this trip shape (indicative).`
          : `Typically ${insight.typicalDurationDays.min}–${insight.typicalDurationDays.max} days (suggested ${duration}).`,
        preliminary: true,
      })

      if (budget) {
        items.push({
          id: `${insight.destinationKey}_budget`,
          kind: 'estimate',
          titleAr: 'تقدير ميزانية إرشادي',
          titleEn: 'Indicative budget',
          detailAr: `تقدير ميزانية أولي حوالي ${budget.amount.toLocaleString('ar-SA')} ر.س للشخص تقريباً — ${budget.noteAr}`,
          detailEn: `Rough mid-band around ${budget.amount.toLocaleString('en-US')} SAR per person — ${budget.noteEn}`,
          preliminary: true,
        })
      }

      items.push({
        id: `${insight.destinationKey}_itinerary`,
        kind: 'itinerary_direction',
        titleAr: 'اتجاه خطة مبدئية',
        titleEn: 'Preliminary itinerary direction',
        detailAr: insight.itinerarySketchAr.slice(0, 3).join(' · '),
        detailEn: insight.itinerarySketchEn.slice(0, 3).join(' · '),
        preliminary: true,
      })

      const styleAr = insight.styleNotesAr[style]
      const styleEn = insight.styleNotesEn[style]
      if (styleAr && styleEn) {
        items.push({
          id: `${insight.destinationKey}_style`,
          kind: 'tip',
          titleAr: 'ملاحظة حسب نوع الرحلة',
          titleEn: 'Trip-style note',
          detailAr: styleAr,
          detailEn: styleEn,
          preliminary: true,
        })
      }

      items.push({
        id: `${insight.destinationKey}_logistics`,
        kind: 'tip',
        titleAr: 'طيران وتوقيت',
        titleEn: 'Flight and timezone',
        detailAr: `${insight.flightNoteAr} ${insight.timezoneNoteAr}`,
        detailEn: `${insight.flightNoteEn} ${insight.timezoneNoteEn}`,
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
