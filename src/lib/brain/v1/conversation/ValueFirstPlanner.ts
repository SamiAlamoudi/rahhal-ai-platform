/**
 * Sprint 85 — Value-First Planner.
 * Decide whether useful preliminary value can be produced before asking.
 * Never fabricates live prices, availability, schedules, or provider data.
 */

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

    const items: ConversationValueItem[] = []
    const destKey = dest.toLowerCase()

    if (destKey.includes('morocco') || dest === 'Morocco' || dest.includes('المغرب')) {
      items.push({
        id: 'morocco_cities',
        kind: 'destination_option',
        titleAr: 'مقارنة أولية لمدن المغرب',
        titleEn: 'Preliminary Morocco city comparison',
        detailAr:
          'للرحلة الأولى أقارن مراكش للثقافة والأنشطة، وأكادير لإقامة ساحلية هادئة، والدار البيضاء إن كان الوصول أو العمل أولوية.',
        detailEn:
          'For a first Morocco trip, I would initially compare Marrakech for culture and activities, Agadir for a relaxed coastal stay, and Casablanca if business access or flight connectivity matters most.',
        preliminary: true,
      })
      items.push({
        id: 'morocco_itinerary',
        kind: 'itinerary_direction',
        titleAr: 'اتجاه خطة مبدئية',
        titleEn: 'Preliminary itinerary direction',
        detailAr:
          'خيار قوي مبدئياً: مراكش مع أكادير خلال حوالي 6–8 أيام لرحلة متوازنة بين المدينة والساحل.',
        detailEn:
          'A strong first option is Marrakech plus Agadir for about 6–8 days — a balanced city-and-coast direction.',
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
    }

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
