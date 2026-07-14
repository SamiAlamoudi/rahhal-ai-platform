import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult, ReasoningItem } from '../utils/reasoningEngine'

const TYPE_LABELS: Record<string, string> = {
  flight: 'رحلة طيران',
  hotel: 'فندق',
  activity: 'نشاط',
  transportation: 'مواصلات',
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  excellent: 'ممتاز',
  recommended: 'موصى به',
  acceptable: 'مقبول',
  'not-recommended': 'غير موصى به',
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  excellent: 'bg-emerald-100 text-emerald-700',
  recommended: 'bg-primary-100 text-primary-700',
  acceptable: 'bg-amber-100 text-amber-700',
  'not-recommended': 'bg-rose-100 text-rose-700',
}

interface Props {
  option: NormalizedTravelOption
  reasoning: ReasoningResult
}

function formatItem(item: ReasoningItem): string {
  const p = item.params
  switch (item.key) {
    case 'recommendation.excellent':
      return `خيار ممتاز (${p.score}/100)`
    case 'recommendation.recommended':
      return `نوصي بهذا الخيار (${p.score}/100)`
    case 'recommendation.acceptable':
      return `خيار مقبول (${p.score}/100)`
    case 'recommendation.not-recommended':
      return `لا نوصي بهذا الخيار (${p.score}/100)`
    case 'recommendation.withinBudget':
      return `ضمن ميزانيتك (وفّّر ≈${p.percentage}%)`
    case 'recommendation.directFlight':
      return 'رحلة مباشرة'
    case 'recommendation.oneStop':
      return 'توقف واحد فقط'
    case 'recommendation.shorterThanAverage':
      return `مدة السفر أقصر من المتوسط (${p.hours} ساعات)`
    case 'recommendation.excellentForFamilies':
      return 'ممتاز للعائلات'
    case 'recommendation.matchesPurpose':
      return `يطابق غرض السفر: ${p.purpose}`
    case 'recommendation.savesPercentage':
      return `وفّّر حوالي ${p.percentage}% مقارنة بخيارات مشابهة`
    case 'strengths.price.high':
      return `السعر ممتاز (${p.score}/100)`
    case 'strengths.comfort.high':
      return `مستوى الراحة عالي (${p.score}/100)`
    case 'strengths.travelTime.high':
      return `وقت السفر ممتاز (${p.score}/100)`
    case 'strengths.familySuitability.high':
      return `ملاءمة العائلة عالية (${p.score}/100)`
    case 'strengths.luxury.high':
      return `مستوى الفخامة عالي (${p.score}/100)`
    case 'strengths.destinationMatch.high':
      return `مطابقة الوجهة ممتازة (${p.score}/100)`
    case 'strengths.purposeMatch.high':
      return `مطابقة الغرض عالية (${p.score}/100)`
    case 'strengths.preferenceMatch.high':
      return `مطابقة التفضيلات عالية (${p.score}/100)`
    case 'strengths.flight.direct':
      return 'رحلة مباشرة بدون توقفات'
    case 'strengths.cancellation.free':
      return 'إلغاء مجاني متاح'
    case 'strengths.rating.high':
      return `تقييم عالي (${p.rating}/5)`
    case 'warning.overBudget':
      return `يتجاوز الميزانية بـ ${p.amount} ${p.currency}`
    case 'warning.nonRefundable':
      return 'غير قابل للاسترداد'
    case 'warning.notFamilyFriendly':
      return 'غير مناسب للأطفال'
    case 'warning.manyStopsWithKids':
      return `${p.stops} توقفات مع أطفال قد تكون مرهقة`
    case 'warning.lowRating':
      return `تقييم منخفض (${p.rating}/5)`
    case 'warning.noBaggage':
      return 'لا تشمل الأمتعة'
    case 'warning.lowConfidence':
      return `مستوى ثقة منخفض (${p.confidence}/100)`
    case 'warning.lowComfort':
      return `مستوى راحة منخفض (${p.score}/100)`
    default:
      return ''
  }
}

export default function RankedOptionCard({ option, reasoning }: Props) {
  const typeLabel = TYPE_LABELS[option.type] ?? option.type
  const recLabel = RECOMMENDATION_LABELS[reasoning.recommendation] ?? reasoning.recommendation
  const recColor = RECOMMENDATION_COLORS[reasoning.recommendation] ?? RECOMMENDATION_COLORS.acceptable

  const strengths = reasoning.strengths.items
    .map(formatItem)
    .filter(s => s.length > 0)
    .slice(0, 3)

  const warnings = reasoning.riskWarnings.items
    .map(formatItem)
    .filter(s => s.length > 0)
    .slice(0, 1)

  const summary = reasoning.recommendationSummary
    .map(formatItem)
    .filter(s => s.length > 0)
    .slice(0, 3)

  const score = option.decisionScore?.weightedAverage ?? 0

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{typeLabel}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${recColor}`}>{recLabel}</span>
          </div>
          <h3 className="mt-2 truncate text-sm font-bold text-slate-900">{option.title}</h3>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-lg font-bold text-primary-600">{score}</p>
          <p className="text-[10px] font-medium text-slate-400">من 100</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3">
        <span className="text-sm font-bold text-slate-700">
          {option.price.toLocaleString()} {option.currency}
        </span>
        {option.rating !== null && (
          <span className="text-xs font-medium text-amber-500">★ {option.rating}</span>
        )}
      </div>

      {summary.length > 0 && (
        <div className="mt-3 space-y-1">
          {summary.map((s, i) => (
            <p key={i} className="text-xs leading-relaxed text-slate-600">• {s}</p>
          ))}
        </div>
      )}

      {strengths.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-bold text-emerald-600">نقاط القوة</p>
          <div className="space-y-1">
            {strengths.map((s, i) => (
              <p key={i} className="text-xs leading-relaxed text-slate-600">• {s}</p>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-bold text-rose-500">تحذير</p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs leading-relaxed text-slate-600">• {w}</p>
          ))}
        </div>
      )}
    </div>
  )
}
