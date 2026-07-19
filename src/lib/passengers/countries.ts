/**
 * ISO 3166-1 alpha-2 country codes used for nationality / passport issuing country.
 * Curated list covering GCC + common travel markets; validation accepts any valid alpha-2.
 */

export interface CountryOption {
  code: string
  nameEn: string
  nameAr: string
}

/** Common selectable countries for passenger forms. */
export const COMMON_COUNTRIES: readonly CountryOption[] = [
  { code: 'SA', nameEn: 'Saudi Arabia', nameAr: 'السعودية' },
  { code: 'AE', nameEn: 'United Arab Emirates', nameAr: 'الإمارات' },
  { code: 'QA', nameEn: 'Qatar', nameAr: 'قطر' },
  { code: 'KW', nameEn: 'Kuwait', nameAr: 'الكويت' },
  { code: 'BH', nameEn: 'Bahrain', nameAr: 'البحرين' },
  { code: 'OM', nameEn: 'Oman', nameAr: 'عُمان' },
  { code: 'EG', nameEn: 'Egypt', nameAr: 'مصر' },
  { code: 'JO', nameEn: 'Jordan', nameAr: 'الأردن' },
  { code: 'LB', nameEn: 'Lebanon', nameAr: 'لبنان' },
  { code: 'IQ', nameEn: 'Iraq', nameAr: 'العراق' },
  { code: 'TR', nameEn: 'Türkiye', nameAr: 'تركيا' },
  { code: 'GB', nameEn: 'United Kingdom', nameAr: 'المملكة المتحدة' },
  { code: 'US', nameEn: 'United States', nameAr: 'الولايات المتحدة' },
  { code: 'FR', nameEn: 'France', nameAr: 'فرنسا' },
  { code: 'DE', nameEn: 'Germany', nameAr: 'ألمانيا' },
  { code: 'IT', nameEn: 'Italy', nameAr: 'إيطاليا' },
  { code: 'ES', nameEn: 'Spain', nameAr: 'إسبانيا' },
  { code: 'IN', nameEn: 'India', nameAr: 'الهند' },
  { code: 'PK', nameEn: 'Pakistan', nameAr: 'باكستان' },
  { code: 'BD', nameEn: 'Bangladesh', nameAr: 'بنغلاديش' },
  { code: 'PH', nameEn: 'Philippines', nameAr: 'الفلبين' },
  { code: 'ID', nameEn: 'Indonesia', nameAr: 'إندونيسيا' },
  { code: 'MY', nameEn: 'Malaysia', nameAr: 'ماليزيا' },
  { code: 'CN', nameEn: 'China', nameAr: 'الصين' },
  { code: 'JP', nameEn: 'Japan', nameAr: 'اليابان' },
  { code: 'KR', nameEn: 'South Korea', nameAr: 'كوريا الجنوبية' },
  { code: 'AU', nameEn: 'Australia', nameAr: 'أستراليا' },
  { code: 'CA', nameEn: 'Canada', nameAr: 'كندا' },
  { code: 'MA', nameEn: 'Morocco', nameAr: 'المغرب' },
  { code: 'TN', nameEn: 'Tunisia', nameAr: 'تونس' },
] as const

const ALPHA2 = /^[A-Z]{2}$/

/** Normalize and validate ISO alpha-2 country code. */
export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase()
}

export function isValidCountryCode(value: string): boolean {
  const code = normalizeCountryCode(value)
  return ALPHA2.test(code)
}

export function countryLabel(code: string, locale: 'ar' | 'en' = 'en'): string {
  const normalized = normalizeCountryCode(code)
  const found = COMMON_COUNTRIES.find((c) => c.code === normalized)
  if (!found) return normalized
  return locale === 'ar' ? found.nameAr : found.nameEn
}
