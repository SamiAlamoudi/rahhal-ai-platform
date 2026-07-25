import { isInsightsCenterEnabled } from '../insightsCenterRegistry'
import type {
  InsightsCenterLocale,
  InsightsCenterTheme,
  InsightsCenterUiState,
  InsightsFilterId,
} from '../types'
import { INSIGHTS_CENTER_ISOLATION } from '../types'

export function createDemoInsightsCenterState(options?: {
  locale?: InsightsCenterLocale
  theme?: InsightsCenterTheme
  enabled?: boolean
  activeFilter?: InsightsFilterId
}): InsightsCenterUiState {
  const locale = options?.locale ?? 'ar'
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)

  return {
    locale,
    theme: options?.theme ?? 'light',
    activeFilter: options?.activeFilter ?? 'this_year',
    overview: t(
      'ملخص سفر تنفيذي يعرض النشاط والميزانية والوجهات — واجهة فقط.',
      'Executive travel overview of activity, budget, and destinations — presentation only.',
    ),
    statistics: [
      {
        id: 's1',
        labelKey: 'trips',
        value: '18',
        trendLabel: t('+3 هذا العام', '+3 this year'),
      },
      {
        id: 's2',
        labelKey: 'flights',
        value: '26',
        trendLabel: t('مستقر', 'Stable'),
      },
      {
        id: 's3',
        labelKey: 'nights',
        value: '54',
        trendLabel: t('+12%', '+12%'),
      },
      {
        id: 's4',
        labelKey: 'travelers',
        value: '7',
      },
    ],
    budgetTotalLabel: '128,400 SAR',
    savingsLabel: t('وفّرت 12,600 SAR', 'Saved 12,600 SAR'),
    costBreakdown: [
      { id: 'c1', label: t('طيران', 'Flights'), amountLabel: '62,000', percent: 48 },
      { id: 'c2', label: t('فنادق', 'Hotels'), amountLabel: '41,200', percent: 32 },
      { id: 'c3', label: t('تنقل', 'Transport'), amountLabel: '14,800', percent: 12 },
      { id: 'c4', label: t('أخرى', 'Other'), amountLabel: '10,400', percent: 8 },
    ],
    visitedCountries: [
      { id: 'co1', name: t('فرنسا', 'France'), count: 4 },
      { id: 'co2', name: t('الإمارات', 'UAE'), count: 6 },
      { id: 'co3', name: t('تركيا', 'Turkey'), count: 2 },
    ],
    visitedCities: [
      { id: 'ci1', name: t('باريس', 'Paris'), count: 3 },
      { id: 'ci2', name: t('دبي', 'Dubai'), count: 5 },
      { id: 'ci3', name: t('إسطنبول', 'Istanbul'), count: 2 },
    ],
    favoriteAirlines: [
      { id: 'a1', name: 'Saudia', count: 9 },
      { id: 'a2', name: 'Emirates', count: 5 },
    ],
    favoriteHotels: [
      { id: 'h1', name: 'Le Meurice', count: 2 },
      { id: 'h2', name: 'Atlantis The Palm', count: 3 },
    ],
    tripFrequencyLabel: t('1.5 رحلة / شهر', '1.5 trips / month'),
    tripCounts: { upcoming: 3, completed: 14, cancelled: 1 },
    travelHealthScore: 84,
    carbonFootprintPlaceholder: t(
      'البصمة الكربونية — واجهة فقط',
      'Carbon footprint — placeholder',
    ),
    passportStatusPlaceholder: t(
      'حالة الجواز — واجهة فقط',
      'Passport status — placeholder',
    ),
    visaStatusPlaceholder: t(
      'حالة التأشيرة — واجهة فقط',
      'Visa status — placeholder',
    ),
    loyaltySummaryPlaceholder: t(
      'ملخص الولاء — واجهة فقط',
      'Loyalty summary — placeholder',
    ),
    journeyActivity: [
      {
        id: 'ja1',
        labelKey: 'meetings',
        value: '22',
        trendLabel: t('نشط', 'Active'),
      },
      {
        id: 'ja2',
        labelKey: 'activities',
        value: '11',
      },
    ],
    timelineSummary: [
      { id: 't1', label: 'Jan', valueLabel: '2' },
      { id: 't2', label: 'Mar', valueLabel: '3' },
      { id: 't3', label: 'Jun', valueLabel: '4' },
      { id: 't4', label: 'Sep', valueLabel: '5' },
      { id: 't5', label: 'Dec', valueLabel: '4' },
    ],
    badges: [
      { id: 'b1', label: t('مستكشف أوروبا', 'Europe explorer'), earned: true },
      { id: 'b2', label: t('مسافر متكرر', 'Frequent flyer'), earned: true },
      { id: 'b3', label: t('صديق البيئة', 'Eco traveler'), earned: false },
    ],
    featureEnabled: isInsightsCenterEnabled({ enabled: options?.enabled }),
  }
}

export function assertInsightsCenterIsolation(): typeof INSIGHTS_CENTER_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...INSIGHTS_CENTER_ISOLATION,
    presentationOnly: true,
  }
}
