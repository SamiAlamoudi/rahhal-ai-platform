/**
 * Extensible dialect catalog.
 * Add a new dialect here — Intelligence Layer code does not need edits.
 */

import type { BilamoArabicDialectId, BilamoDialectDefinition } from '../types'

const ARB = '(?<![\\u0600-\\u06FF])'
const ARE = '(?![\\u0600-\\u06FF])'
const t = (body: string) => new RegExp(`${ARB}(?:${body})${ARE}`, 'u')

/**
 * Register dialects for detection. Order does not matter; scores accumulate.
 * Future dialects: append a definition — no Intelligence Layer changes.
 */
export const BILAMO_DIALECT_CATALOG: BilamoDialectDefinition[] = [
  {
    id: 'msa',
    labelAr: 'الفصحى المعاصرة',
    labelEn: 'Modern Standard Arabic',
    group: 'msa',
    cues: [
      { weight: 0.22, pattern: t('أود|أرغب|يرجى|فضلاً|بناءً') },
    ],
  },
  {
    id: 'saudi',
    labelAr: 'السعودية',
    labelEn: 'Saudi',
    group: 'peninsula',
    cues: [
      { weight: 0.55, pattern: t('أبغى|أبغي|ابغى|ابغي|وش|وين|خلنا|أبشر|تبي') },
      { weight: 0.4, pattern: t('أبي\\s+(?:أسافر|اسافر|إجازة|اجازة)|ابي\\s+(?:أسافر|اسافر)') },
    ],
  },
  {
    id: 'gulf',
    labelAr: 'خليجية عامة',
    labelEn: 'Gulf',
    group: 'gulf',
    cues: [
      { weight: 0.5, pattern: t('أبا\\s+(?:أسافر|اسافر)|ابا\\s+(?:أسافر|اسافر)|يعطيكم\\s*العافية') },
      { weight: 0.35, pattern: t('زين\\s+الحين') },
    ],
  },
  {
    id: 'emirati',
    labelAr: 'الإماراتية',
    labelEn: 'Emirati',
    group: 'gulf',
    cues: [
      { weight: 0.55, pattern: t('زين\\s*كذا|عساك\\s*طيب|يلاه\\s*نسافر|والله\\s*زين') },
    ],
  },
  {
    id: 'kuwaiti',
    labelAr: 'الكويتية',
    labelEn: 'Kuwaiti',
    group: 'gulf',
    cues: [
      { weight: 0.55, pattern: t('شنو|شكد|اكييد|أكّيد') },
    ],
  },
  {
    id: 'qatari',
    labelAr: 'القطرية',
    labelEn: 'Qatari',
    group: 'gulf',
    cues: [
      { weight: 0.55, pattern: t('ماشالله|ماشاءالله') },
    ],
  },
  {
    id: 'bahraini',
    labelAr: 'البحرينية',
    labelEn: 'Bahraini',
    group: 'gulf',
    cues: [
      { weight: 0.55, pattern: t('هالحين|شلونكم') },
    ],
  },
  {
    id: 'omani',
    labelAr: 'العُمانية',
    labelEn: 'Omani',
    group: 'gulf',
    cues: [
      { weight: 0.55, pattern: t('إن\\s*شاء\\s*الله\\s*طيب|زي\\s*كذا\\s*زين') },
    ],
  },
  {
    id: 'yemeni',
    labelAr: 'اليمنية',
    labelEn: 'Yemeni',
    group: 'yemen',
    cues: [
      { weight: 0.6, pattern: t('يا\\s*خوي|قعدة') },
    ],
  },
  {
    id: 'egyptian',
    labelAr: 'المصرية',
    labelEn: 'Egyptian',
    group: 'egypt',
    cues: [
      { weight: 0.55, pattern: t('إزيك|ازيك|عايز|عاوز|كده|أوي|اوي|النهارده|عايزين') },
    ],
  },
  {
    id: 'levantine',
    labelAr: 'الشامية',
    labelEn: 'Levantine',
    group: 'levant',
    cues: [
      { weight: 0.55, pattern: t('كيفك|بدّي|بدي|بدنا|هلق|هلأ|منيح') },
      { weight: 0.35, pattern: t('شو\\s+(?:رأيك|اخبارك)') },
    ],
  },
  {
    id: 'iraqi',
    labelAr: 'العراقية',
    labelEn: 'Iraqi',
    group: 'iraq',
    cues: [
      { weight: 0.55, pattern: t('شلونك|اكو|ماكو|هسة|خوش') },
    ],
  },
  {
    id: 'moroccan',
    labelAr: 'المغربية',
    labelEn: 'Moroccan',
    group: 'maghreb',
    cues: [
      { weight: 0.55, pattern: t('بشحال|بزاف|دابا|صافي|واش|فين') },
      { weight: 0.35, pattern: t('بغيت') },
    ],
  },
  {
    id: 'algerian',
    labelAr: 'الجزائرية',
    labelEn: 'Algerian',
    group: 'maghreb',
    cues: [
      { weight: 0.6, pattern: t('راني|برك|صحيت') },
    ],
  },
  {
    id: 'tunisian',
    labelAr: 'التونسية',
    labelEn: 'Tunisian',
    group: 'maghreb',
    cues: [
      { weight: 0.6, pattern: t('شنوة|برشة|توّة|توة|نحكي') },
    ],
  },
  {
    id: 'sudanese',
    labelAr: 'السودانية',
    labelEn: 'Sudanese',
    group: 'sudan',
    cues: [
      { weight: 0.65, pattern: t('يا\\s*زول|زول|كويس\\s*شديد|حا\\s*أمشي') },
    ],
  },
]

const byId = new Map(BILAMO_DIALECT_CATALOG.map((d) => [d.id, d]))

export function listBilamoDialectIds(): BilamoArabicDialectId[] {
  return BILAMO_DIALECT_CATALOG.map((d) => d.id)
}

export function getBilamoDialect(id: BilamoArabicDialectId): BilamoDialectDefinition | undefined {
  return byId.get(id)
}

export function isBilamoArabicDialectId(value: string): value is BilamoArabicDialectId {
  return byId.has(value as BilamoArabicDialectId)
}

/**
 * Register an extra dialect at runtime (tests / future plugins).
 * Does not require Intelligence Layer changes.
 */
export function registerBilamoDialect(definition: BilamoDialectDefinition): void {
  const existing = BILAMO_DIALECT_CATALOG.findIndex((d) => d.id === definition.id)
  if (existing >= 0) BILAMO_DIALECT_CATALOG[existing] = definition
  else BILAMO_DIALECT_CATALOG.push(definition)
  byId.set(definition.id, definition)
}
