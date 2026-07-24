import { isDecisionCenterEnabled } from '../decisionCenterRegistry'
import type {
  DecisionCenterLocale,
  DecisionCenterTheme,
  DecisionCenterUiState,
  DecisionType,
} from '../types'
import { DECISION_CENTER_ISOLATION } from '../types'

export function createDemoDecisionCenterState(options?: {
  locale?: DecisionCenterLocale
  theme?: DecisionCenterTheme
  enabled?: boolean
  decisionType?: DecisionType
}): DecisionCenterUiState {
  const locale = options?.locale ?? 'ar'
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)

  return {
    locale,
    theme: options?.theme ?? 'light',
    decisionType: options?.decisionType ?? 'flight_choice',
    summary: t(
      'نوصي برحلة SV123 صباحاً لتوازن الوقت والتكلفة والراحة.',
      'We recommend morning flight SV123 for balance of time, cost, and comfort.',
    ),
    whyRecommended: t(
      'إقلاع مبكر، وصول قبل الاجتماع، وتكلفة ضمن الميزانية.',
      'Early departure, arrival before the meeting, and cost within budget.',
    ),
    recommendationReason: t(
      'درجة السفر الأعلى مع مخاطر تأخير منخفضة في هذه النافذة.',
      'Highest travel score with low delay risk in this window.',
    ),
    confidence: 0.86,
    pros: [
      t('وصول قبل الاجتماع بساعتين', 'Arrives 2h before meeting'),
      t('مقعد ممر متاح', 'Aisle seat available'),
      t('حقيبة مسجلة مشمولة', 'Checked bag included'),
    ],
    cons: [
      t('إقلاع مبكر يتطلب مغادرة فندق سابقة', 'Early start needs earlier hotel departure'),
      t('توقف قصير غير مطلوب لكنه ممكن في البدائل', 'Short layover only on alternatives'),
    ],
    riskIndicators: [
      t('مخاطر تأخير منخفضة', 'Low delay risk'),
      t('اتصال أرضي مستقر', 'Stable ground connection'),
    ],
    options: [
      {
        id: 'opt-rec',
        title: 'SV123 · RUH → CDG',
        subtitle: t('موصى به', 'Recommended'),
        tags: ['recommended', 'best_value'],
        costLabel: '3,450 SAR',
        timeLabel: '6h 30m',
        comfortScore: 82,
        riskLabel: t('منخفض', 'Low'),
        travelScore: 88,
      },
      {
        id: 'opt-fast',
        title: 'AF118 · RUH → CDG',
        subtitle: t('الأسرع', 'Fastest'),
        tags: ['alternative', 'fastest'],
        costLabel: '4,100 SAR',
        timeLabel: '6h 05m',
        comfortScore: 78,
        riskLabel: t('متوسط', 'Medium'),
        travelScore: 80,
      },
      {
        id: 'opt-lux',
        title: 'QR450 · Business',
        subtitle: t('فاخر', 'Luxury'),
        tags: ['alternative', 'luxury'],
        costLabel: '9,800 SAR',
        timeLabel: '7h 10m',
        comfortScore: 96,
        riskLabel: t('منخفض', 'Low'),
        travelScore: 84,
      },
      {
        id: 'opt-budget',
        title: 'XY220 · via IST',
        subtitle: t('اقتصادي', 'Budget'),
        tags: ['alternative', 'budget', 'eco'],
        costLabel: '2,150 SAR',
        timeLabel: '10h 40m',
        comfortScore: 61,
        riskLabel: t('مرتفع', 'High'),
        travelScore: 64,
      },
    ],
    comparison: {
      costDeltaLabel: t('+650 SAR مقابل الأسرع', '+650 SAR vs fastest'),
      timeDeltaLabel: t('+25 دقيقة مقابل الأسرع', '+25m vs fastest'),
      comfortDeltaLabel: t('+4 مقابل الأسرع', '+4 vs fastest'),
    },
    tree: {
      id: 'root',
      label: t('اختيار الرحلة', 'Flight choice'),
      children: [
        {
          id: 'morning',
          label: t('صباحاً', 'Morning'),
          children: [
            { id: 'sv123', label: 'SV123' },
            { id: 'af118', label: 'AF118' },
          ],
        },
        {
          id: 'evening',
          label: t('مساءً', 'Evening'),
          children: [{ id: 'xy220', label: 'XY220' }],
        },
      ],
    },
    timelineImpact: [
      t('وصول قبل الاجتماع', 'Arrive before meeting'),
      t('نقل أرضي بدون ضغط', 'Ground transfer without rush'),
      t('تسجيل فندق في الوقت', 'Hotel check-in on time'),
    ],
    featureEnabled: isDecisionCenterEnabled({ enabled: options?.enabled }),
  }
}

export function assertDecisionCenterIsolation(): typeof DECISION_CENTER_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...DECISION_CENTER_ISOLATION,
    presentationOnly: true,
  }
}
