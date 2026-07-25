import type { ProductLocale } from './copy'

export interface ProductSuggestion {
  id: string
  ar: string
  en: string
}

export const PRODUCT_HOME_SUGGESTIONS: ProductSuggestion[] = [
  {
    id: 'morocco-5d',
    ar: 'خطّط رحلة خمسة أيام إلى المغرب',
    en: 'Plan a five-day trip to Morocco',
  },
  {
    id: 'budget-dest',
    ar: 'اقترح وجهة مناسبة لميزانيتي',
    en: 'Find a suitable destination for my budget',
  },
  {
    id: 'business',
    ar: 'نظّم رحلتي العملية القادمة',
    en: 'Organize my next business trip',
  },
  {
    id: 'compare',
    ar: 'قارن بين مراكش وأكادير',
    en: 'Compare Marrakech and Agadir',
  },
  {
    id: 'family',
    ar: 'ابحث عن طيران وفندق مناسب للعائلة',
    en: 'Find flights and a family-friendly hotel',
  },
]

export function suggestionText(item: ProductSuggestion, locale: ProductLocale): string {
  return locale === 'ar' ? item.ar : item.en
}
