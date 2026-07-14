import { useState, useMemo } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { OptionReport } from '../utils/reportFormatter'
import { buildFullReport, scoreToStars, formatStars } from '../utils/reportFormatter'

type SortKey = 'best' | 'price-low' | 'fastest' | 'comfort' | 'value'
type BadgeType = 'best' | 'value' | 'fastest' | 'family' | 'business'

const SORT_LABELS: Record<SortKey, string> = {
  'best': 'أفضل توصية',
  'price-low': 'الأقل سعراً',
  'fastest': 'الأسرع',
  'comfort': 'الأعلى راحة',
  'value': 'أفضل قيمة',
}

const BADGE_CONFIG: Record<BadgeType, { icon: string; label: string; color: string }> = {
  best: { icon: '⭐', label: 'أفضل اختيار', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  value: { icon: '💰', label: 'أفضل قيمة', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  fastest: { icon: '⚡', label: 'الأسرع', color: 'text-sky-700 bg-sky-100 border-sky-200' },
  family: { icon: '👨‍👩‍👧', label: 'مناسب للعائلة', color: 'text-violet-700 bg-violet-100 border-violet-200' },
  business: { icon: '💼', label: 'مناسب للأعمال', color: 'text-slate-700 bg-slate-100 border-slate-200' },
}

const AIRLINE_CODE_MAP: Record<string, string> = {
  JAL: 'JL',
  'Qatar Airways': 'QR',
  Saudia: 'SV',
}

function airlineCode(name: string): string {
  return AIRLINE_CODE_MAP[name] ?? name.slice(0, 2).toUpperCase()
}

function airlineColor(code: string): string {
  const colors = ['bg-rose-500', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'text-violet-500 bg-violet-500']
  const idx = code.charCodeAt(0) % colors.length
  return colors[idx]
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}س ${m}د` : `${h}س`
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  const match = iso.match(/T(\d{2}):(\d{2})/)
  if (!match) return '—'
  return `${match[1]}:${match[2]}`
}

function stopsLabel(stops: number | null): string {
  if (stops === null) return '—'
  if (stops === 0) return 'مباشر'
  if (stops === 1) return 'توقف واحد'
  return `${stops} توقفات`
}

interface FilterState {
  maxPrice: number | null
  maxDuration: number | null
  maxStops: number | null
  departureWindow: 'any' | 'morning' | 'afternoon' | 'evening'
  arrivalWindow: 'any' | 'morning' | 'afternoon' | 'evening'
  airline: string | null
  recType: string | null
}

function inWindow(iso: string | undefined, window: 'morning' | 'afternoon' | 'evening'): boolean {
  if (!iso) return false
  const match = iso.match(/T(\d{2}):/)
  if (!match) return false
  const h = parseInt(match[1], 10)
  if (window === 'morning') return h >= 5 && h < 12
  if (window === 'afternoon') return h >= 12 && h < 18
  return h >= 18 || h < 5
}

function determineBadges(
  option: NormalizedTravelOption,
  allOptions: NormalizedTravelOption[],
): BadgeType[] {
  const badges: BadgeType[] = []
  const topScore = Math.max(...allOptions.map(o => o.decisionScore?.weightedAverage ?? 0))
  if ((option.decisionScore?.weightedAverage ?? 0) === topScore) badges.push('best')

  const minPrice = Math.min(...allOptions.map(o => o.price))
  if (option.price === minPrice) badges.push('value')

  const flights = allOptions.filter(o => o.type === 'flight')
  if (flights.length > 0 && option.type === 'flight') {
    const minDuration = Math.min(...flights.map(o => o.durationMinutes ?? Infinity))
    if (option.durationMinutes === minDuration) badges.push('fastest')
  }

  if (option.familyFriendly === true) badges.push('family')
  const cabin = String(option.attributes.cabin ?? '')
  if (cabin === 'business' || cabin === 'first') badges.push('business')

  return badges
}

function sortOptions(
  options: NormalizedTravelOption[],
  sortKey: SortKey,
): NormalizedTravelOption[] {
  const sorted = [...options]
  switch (sortKey) {
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price)
    case 'fastest':
      return sorted.sort((a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity))
    case 'comfort':
      return sorted.sort((a, b) =>
        (b.decisionScore?.categories.find(c => c.category === 'comfort')?.score ?? 0) -
        (a.decisionScore?.categories.find(c => c.category === 'comfort')?.score ?? 0)
      )
    case 'value':
      return sorted.sort((a, b) => {
        const aScore = a.decisionScore?.weightedAverage ?? 0
        const bScore = b.decisionScore?.weightedAverage ?? 0
        const aValue = aScore / Math.max(a.price, 1)
        const bValue = bScore / Math.max(b.price, 1)
        return bValue - aValue
      })
    case 'best':
    default:
      return sorted.sort((a, b) =>
        (b.decisionScore?.weightedAverage ?? 0) - (a.decisionScore?.weightedAverage ?? 0)
      )
  }
}

interface FlightCardProps {
  option: NormalizedTravelOption
  badges: BadgeType[]
}

function FlightCard({ option, badges }: FlightCardProps) {
  const airline = String(option.attributes.airline ?? '—')
  const flightNumber = String(option.attributes.flightNumber ?? '')
  const code = airlineCode(airline)

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-200">
      <div className="flex items-stretch">
        {/* Airline logo placeholder */}
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-50 bg-slate-50/50 sm:w-20">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white ${airlineColor(code)}`}>
            {code}
          </div>
          <span className="hidden text-[9px] font-medium text-slate-400 sm:block">{airline}</span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {flightNumber && (
                <span className="text-[11px] font-bold text-slate-400">{flightNumber}</span>
              )}
              <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">{option.title}</h3>
            </div>
            <div className="shrink-0 text-left">
              <p className="text-base font-bold text-primary-600">
                {option.price.toLocaleString()} {option.currency}
              </p>
              {option.rating !== null && (
                <p className="text-[10px] font-medium text-amber-500">★ {option.rating}</p>
              )}
            </div>
          </div>

          {/* Times row */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <div className="flex flex-col items-center">
              <span className="font-bold text-slate-700">{formatTime(String(option.attributes.departureTime))}</span>
              <span className="text-[9px] text-slate-400">{String(option.attributes.origin ?? '')}</span>
            </div>
            <div className="flex flex-1 flex-col items-center">
              <span className="text-[10px] font-medium text-slate-500">{formatDuration(option.durationMinutes)}</span>
              <div className="my-0.5 h-px w-full bg-slate-200" />
              <span className="text-[9px] text-slate-400">{stopsLabel(option.stops)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-slate-700">{formatTime(String(option.attributes.arrivalTime))}</span>
              <span className="text-[9px] text-slate-400">{String(option.attributes.destination ?? '')}</span>
            </div>
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {badges.map(b => {
                const cfg = BADGE_CONFIG[b]
                return (
                  <span
                    key={b}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cfg.color}`}
                  >
                    <span>{cfg.icon}</span>
                    {cfg.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

interface NonFlightCardProps {
  option: NormalizedTravelOption
  badges: BadgeType[]
}

function NonFlightCard({ option, badges }: NonFlightCardProps) {
  const typeLabel = option.type === 'hotel' ? 'فندق' : option.type === 'activity' ? 'نشاط' : 'مواصلات'
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-200">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{typeLabel}</span>
            <h3 className="mt-1 truncate text-sm font-bold text-slate-900">{option.title}</h3>
            {option.location && <p className="mt-0.5 text-[10px] text-slate-400">{option.location}</p>}
          </div>
          <div className="shrink-0 text-left">
            <p className="text-base font-bold text-primary-600">
              {option.price.toLocaleString()} {option.currency}
            </p>
            {option.rating !== null && (
              <p className="text-[10px] font-medium text-amber-500">★ {option.rating}</p>
            )}
          </div>
        </div>
        {option.durationMinutes !== null && (
          <p className="mt-2 text-[11px] text-slate-500">المدة: {formatDuration(option.durationMinutes)}</p>
        )}
        {badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {badges.map(b => {
              const cfg = BADGE_CONFIG[b]
              return (
                <span
                  key={b}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cfg.color}`}
                >
                  <span>{cfg.icon}</span>
                  {cfg.label}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}

interface RahhalPanelProps {
  bestOption: NormalizedTravelOption
  report: OptionReport
  allOptions: NormalizedTravelOption[]
}

function RahhalRecommendationPanel({ bestOption, report, allOptions }: RahhalPanelProps) {
  const confidence = bestOption.decisionScore?.confidence ?? 0
  const confidenceStars = scoreToStars(confidence)
  const { visual, label } = formatStars(confidenceStars)

  const lowerOptions = allOptions.filter(o => o.id !== bestOption.id)
  const avgLowerPrice = lowerOptions.length > 0
    ? lowerOptions.reduce((sum, o) => sum + o.price, 0) / lowerOptions.length
    : 0
  const savings = avgLowerPrice > 0
    ? Math.round(((avgLowerPrice - bestOption.price) / avgLowerPrice) * 100)
    : 0

  const scoreAdvantage = lowerOptions.length > 0
    ? (bestOption.decisionScore?.weightedAverage ?? 0) - Math.max(...lowerOptions.map(o => o.decisionScore?.weightedAverage ?? 0))
    : 0

  return (
    <div className="overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-bl from-primary-50/40 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-base">ر</span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">توصية رحّال</h2>
          <p className="text-[10px] text-slate-400">تحليل مبني على درجة القرار</p>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
            {report.typeLabel}
          </span>
          <h3 className="mt-1.5 text-base font-bold text-slate-900">{bestOption.title}</h3>
          <p className="mt-0.5 text-sm font-bold text-primary-600">
            {bestOption.price.toLocaleString()} {bestOption.currency}
          </p>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-3xl font-bold text-primary-600">{report.overallScore}</p>
          <p className="text-[10px] font-medium text-slate-400">/100</p>
        </div>
      </div>

      {/* Confidence */}
      <div className="mt-4 rounded-xl bg-white/60 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">مستوى الثقة</span>
          <div className="flex items-center gap-2">
            <span className="text-sm tracking-wider text-amber-400" dir="rtl">{visual}</span>
            <span className="text-xs font-bold text-slate-600">{label}</span>
          </div>
        </div>
      </div>

      {/* Why selected */}
      {report.whyRahhalRecommends.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 text-xs font-bold text-slate-700">لماذا اختار رحّال هذا الخيار؟</h4>
          <div className="space-y-1">
            {report.whyRahhalRecommends.slice(0, 3).map((text, i) => (
              <p key={i} className="text-xs leading-relaxed text-slate-600">• {text}</p>
            ))}
          </div>
        </div>
      )}

      {/* Estimated savings */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/60 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-400">التوفير التقديري</p>
          <p className="mt-0.5 text-sm font-bold text-emerald-600">
            {savings > 0 ? `${savings}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-white/60 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-400">تفوّق في التقييم</p>
          <p className="mt-0.5 text-sm font-bold text-primary-600">
            {scoreAdvantage > 0 ? `+${scoreAdvantage} نقطة` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

interface FiltersProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  options: NormalizedTravelOption[]
}

function FilterBar({ filters, onChange, options }: FiltersProps) {
  const airlines = useMemo(() => {
    const set = new Set<string>()
    options.forEach(o => {
      const a = o.attributes.airline
      if (typeof a === 'string' && a) set.add(a)
    })
    return Array.from(set).sort()
  }, [options])

  const recTypes = useMemo(() => {
    const set = new Set<string>()
    options.forEach(o => {
      if (o.recommendationLevel) set.add(o.recommendationLevel)
    })
    return Array.from(set)
  }, [options])

  const priceMax = useMemo(() => Math.max(...options.map(o => o.price)), [options])
  const durationMax = useMemo(() => Math.max(...options.map(o => o.durationMinutes ?? 0)), [options])

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-sm">🔍</span>
        <h3 className="text-xs font-bold text-slate-700">تصفية ذكية</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Price */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">السعر الأقصى</label>
          <input
            type="range"
            min={0}
            max={priceMax}
            step={100}
            value={filters.maxPrice ?? priceMax}
            onChange={e => update({ maxPrice: parseInt(e.target.value, 10) })}
            className="mt-1 w-full accent-primary-500"
          />
          <p className="text-[10px] text-slate-500">
            {filters.maxPrice !== null ? `${filters.maxPrice.toLocaleString()} ${options[0]?.currency ?? ''}` : 'الكل'}
          </p>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">أقصى مدة (ساعات)</label>
          <input
            type="range"
            min={0}
            max={Math.ceil(durationMax / 60)}
            step={1}
            value={filters.maxDuration ? Math.ceil(filters.maxDuration / 60) : Math.ceil(durationMax / 60)}
            onChange={e => update({ maxDuration: parseInt(e.target.value, 10) * 60 })}
            className="mt-1 w-full accent-primary-500"
          />
          <p className="text-[10px] text-slate-500">
            {filters.maxDuration ? `${Math.ceil(filters.maxDuration / 60)}س` : 'الكل'}
          </p>
        </div>

        {/* Stops */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">التوقفات</label>
          <select
            value={filters.maxStops ?? ''}
            onChange={e => update({ maxStops: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 focus:border-primary-400 focus:outline-none"
          >
            <option value="">الكل</option>
            <option value="0">مباشر فقط</option>
            <option value="1">توقف واحد كحد أقصى</option>
          </select>
        </div>

        {/* Departure time */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">وقت المغادرة</label>
          <select
            value={filters.departureWindow}
            onChange={e => update({ departureWindow: e.target.value as FilterState['departureWindow'] })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 focus:border-primary-400 focus:outline-none"
          >
            <option value="any">الكل</option>
            <option value="morning">صباحاً</option>
            <option value="afternoon">ظهيرة</option>
            <option value="evening">مساءً</option>
          </select>
        </div>

        {/* Arrival time */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">وقت الوصول</label>
          <select
            value={filters.arrivalWindow}
            onChange={e => update({ arrivalWindow: e.target.value as FilterState['arrivalWindow'] })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 focus:border-primary-400 focus:outline-none"
          >
            <option value="any">الكل</option>
            <option value="morning">صباحاً</option>
            <option value="afternoon">ظهيرة</option>
            <option value="evening">مساءً</option>
          </select>
        </div>

        {/* Airline */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">شركة الطيران</label>
          <select
            value={filters.airline ?? ''}
            onChange={e => update({ airline: e.target.value === '' ? null : e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 focus:border-primary-400 focus:outline-none"
          >
            <option value="">الكل</option>
            {airlines.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Recommendation type */}
        <div>
          <label className="text-[10px] font-medium text-slate-400">نوع التوصية</label>
          <select
            value={filters.recType ?? ''}
            onChange={e => update({ recType: e.target.value === '' ? null : e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 focus:border-primary-400 focus:outline-none"
          >
            <option value="">الكل</option>
            {recTypes.map(r => (
              <option key={r} value={r}>
                {r === 'excellent' ? 'ممتاز' : r === 'recommended' ? 'موصى به' : r === 'acceptable' ? 'مقبول' : 'غير موصى به'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onChange({ maxPrice: null, maxDuration: null, maxStops: null, departureWindow: 'any', arrivalWindow: 'any', airline: null, recType: null })}
          className="text-[11px] font-medium text-slate-400 hover:text-primary-600"
        >
          مسح التصفية
        </button>
      </div>
    </div>
  )
}

interface Props {
  rankedOptions: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
}

export default function ResultsExperience({ rankedOptions, reasoningResults }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('best')
  const [filters, setFilters] = useState<FilterState>({
    maxPrice: null,
    maxDuration: null,
    maxStops: null,
    departureWindow: 'any',
    arrivalWindow: 'any',
    airline: null,
    recType: null,
  })

  const reports = useMemo(
    () => buildFullReport(rankedOptions, reasoningResults),
    [rankedOptions, reasoningResults]
  )

  const filtered = useMemo(() => {
    let result = [...rankedOptions]
    if (filters.maxPrice !== null) result = result.filter(o => o.price <= filters.maxPrice!)
    if (filters.maxDuration !== null) result = result.filter(o => o.durationMinutes === null || o.durationMinutes <= filters.maxDuration!)
    if (filters.maxStops !== null) result = result.filter(o => o.stops === null || o.stops <= filters.maxStops!)
    if (filters.departureWindow !== 'any') result = result.filter(o => inWindow(String(o.attributes.departureTime), filters.departureWindow as 'morning' | 'afternoon' | 'evening'))
    if (filters.arrivalWindow !== 'any') result = result.filter(o => inWindow(String(o.attributes.arrivalTime), filters.arrivalWindow as 'morning' | 'afternoon' | 'evening'))
    if (filters.airline) result = result.filter(o => o.attributes.airline === filters.airline)
    if (filters.recType) result = result.filter(o => o.recommendationLevel === filters.recType)
    return sortOptions(result, sortKey)
  }, [rankedOptions, filters, sortKey])

  const bestOption = rankedOptions[0]
  const bestReport = reports[0]

  if (!bestOption || !bestReport) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏆</span>
        <h2 className="text-base font-bold text-slate-900">نتائج رحّال</h2>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5">
        <p className="text-xs font-medium text-amber-700">
          بيانات تجريبية — لم يتم ربط مزودي السفر بعد
        </p>
      </div>

      {/* Rahhal Recommendation Panel */}
      <RahhalRecommendationPanel bestOption={bestOption} report={bestReport} allOptions={rankedOptions} />

      {/* Sort bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs font-medium text-slate-400">ترتيب:</span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 ${
              sortKey === key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} options={rankedOptions} />

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {filtered.length} من {rankedOptions.length} خيار
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-400">لا توجد نتائج مطابقة للتصفية</p>
          </div>
        ) : (
          filtered.map(option => {
            const badges = determineBadges(option, rankedOptions)
            if (option.type === 'flight') {
              return <FlightCard key={option.id} option={option} badges={badges} />
            }
            return <NonFlightCard key={option.id} option={option} badges={badges} />
          })
        )}
      </div>
    </div>
  )
}
