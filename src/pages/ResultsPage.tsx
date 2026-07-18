import { useState, useMemo, useCallback, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { TravelSearchRequest } from '../utils/travelSearchRequest'
import { buildFullReport } from '../utils/reportFormatter'
import type { ScoreCategory } from '../utils/decisionScoreEngine'
import { ExpandableRecommendationCard } from '../components/ExpandableRecommendationCard'
import { InteractiveFilters } from '../components/InteractiveFilters'
import { DecisionConfidenceCard } from '../components/DecisionConfidenceCard'
import { ComparisonTable } from '../components/ComparisonTable'
import { PrintableReport } from '../components/PrintableReport'
import { toBookingSelectedItems } from '../lib/booking'

const ResultsExperience = lazy(() => import('../components/ResultsExperience'))
const DecisionDashboard = lazy(() => import('../components/DecisionDashboard'))

interface Props {
  rankedOptions: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
  searchRequest: TravelSearchRequest
  travelSessionId?: string | null
}

type ViewMode = 'cards' | 'comparison' | 'detailed'

function getScore(option: NormalizedTravelOption, cat: ScoreCategory): number {
  return option.decisionScore?.categories.find(c => c.category === cat)?.score ?? 0
}

function applyFilters(
  options: NormalizedTravelOption[],
  filters: Set<string>,
  searchRequest: TravelSearchRequest,
): NormalizedTravelOption[] {
  if (filters.size === 0) return options

  return options.filter(option => {
    for (const filterId of filters) {
      switch (filterId) {
        case 'budget':
          if (getScore(option, 'price') < 60) return false
          break
        case 'luxury':
          if (getScore(option, 'luxury') < 60) return false
          break
        case 'family':
          if (getScore(option, 'familySuitability') < 60) return false
          break
        case 'business':
          if (getScore(option, 'purposeMatch') < 60) return false
          break
        case 'adventure':
          if (!option.title.toLowerCase().includes('adventure') &&
              option.attributes.activityType !== 'adventure') return false
          break
        case 'beach':
          if (!option.location?.toLowerCase().includes('beach') &&
              !option.title.toLowerCase().includes('beach')) return false
          break
        case 'city':
          if (!option.location?.toLowerCase().includes('city') &&
              !option.title.toLowerCase().includes('city')) return false
          break
        case 'nature':
          if (!option.title.toLowerCase().includes('nature') &&
              !option.location?.toLowerCase().includes('nature')) return false
          break
        case 'culture':
          if (!option.title.toLowerCase().includes('culture') &&
              !option.location?.toLowerCase().includes('culture')) return false
          break
        case 'visa-friendly':
          if (searchRequest.destination && option.type === 'flight') {
            // visa filter only meaningful for destination-level; keep flights
          }
          break
        case 'weather':
          break
        case 'fastest':
          if (option.durationMinutes === null) return false
          if (option.durationMinutes > 600) return false
          break
        case 'shortest-flight':
          if (option.type !== 'flight') return false
          if (option.stops !== null && option.stops > 1) return false
          break
        case 'best-value':
          if ((option.decisionScore?.weightedAverage ?? 0) < 70) return false
          break
      }
    }
    return true
  })
}

export default function ResultsPage({
  rankedOptions,
  reasoningResults,
  searchRequest,
  travelSessionId = null,
}: Props) {
  const navigate = useNavigate()
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showPrintView, setShowPrintView] = useState(false)

  const reports = useMemo(
    () => buildFullReport(rankedOptions, reasoningResults),
    [rankedOptions, reasoningResults],
  )

  const filteredOptions = useMemo(
    () => applyFilters(rankedOptions, activeFilters, searchRequest),
    [rankedOptions, activeFilters, searchRequest],
  )

  const filteredReports = useMemo(
    () => reports.filter(r => filteredOptions.some(o => o.id === r.optionId)),
    [reports, filteredOptions],
  )

  const compareOptions = useMemo(
    () => rankedOptions.filter(o => compareIds.has(o.id)),
    [rankedOptions, compareIds],
  )

  const compareReports = useMemo(
    () => reports.filter(r => compareIds.has(r.optionId)),
    [reports, compareIds],
  )

  const handleToggleFilter = useCallback((id: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleClearFilters = useCallback(() => setActiveFilters(new Set()), [])

  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 3) return prev
        next.add(id)
      }
      return next
    })
  }, [])

  const handleRemoveFromCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleToggleBookingSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedOptions = useMemo(
    () => rankedOptions.filter(o => selectedIds.has(o.id)),
    [rankedOptions, selectedIds],
  )

  const handleContinueToBooking = useCallback(() => {
    if (selectedOptions.length === 0) return
    const currency =
      selectedOptions[0]?.currency || searchRequest.budgetCurrency || 'SAR'
    navigate('/booking/review', {
      state: {
        selectedItems: toBookingSelectedItems(selectedOptions),
        travelSessionId,
        currency,
      },
    })
  }, [navigate, searchRequest.budgetCurrency, selectedOptions, travelSessionId])

  const handlePrint = useCallback(() => {
    setShowPrintView(true)
    setTimeout(() => {
      window.print()
      setShowPrintView(false)
    }, 200)
  }, [])

  const viewModes: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'cards', label: 'بطاقات', icon: '📇' },
    { id: 'comparison', label: 'مقارنة', icon: '≡' },
    { id: 'detailed', label: 'تفصيلي', icon: '📋' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/30 via-white to-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">نتائج رحّال</h1>
                <p className="text-[10px] text-slate-400">{filteredOptions.length} خيار · {searchRequest.destination}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-all duration-200 hover:border-primary-200 hover:text-primary-600"
            aria-label="طباعة التقرير"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            <span>تصدير</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column — recommendations */}
          <div className="lg:col-span-8 xl:col-span-9 print:col-span-12">
            {/* Filters */}
            <div className="mb-4 print:hidden">
              <InteractiveFilters
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onClearAll={handleClearFilters}
              />
            </div>

            {/* View mode toggle */}
            <div className="mb-4 flex items-center justify-between print:hidden">
              <div className="flex gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
                {viewModes.map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                      viewMode === mode.id
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    aria-pressed={viewMode === mode.id}
                  >
                    <span aria-hidden>{mode.icon}</span>
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              {/* Compare counter */}
              {compareIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {compareIds.size}/3 في المقارنة
                  </span>
                  {viewMode !== 'comparison' && (
                    <button
                      type="button"
                      onClick={() => setViewMode('comparison')}
                      className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-600 hover:bg-primary-100"
                    >
                      عرض المقارنة
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content based on view mode */}
            {viewMode === 'cards' && (
              <div className="space-y-4 print:hidden">
                {filteredOptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                    <span className="text-3xl">🔍</span>
                    <p className="mt-2 text-sm text-slate-500">لا توجد نتائج مطابقة للمرشحات</p>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="mt-3 rounded-lg bg-primary-50 px-4 py-2 text-xs font-bold text-primary-600 hover:bg-primary-100"
                    >
                      مسح المرشحات
                    </button>
                  </div>
                ) : (
                  filteredOptions.map((option, i) => {
                    const reasoning = reasoningResults.get(option.id)
                    const report = filteredReports.find(r => r.optionId === option.id)
                    if (!reasoning || !report) return null
                    return (
                      <ExpandableRecommendationCard
                        key={option.id}
                        option={option}
                        reasoning={reasoning}
                        report={report}
                        rank={i + 1}
                        isCompareSelected={compareIds.has(option.id)}
                        onToggleCompare={handleToggleCompare}
                        compareDisabled={compareIds.size >= 3}
                        isBookingSelected={selectedIds.has(option.id)}
                        onToggleBookingSelect={handleToggleBookingSelect}
                      />
                    )
                  })
                )}
              </div>
            )}

            {viewMode === 'comparison' && (
              <div className="space-y-4 print:hidden">
                <ComparisonTable
                  options={compareOptions}
                  reasoningResults={reasoningResults}
                  reports={compareReports}
                  onRemove={handleRemoveFromCompare}
                />
                {compareOptions.length < 2 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 text-center">
                    <p className="text-xs text-amber-700">
                      اختر خيارين أو ثلاثة من بطاقات التوصيات للمقارنة
                    </p>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'detailed' && (
              <div className="space-y-6 print:hidden">
                <Suspense fallback={
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                  </div>
                }>
                  <ResultsExperience
                    rankedOptions={filteredOptions}
                    reasoningResults={reasoningResults}
                  />
                  <DecisionDashboard
                    rankedOptions={filteredOptions}
                    reasoningResults={reasoningResults}
                    searchRequest={searchRequest}
                  />
                </Suspense>
              </div>
            )}

            {/* Printable report */}
            {showPrintView && (
              <PrintableReport
                rankedOptions={filteredOptions}
                reasoningResults={reasoningResults}
                searchRequest={searchRequest}
              />
            )}
          </div>

          {/* Right column — confidence card */}
          <aside className="lg:col-span-4 xl:col-span-3 print:hidden">
            <div className="lg:sticky lg:top-20 space-y-4">
              <DecisionConfidenceCard
                rankedOptions={rankedOptions}
                reasoningResults={reasoningResults}
                searchRequest={searchRequest}
              />
              {selectedIds.size > 0 && (
                <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
                  <p className="text-sm font-bold text-primary-800">
                    {selectedIds.size} خيار محدد للحجز
                  </p>
                  <p className="mt-1 text-xs text-primary-700/80">
                    راجع اختياراتك ثم أكمل عبر التحويل أو الدفع في رحّال.
                  </p>
                  <button
                    type="button"
                    onClick={handleContinueToBooking}
                    className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
                  >
                    متابعة لمراجعة الحجز
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur print:hidden lg:hidden">
          <button
            type="button"
            onClick={handleContinueToBooking}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
          >
            متابعة لمراجعة الحجز ({selectedIds.size})
          </button>
        </div>
      )}
    </div>
  )
}
