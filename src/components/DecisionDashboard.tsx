import { useMemo, useState } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { TravelSearchRequest } from '../utils/travelSearchRequest'
import { buildFullReport, scoreToStars, formatStars } from '../utils/reportFormatter'

const PURPOSE_LABELS: Record<string, string> = {
  family: 'عائلية',
  honeymoon: 'شهر عسل',
  business: 'عمل',
  vacation: 'سياحة',
  adventure: 'مغامرة',
}

const CABIN_LABELS: Record<string, string> = {
  economy: 'اقتصادية',
  'premium-economy': 'اقتصادية محسّنة',
  business: 'رجال أعمال',
  first: 'درجة أولى',
}

const COMFORT_LABELS: Record<string, string> = {
  direct: 'مباشر',
  'direct-preferred': 'تفضيل مباشر',
  'direct-only': 'مباشر فقط',
  any: 'أي رحلة',
}

function getCategoryScore(option: NormalizedTravelOption, cat: string): number {
  return option.decisionScore?.categories.find(c => c.category === cat)?.score ?? 0
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}س ${m}د` : `${h}س`
}

function stopsLabel(stops: number | null): string {
  if (stops === null) return '—'
  if (stops === 0) return 'مباشر'
  if (stops === 1) return 'توقف واحد'
  return `${stops} توقفات`
}

function calcSavings(best: NormalizedTravelOption, others: NormalizedTravelOption[]): number {
  if (others.length === 0) return 0
  const avg = others.reduce((s, o) => s + o.price, 0) / others.length
  if (avg <= 0) return 0
  return Math.round(((avg - best.price) / avg) * 100)
}

function calcTimeSaved(best: NormalizedTravelOption, others: NormalizedTravelOption[]): number {
  const flights = others.filter(o => o.type === 'flight' && o.durationMinutes !== null)
  if (flights.length === 0 || best.durationMinutes === null) return 0
  const avgDuration = flights.reduce((s, o) => s + (o.durationMinutes ?? 0), 0) / flights.length
  const saved = Math.round(avgDuration - best.durationMinutes)
  return saved > 0 ? saved : 0
}

interface AdviceCard {
  icon: string
  text: string
}

function generateAdvice(
  best: NormalizedTravelOption,
  others: NormalizedTravelOption[],
  req: TravelSearchRequest,
): AdviceCard[] {
  const cards: AdviceCard[] = []

  const timeScore = getCategoryScore(best, 'travelTime')
  const priceScore = getCategoryScore(best, 'price')
  const comfortScore = getCategoryScore(best, 'comfort')
  const familyScore = getCategoryScore(best, 'familySuitability')

  if (best.type === 'flight' && best.stops === 0 && others.some(o => o.stops !== null && o.stops > 0)) {
    const cheaper = others.find(o => o.price < best.price && o.stops !== null && o.stops > 0)
    if (cheaper) {
      const diff = best.price - cheaper.price
      cards.push({
        icon: '✓',
        text: `دفع مبلغ أعلى قليلاً (${diff.toLocaleString()} ${best.currency}) يوفر رحلة مباشرة.`,
      })
    }
  }

  if (familyScore >= 75 && req.travelers.children > 0) {
    cards.push({
      icon: '✓',
      text: 'هذا الخيار الأفضل للعائلات من حيث ملاءمة الأطفال والمرافق.',
    })
  }

  if (timeScore >= 75 && priceScore < timeScore) {
    cards.push({
      icon: '✓',
      text: 'هذا الخيار يوفّر وقتاً أكثر من المال — مثالي لمن يقدّر الوقت.',
    })
  }

  if (priceScore >= 80 && comfortScore < priceScore) {
    cards.push({
      icon: '✓',
      text: 'أفضل قيمة من حيث السعر مع مستوى مقبول من الراحة.',
    })
  }

  if (comfortScore >= 80) {
    cards.push({
      icon: '✓',
      text: 'مستوى راحة عالي يجعل الرحلة أقل إرهاقاً.',
    })
  }

  if (cards.length < 3) {
    const topScore = best.decisionScore?.weightedAverage ?? 0
    cards.push({
      icon: '✓',
      text: `خيار متوازن بنتيجة ${topScore}/100 يلبي أولوياتك الأساسية.`,
    })
  }

  return cards.slice(0, 3)
}

function ScoreWheel({ score, size = 140 }: { score: number; size?: number }) {
  const stars = scoreToStars(score)
  const { visual, label } = formatStars(stars)
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const colorClass =
    score >= 90 ? 'text-amber-400' :
    score >= 75 ? 'text-emerald-400' :
    score >= 60 ? 'text-sky-400' :
    'text-rose-400'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={8}
            className="stroke-slate-100"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${colorClass} transition-all duration-700`}
            stroke="currentColor"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colorClass}`}>{score}</span>
          <span className="text-[10px] font-medium text-slate-400">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm tracking-wider text-amber-400" dir="rtl">{visual}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-600">{label}</p>
      </div>
    </div>
  )
}

interface TripSnapshotProps {
  req: TravelSearchRequest
}

function TripSnapshot({ req }: TripSnapshotProps) {
  const items = [
    { label: 'الوجهة', value: req.destination || '—', icon: '📍' },
    { label: 'المدة', value: req.durationDays > 0 ? `${req.durationDays} أيام` : '—', icon: '📅' },
    { label: 'الميزانية', value: req.budgetAmount > 0 ? `${req.budgetAmount.toLocaleString()} ${req.budgetCurrency}` : '—', icon: '💰' },
    { label: 'المسافرون', value: req.travelers.total > 0 ? `${req.travelers.total} (${req.travelers.adults} بالغ${req.travelers.children > 0 ? `، ${req.travelers.children} طفل` : ''})` : '—', icon: '👥' },
    { label: 'مدينة المغادرة', value: req.departureCity || '—', icon: '🛫' },
    { label: 'تاريخ السفر', value: req.departureDate || '—', icon: '🗓️' },
    { label: 'الغرض', value: PURPOSE_LABELS[req.travelPurpose] ?? '—', icon: '🎯' },
    { label: 'تفضيل الراحة', value: CABIN_LABELS[req.preferredCabin] ?? COMFORT_LABELS[req.directFlightPreferred] ?? '—', icon: '✈️' },
  ]

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm">📋</span>
        <h3 className="text-sm font-bold text-slate-900">ملخّص الرحلة</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl bg-slate-50/60 px-3 py-2.5">
            <div className="flex items-center gap-1">
              <span className="text-xs">{item.icon}</span>
              <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ComparisonProps {
  top3: NormalizedTravelOption[]
}

function ComparisonTable({ top3 }: ComparisonProps) {
  const rows = [
    { label: 'السعر', get: (o: NormalizedTravelOption) => `${o.price.toLocaleString()} ${o.currency}` },
    { label: 'المدة', get: (o: NormalizedTravelOption) => formatDuration(o.durationMinutes) },
    { label: 'التوقفات', get: (o: NormalizedTravelOption) => stopsLabel(o.stops) },
    { label: 'الراحة', get: (o: NormalizedTravelOption) => {
      const s = getCategoryScore(o, 'comfort')
      const stars = scoreToStars(s)
      return `${stars.stars}★ ${stars.label}`
    }},
    { label: 'القيمة', get: (o: NormalizedTravelOption) => {
      const s = o.decisionScore?.weightedAverage ?? 0
      const stars = scoreToStars(s)
      return `${stars.stars}★ ${stars.label}`
    }},
    { label: 'التوصية', get: (o: NormalizedTravelOption) => {
      const r = o.recommendationLevel
      if (r === 'excellent') return 'ممتاز'
      if (r === 'recommended') return 'موصى به'
      if (r === 'acceptable') return 'مقبول'
      return 'غير موصى به'
    }},
  ]

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm">⚖️</span>
        <h3 className="text-sm font-bold text-slate-900">مقارنة أفضل 3 خيارات</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="py-2.5 pr-2 text-right font-medium text-slate-400">المعيار</th>
              {top3.map((opt, i) => (
                <th key={opt.id} className="px-2 py-2.5 text-center">
                  <div className={`rounded-lg px-2 py-1 ${i === 0 ? 'bg-primary-50 ring-1 ring-primary-200' : ''}`}>
                    <p className={`text-[10px] font-bold ${i === 0 ? 'text-primary-700' : 'text-slate-500'}`}>
                      {i === 0 ? '🏆 الفائز' : `خيار ${i + 1}`}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-400 line-clamp-1 max-w-[120px]">{opt.title}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5 pr-2 text-right font-medium text-slate-400">{row.label}</td>
                {top3.map((opt, i) => (
                  <td key={opt.id} className={`px-2 py-2.5 text-center font-bold ${i === 0 ? 'text-primary-700' : 'text-slate-600'}`}>
                    {row.get(opt)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface Props {
  rankedOptions: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
  searchRequest: TravelSearchRequest
}

export default function DecisionDashboard({ rankedOptions, reasoningResults, searchRequest }: Props) {
  const [confirmed, setConfirmed] = useState(false)

  const reports = useMemo(
    () => buildFullReport(rankedOptions, reasoningResults),
    [rankedOptions, reasoningResults]
  )

  if (rankedOptions.length === 0) return null

  const best = rankedOptions[0]
  const bestReport = reports[0]
  const others = rankedOptions.slice(1)
  const top3 = rankedOptions.slice(0, 3)

  if (!bestReport) return null

  const confidence = best.decisionScore?.confidence ?? 0
  const confidenceStars = scoreToStars(confidence)
  const { visual: confVisual, label: confLabel } = formatStars(confidenceStars)

  const moneySaved = calcSavings(best, others)
  const timeSaved = calcTimeSaved(best, others)
  const timeSavedHours = Math.floor(timeSaved / 60)
  const timeSavedMin = timeSaved % 60

  const advice = generateAdvice(best, others, searchRequest)

  return (
    <div className="space-y-4">
      {/* Section title */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🎯</span>
        <h2 className="text-base font-bold text-slate-900">لوحة قرار بيلامو</h2>
      </div>

      {/* AI Decision Summary + Score Wheel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-primary-100 bg-gradient-to-bl from-primary-50/40 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-base">ر</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ملخص قرار الذكاء الاصطناعي</h3>
              <p className="text-[10px] text-slate-400">بناءً على تحليل تفضيلاتك</p>
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                {bestReport.typeLabel}
              </span>
              <h4 className="mt-1.5 text-base font-bold text-slate-900">{best.title}</h4>
              <p className="mt-0.5 text-sm font-bold text-primary-600">
                {best.price.toLocaleString()} {best.currency}
              </p>
            </div>
          </div>

          {/* Why chosen */}
          {bestReport.whyRahhalRecommends.length > 0 && (
            <div className="mt-3">
              <h5 className="mb-1.5 text-xs font-bold text-slate-700">لماذا اختار بيلامو هذا الخيار؟</h5>
              <div className="space-y-1">
                {bestReport.whyRahhalRecommends.slice(0, 3).map((text, i) => (
                  <p key={i} className="text-xs leading-relaxed text-slate-600">• {text}</p>
                ))}
              </div>
            </div>
          )}

          {/* Savings */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/70 px-4 py-3">
              <p className="text-[10px] font-medium text-slate-400">التوفير التقديري</p>
              <p className="mt-1 text-lg font-bold text-emerald-600">
                {moneySaved > 0 ? `${moneySaved}%` : '—'}
              </p>
              <p className="text-[9px] text-slate-400">مقارنة بالخيارات الأقل ترتيباً</p>
            </div>
            <div className="rounded-xl bg-white/70 px-4 py-3">
              <p className="text-[10px] font-medium text-slate-400">وقت موفّر</p>
              <p className="mt-1 text-lg font-bold text-sky-600">
                {timeSaved > 0 ? `${timeSavedHours > 0 ? `${timeSavedHours}س ` : ''}${timeSavedMin > 0 ? `${timeSavedMin}د` : ''}`.trim() : '—'}
              </p>
              <p className="text-[9px] text-slate-400">مقارنة بمتوسط الخيارات</p>
            </div>
          </div>

          {/* Confidence */}
          <div className="mt-3 rounded-xl bg-white/70 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">مستوى الثقة</span>
              <div className="flex items-center gap-2">
                <span className="text-sm tracking-wider text-amber-400" dir="rtl">{confVisual}</span>
                <span className="text-xs font-bold text-slate-600">{confLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Score Wheel */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <h3 className="text-sm font-bold text-slate-900">درجة القرار</h3>
          </div>
          <div className="flex flex-col items-center justify-center py-4">
            <ScoreWheel score={best.decisionScore?.weightedAverage ?? 0} />
          </div>
        </div>
      </div>

      {/* Trip Snapshot */}
      <TripSnapshot req={searchRequest} />

      {/* AI Advice */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm">💡</span>
          <h3 className="text-sm font-bold text-slate-900">نصائح بيلامو</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {advice.map((card, i) => (
            <div key={i} className="rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-primary-600">{card.icon}</span>
                <p className="text-xs leading-relaxed text-slate-600">{card.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison */}
      <ComparisonTable top3={top3} />

      {/* Final Decision Button */}
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-bl from-primary-50/30 to-white p-5 text-center shadow-sm">
        {confirmed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">✓</span>
              <p className="text-sm font-bold text-emerald-600">تم اعتماد الرحلة</p>
            </div>
            <p className="text-xs text-slate-400">
              {best.title} — {best.price.toLocaleString()} {best.currency}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              راجعت لوحة القرار؟ اعتمد رحلتك المثالية الآن.
            </p>
            <button
              type="button"
              onClick={() => setConfirmed(true)}
              className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-primary-700 hover:shadow-md active:scale-95"
            >
              اعتمد هذه الرحلة
            </button>
          </>
        )}
      </div>
    </div>
  )
}
