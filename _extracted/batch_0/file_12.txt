import { memo, useState, useMemo } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult, ReasoningSection } from '../utils/reasoningEngine'
import { scoreToStars, formatStars, type OptionReport } from '../utils/reportFormatter'
import { ScoreBreakdownCard } from './ScoreBreakdownCard'

interface Props {
  option: NormalizedTravelOption
  reasoning: ReasoningResult
  report: OptionReport
  rank: number
  isCompareSelected: boolean
  onToggleCompare: (id: string) => void
  compareDisabled: boolean
}

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  activity: '🎯',
  transportation: '🚗',
}

const TYPE_LABELS: Record<string, string> = {
  flight: 'طيران',
  hotel: 'فندق',
  activity: 'نشاط',
  transportation: 'مواصلات',
}

const REC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  excellent: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  recommended: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  acceptable: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  'not-recommended': { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
}

function sectionToTexts(section: ReasoningSection): string[] {
  const TEXT_MAP: Record<string, (p: Record<string, string | number>) => string> = {
    'strengths.price.high': p => `السعر ممتاز (${p.score}/100)`,
    'strengths.comfort.high': p => `مستوى الراحة عالي (${p.score}/100)`,
    'strengths.travelTime.high': p => `وقت السفر ممتاز (${p.score}/100)`,
    'strengths.familySuitability.high': p => `ملاءمة العائلة عالية (${p.score}/100)`,
    'strengths.luxury.high': p => `مستوى الفخامة عالي (${p.score}/100)`,
    'strengths.destinationMatch.high': p => `مطابقة الوجهة ممتازة (${p.score}/100)`,
    'strengths.purposeMatch.high': p => `مطابقة الغرض عالية (${p.score}/100)`,
    'strengths.preferenceMatch.high': p => `مطابقة التفضيلات عالية (${p.score}/100)`,
    'strengths.flight.direct': () => 'رحلة مباشرة بدون توقفات',
    'strengths.cancellation.free': () => 'إلغاء مجاني متاح',
    'strengths.rating.high': p => `تقييم عالي (${p.rating}/5)`,
    'weaknesses.price.low': p => `السعر ضعيف (${p.score}/100)`,
    'weaknesses.comfort.low': p => `مستوى الراحة منخفض (${p.score}/100)`,
    'weaknesses.travelTime.low': p => `وقت السفر طويل (${p.score}/100)`,
    'weaknesses.familySuitability.low': p => `ملاءمة العائلة منخفضة (${p.score}/100)`,
    'weaknesses.luxury.low': p => `مستوى الفخامة منخفض (${p.score}/100)`,
    'weaknesses.destinationMatch.low': p => `مطابقة الوجهة ضعيفة (${p.score}/100)`,
    'weaknesses.purposeMatch.low': p => `مطابقة الغرض ضعيفة (${p.score}/100)`,
    'weaknesses.preferenceMatch.low': p => `مطابقة التفضيلات ضعيفة (${p.score}/100)`,
    'weaknesses.flight.multipleStops': p => `${p.stops} توقفات`,
    'weaknesses.cancellation.none': () => 'لا يوجد إلغاء مجاني',
    'weaknesses.family.notFriendly': () => 'غير مناسب للعائلات',
    'warning.overBudget': p => `يتجاوز الميزانية بـ ${p.amount} ${p.currency}`,
    'warning.nonRefundable': () => 'غير قابل للاسترداد',
    'warning.notFamilyFriendly': () => 'غير مناسب للأطفال',
    'warning.manyStopsWithKids': p => `${p.stops} توقفات مع أطفال قد تكون مرهقة`,
    'warning.lowRating': p => `تقييم منخفض (${p.rating}/5)`,
    'warning.noBaggage': () => 'لا يشمل الأمتعة',
    'warning.lowConfidence': p => `مستوى ثقة منخفض (${p.confidence}/100)`,
    'warning.lowComfort': p => `مستوى راحة منخفض (${p.score}/100)`,
  }
  return section.items
    .map(item => {
      const fmt = TEXT_MAP[item.key]
      return fmt ? fmt(item.params) : ''
    })
    .filter(s => s.length > 0)
}

function ExpandableRecommendationCardImpl({
  option,
  reasoning,
  report,
  rank,
  isCompareSelected,
  onToggleCompare,
  compareDisabled,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const stars = scoreToStars(report.overallScore)
  const starsDisp = formatStars(stars)
  const recKey = option.decisionScore?.recommendation ?? 'acceptable'
  const recColor = REC_COLORS[recKey] ?? REC_COLORS.acceptable
  const typeIcon = TYPE_ICONS[option.type] ?? '📋'
  const typeLabel = TYPE_LABELS[option.type] ?? option.type

  const strengths = useMemo(() => sectionToTexts(reasoning.strengths), [reasoning])
  const weaknesses = useMemo(() => sectionToTexts(reasoning.weaknesses), [reasoning])
  const risks = useMemo(() => sectionToTexts(reasoning.riskWarnings), [reasoning])
  const whyRecommends = useMemo(() => report.whyRahhalRecommends, [report])

  const STOCK_IMAGES: Record<string, string> = {
    flight: 'https://images.pexels.com/photos/2026324/pexels-photo-2026324.jpeg?auto=compress&cs=tinysrgb&w=600',
    hotel: 'https://images.pexels.com/photos/2026324/pexels-photo-2026324.jpeg?auto=compress&cs=tinysrgb&w=600',
    activity: 'https://images.pexels.com/photos/2026324/pexels-photo-2026324.jpeg?auto=compress&cs=tinysrgb&w=600',
    transportation: 'https://images.pexels.com/photos/2026324/pexels-photo-2026324.jpeg?auto=compress&cs=tinysrgb&w=600',
  }
  const image = STOCK_IMAGES[option.type] ?? STOCK_IMAGES.flight

  return (
    <article
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
      aria-labelledby={`rec-title-${option.id}`}
    >
      {/* Collapsed view */}
      <div className="flex flex-col gap-0 sm:flex-row">
        {/* Image */}
        <div className="relative h-32 shrink-0 overflow-hidden sm:h-auto sm:w-40">
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            aria-hidden
          />
          <div className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-bold ${recColor.bg} ${recColor.text} ${recColor.border}`}>
            #{rank}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm" aria-hidden>{typeIcon}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{typeLabel}</span>
              </div>
              <h3 id={`rec-title-${option.id}`} className="truncate text-sm font-bold text-slate-900">
                {option.title}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm tracking-wider text-amber-400" dir="rtl" aria-label={`${stars.label}`}>
                  {starsDisp.visual}
                </span>
                <span className="text-[10px] text-slate-400">{stars.label}</span>
              </div>
            </div>
            <div className="shrink-0 text-left">
              <p className="text-base font-bold text-slate-900" dir="ltr">
                {option.price.toLocaleString()} {option.currency}
              </p>
              <p className="text-[10px] text-slate-400">السعر الإجمالي</p>
            </div>
          </div>

          {/* Match badge */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-500">التطابق الإجمالي</span>
              <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${recColor.bg} ${recColor.text}`} dir="ltr">
                {report.overallScore}%
              </span>
            </div>
            {option.rating !== null && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">التقييم</span>
                <span className="text-xs font-bold text-slate-600" dir="ltr">{option.rating}/5</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all duration-200 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              aria-expanded={expanded}
              aria-controls={`rec-detail-${option.id}`}
            >
              <span>{expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
              <svg
                viewBox="0 0 24 24"
                className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onToggleCompare(option.id)}
              disabled={compareDisabled && !isCompareSelected}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/20 disabled:cursor-not-allowed disabled:opacity-40 ${
                isCompareSelected
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-600'
              }`}
              aria-pressed={isCompareSelected}
            >
              {isCompareSelected ? '✓ في المقارنة' : '≡ قارن'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div
          id={`rec-detail-${option.id}`}
          className="border-t border-slate-100 p-4"
          role="region"
          aria-label={`تفاصيل ${option.title}`}
        >
          <div className="space-y-4">
            {/* Why Rahhal recommends it */}
            <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary-700">
                <span aria-hidden>🤖</span> لماذا يوصي به رحّال
              </p>
              <ul className="space-y-1">
                {whyRecommends.map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-0.5 text-primary-400">•</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                <p className="mb-2 text-xs font-bold text-emerald-700">✓ نقاط القوة</p>
                {strengths.length > 0 ? (
                  <ul className="space-y-1">
                    {strengths.map((text, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="mt-0.5 text-emerald-500">✓</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">لا توجد نقاط قوة بارزة</p>
                )}
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-3">
                <p className="mb-2 text-xs font-bold text-rose-700">✗ نقاط الضعف</p>
                {weaknesses.length > 0 ? (
                  <ul className="space-y-1">
                    {weaknesses.map((text, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="mt-0.5 text-rose-400">✗</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">لا توجد نقاط ضعف بارزة</p>
                )}
              </div>
            </div>

            {/* Trade-offs / Risks */}
            {risks.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                <p className="mb-2 text-xs font-bold text-amber-700">⚠ التنازلات والمخاطر</p>
                <ul className="space-y-1">
                  {risks.map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="mt-0.5 text-amber-500">⚠</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suitable for / Not suitable for */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="mb-2 text-xs font-bold text-slate-700">✓ مناسب لـ</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.bestSuitedFor.map((text, i) => (
                    <span key={i} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-600">
                      {text}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="mb-2 text-xs font-bold text-slate-700">✗ غير مناسب لـ</p>
                <p className="text-[10px] leading-relaxed text-slate-500">
                  {report.whyNotOthers || 'لا توجد ملاحظات سلبية محددة'}
                </p>
              </div>
            </div>

            {/* Score breakdown */}
            <div>
              <p className="mb-3 text-xs font-bold text-slate-700">📊 تفصيل النقاط</p>
              <ScoreBreakdownCard option={option} reasoning={reasoning} />
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export const ExpandableRecommendationCard = memo(ExpandableRecommendationCardImpl)
