import { useState, useMemo, useCallback, useEffect, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
  isDecisionProfileReady,
  type TravelSession,
} from '../utils/travelSession'
import { buildTravelSearchRequest } from '../utils/travelSearchRequest'
import { useSessionPersistence } from '../lib/hooks/useSessionPersistence'
import type { SearchOrchestrationResult } from '../utils/searchOrchestrator'
import { orchestrateLiveSearch } from '../utils/liveSearchOrchestrator'
import { generateReasoning, type ReasoningResult } from '../utils/reasoningEngine'
import { searchHistoryRepository } from '../lib/repositories'

import { AdvancedSearchControls } from '../components/AdvancedSearchControls'
import { ProgressiveConversationCard } from '../components/ProgressiveConversationCard'
import { PremiumLiveSummaryCard } from '../components/PremiumLiveSummaryCard'
import { QuickSearchTemplates } from '../components/QuickSearchTemplates'
import { SearchHistoryPanel } from '../components/SearchHistoryPanel'

const ResultsExperience = lazy(() => import('../components/ResultsExperience'))
const DecisionDashboard = lazy(() => import('../components/DecisionDashboard'))

type Tab = 'controls' | 'conversation' | 'history'

export default function SearchWorkspace() {
  const navigate = useNavigate()
  const {
    session: persistedSession,
    sessionId: travelSessionId,
    saveSession: persistSession,
    clearSession: clearPersistedSession,
    loading: sessionLoading,
  } = useSessionPersistence()

  const [session, setSession] = useState<TravelSession>(() => {
    if (persistedSession && persistedSession.completedFields.length > 0) return persistedSession
    return createEmptyTravelSession()
  })
  const [activeTab, setActiveTab] = useState<Tab>('controls')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [orchestrationResult, setOrchestrationResult] = useState<SearchOrchestrationResult | null>(null)
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const profileReady = useMemo(() => isDecisionProfileReady(session), [session])
  const confirmed = session.decisionProfileConfirmed
  const rankedOptions = useMemo(() => orchestrationResult?.rankedOptions ?? [], [orchestrationResult])

  const reasoningResults = useMemo(() => {
    if (!confirmed || rankedOptions.length === 0) return new Map<string, ReasoningResult>()
    const map = new Map<string, ReasoningResult>()
    const req = buildTravelSearchRequest(session)
    for (const option of rankedOptions) {
      map.set(option.id, generateReasoning(option, req))
    }
    return map
  }, [rankedOptions, confirmed, session])

  useEffect(() => {
    if (!confirmed) {
      setOrchestrationResult(null)
      setOrchestrationError(null)
      return
    }

    let cancelled = false
    setSearching(true)
    setOrchestrationError(null)

    const req = buildTravelSearchRequest(session)
    orchestrateLiveSearch(req)
      .then((result) => {
        if (cancelled) return
        setOrchestrationResult(result)
        setOrchestrationError(null)
        searchHistoryRepository.create({
          session_id: null,
          destination: session.destination,
          search_request: req as unknown as Record<string, unknown>,
          result_count: result.rankedOptions.length,
          ranked_top_option: result.rankedOptions[0]?.title ?? null,
        }).then(() => {
          if (!cancelled) setHistoryRefreshKey(k => k + 1)
        }).catch(() => {})
      })
      .catch(() => {
        if (cancelled) return
        setOrchestrationResult(null)
        setOrchestrationError('تعذّر تشغيل محرك البحث. حاول مرة أخرى.')
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [confirmed])

  useEffect(() => {
    if (sessionLoading) return
    persistSession(session)
  }, [session, sessionLoading, persistSession])

  const handleSessionChange = useCallback((updated: TravelSession) => {
    setSession(updated)
    persistSession(updated)
  }, [persistSession])

  const handleApplyTemplate = useCallback((patch: Partial<TravelSession>) => {
    setSession(prev => {
      const updated = mergeTravelSession({ ...prev, ...patch } as TravelSession, prev.lastConversationText)
      persistSession(updated)
      return updated
    })
  }, [persistSession])

  const handleConfirmProfile = useCallback(() => {
    const confirmedSession = confirmDecisionProfile(session)
    setSession(confirmedSession)
    persistSession(confirmedSession)
  }, [session, persistSession])

  const handleReset = useCallback(() => {
    clearPersistedSession()
    setSession(createEmptyTravelSession())
    setOrchestrationResult(null)
    setOrchestrationError(null)
  }, [clearPersistedSession])

  const handleContinueSearch = useCallback((row: { destination: string; search_request: Record<string, unknown> }) => {
    const restored = mergeTravelSession(createEmptyTravelSession(), row.destination)
    setSession(restored)
    persistSession(restored)
    setActiveTab('controls')
  }, [persistSession])

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'controls', label: 'تحكم متقدم', icon: '⚙️' },
    { id: 'conversation', label: 'المحادثة', icon: '💬' },
    { id: 'history', label: 'السجل', icon: '🕘' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-white to-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
            aria-label="رجوع"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">مساحة البحث</h1>
              <p className="text-[10px] text-slate-400">رحّال — مستشار السفر الذكي</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="text-xs font-medium text-slate-500">الفهم</span>
              <span className="text-sm font-bold text-primary-600">{session.completionPercentage}%</span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-primary-400 to-primary-600 transition-all duration-700"
                  style={{ width: `${session.completionPercentage}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              بدء من جديد
            </button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column — controls / conversation / history */}
          <div className="lg:col-span-7 xl:col-span-8">
            {/* Tab bar */}
            <div className="mb-4 flex gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 sm:text-sm ${
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                  aria-pressed={activeTab === tab.id}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
              {activeTab === 'controls' && (
                <div className="space-y-4">
                  <QuickSearchTemplates onApplyTemplate={handleApplyTemplate} />
                  <AdvancedSearchControls session={session} onSessionChange={handleSessionChange} />

                  {/* Confirm button */}
                  {profileReady && !confirmed && (
                    <button
                      type="button"
                      onClick={handleConfirmProfile}
                      data-testid="search-confirm"
                      className="w-full rounded-2xl bg-primary-600 py-4 text-base font-bold text-white shadow-lg shadow-primary-600/30 transition-all duration-200 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/40 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary-400/20"
                    >
                      أكد خطتي وابدأ البحث
                    </button>
                  )}

                  {!profileReady && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 text-center">
                      <p className="text-sm font-medium text-amber-700">
                        أكمل الحقول الأساسية لتفعيل البحث
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'conversation' && (
                <ProgressiveConversationCard session={session} />
              )}

              {activeTab === 'history' && (
                <SearchHistoryPanel onContinueSearch={handleContinueSearch} refreshKey={historyRefreshKey} />
              )}
            </div>

            {/* Results section — spans below controls */}
            {confirmed && (
              <div className="mt-6 space-y-6" role="region" aria-label="نتائج البحث">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
                  <p className="text-sm font-bold text-success-700">خطتك جاهزة للبحث والمقارنة</p>
                  {rankedOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/results', {
                        state: {
                          rankedOptions,
                          reasoningResults,
                          searchRequest: buildTravelSearchRequest(session),
                          travelSessionId,
                        },
                      })}
                      data-testid="results-open"
                      className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-[0.98]"
                    >
                      عرض صفحة النتائج الكاملة ←
                    </button>
                  )}
                </div>

                {searching && (
                  <div className="flex items-center justify-center py-12" aria-label="جاري البحث">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                      <p className="text-sm text-slate-500">رحّال يفكر في أفضل خياراتك...</p>
                    </div>
                  </div>
                )}

                {!searching && orchestrationError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center">
                    <p className="text-sm font-bold text-rose-600">{orchestrationError}</p>
                  </div>
                )}

                {!searching && !orchestrationError && rankedOptions.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
                    <p className="text-sm font-medium text-slate-500">لا توجد خيارات تجريبية متاحة حالياً.</p>
                  </div>
                )}

                {!searching && !orchestrationError && rankedOptions.length > 0 && (
                  <Suspense fallback={
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                    </div>
                  }>
                    <ResultsExperience
                      rankedOptions={rankedOptions}
                      reasoningResults={reasoningResults}
                    />
                    <DecisionDashboard
                      rankedOptions={rankedOptions}
                      reasoningResults={reasoningResults}
                      searchRequest={buildTravelSearchRequest(session)}
                    />
                  </Suspense>
                )}
              </div>
            )}
          </div>

          {/* Right column — live summary (sticky on desktop) */}
          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-20">
              <PremiumLiveSummaryCard session={session} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
