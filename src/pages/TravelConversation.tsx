import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  getNextBestQuestion,
  getNextOptionalQuestion,
  isDecisionProfileReady,
  ALL_TRACKED_FIELDS,
  type TravelSession,
} from '../utils/travelSession'
import { useSessionPersistence } from '../lib/hooks/useSessionPersistence'
import { useAuth } from '../lib/auth'
import {
  planTrip,
  buildTripPlannerRequestFromSession,
  type TripItineraryResult,
} from '../utils/tripPlanner'
import { createTripBookingSession } from '../lib/booking/bookingSessionService'
import { buildRahhalReply, buildWelcomeReply, buildResumedReply, progressText } from '../utils/rahhalVoice'
import DecisionProfile from '../components/DecisionProfile'
import LiveSummaryCard from '../components/LiveSummaryCard'
import TripItineraryResults from '../components/TripItineraryResults'
import type { TripBookingSelection } from '../components/TripItineraryResults'

interface ChatMessage {
  id: number
  role: 'user' | 'rahhal' | 'rahhal_progress'
  text: string
}

export default function TravelConversation() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialText = (location.state as { tripText?: string } | null)?.tripText ?? ''
  const { user } = useAuth()

  const { session: persistedSession, saveSession: persistSession, clearSession: clearPersistedSession, loading: sessionLoading, sessionId } = useSessionPersistence()
  const [session, setSession] = useState<TravelSession>(() => {
    if (persistedSession && persistedSession.completedFields.length > 0) return persistedSession
    if (initialText.trim()) return mergeTravelSession(createEmptyTravelSession(), initialText)
    return createEmptyTravelSession()
  })
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const msgs: ChatMessage[] = []
    const hasPersistedData = persistedSession && persistedSession.completedFields.length > 0
    if (initialText.trim() && !hasPersistedData) {
      const initialSession = mergeTravelSession(createEmptyTravelSession(), initialText)
      msgs.push({ id: 1, role: 'user', text: initialText })
      const next = getNextBestQuestion(initialSession)
      const reply = buildRahhalReply(createEmptyTravelSession(), initialSession, next)
      msgs.push({ id: 2, role: 'rahhal', text: reply })
      if (initialSession.completedFields.length > 0) {
        msgs.push({ id: 3, role: 'rahhal_progress', text: progressText(initialSession.completionPercentage) })
        msgIdRef.current = 4
      }
    } else if (hasPersistedData) {
      const next = getNextBestQuestion(persistedSession)
      const reply = buildResumedReply(persistedSession, next)
      msgs.push({ id: 1, role: 'rahhal', text: reply })
    } else {
      const next = getNextBestQuestion(createEmptyTravelSession())
      msgs.push({ id: 1, role: 'rahhal', text: buildWelcomeReply(next) })
    }
    return msgs
  })
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [mode, setMode] = useState<'essential' | 'preferences'>('essential')
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [tripResult, setTripResult] = useState<TripItineraryResult | null>(null)
  const [continuingToBooking, setContinuingToBooking] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)
  const msgIdRef = useRef(3)
  const scrollRef = useRef<HTMLDivElement>(null)

  const completion = session.completionPercentage
  const nextQuestion = useMemo(() => getNextBestQuestion(session), [session])
  const profileReady = useMemo(() => isDecisionProfileReady(session), [session])
  const optionalQuestion = useMemo(
    () => mode === 'preferences' ? getNextOptionalQuestion(session) : null,
    [mode, session],
  )
  const detectedFields = useMemo(() => {
    return ALL_TRACKED_FIELDS.filter(f => {
      const val = session[f]
      return val !== null && val !== undefined && val !== ''
    })
  }, [session])

  const hasItinerary =
    !!tripResult && (tripResult.flights.length > 0 || tripResult.hotels.length > 0)

  useEffect(() => {
    if (!session.decisionProfileConfirmed) {
      setTripResult(null)
      setOrchestrationError(null)
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    setOrchestrationError(null)

    const plannerReq = buildTripPlannerRequestFromSession(session)
    if (!plannerReq) {
      setSearching(false)
      setTripResult(null)
      setOrchestrationError('أكمل تاريخ العودة أو مدة الرحلة مع بقية الحقول الأساسية قبل البحث.')
      return
    }

    planTrip(plannerReq)
      .then((result) => {
        if (cancelled) return
        setTripResult(result)
        const hardFail =
          result.flights.length === 0
          && result.hotels.length === 0
          && result.errors.length > 0
        if (hardFail) {
          setOrchestrationError('تعذّر العثور على رحلات أو فنادق لهذه الخطة. حاول تعديل البحث.')
        } else {
          setOrchestrationError(null)
        }
      })
      .catch(() => {
        if (cancelled) return
        setTripResult(null)
        setOrchestrationError('تعذّر تشغيل مخطط الرحلة. حاول مرة أخرى.')
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [session.decisionProfileConfirmed])

  useEffect(() => {
    if (sessionLoading) return
    persistSession(session)
  }, [session, sessionLoading, persistSession])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isThinking) return

    const userMsg: ChatMessage = { id: msgIdRef.current++, role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    window.setTimeout(() => {
      setSession(prev => {
        const updated = mergeTravelSession(prev, text)
        const next = getNextBestQuestion(updated)
        const reply = buildRahhalReply(prev, updated, next)
        setMessages(prevMsgs => [
          ...prevMsgs,
          { id: msgIdRef.current++, role: 'rahhal', text: reply },
          { id: msgIdRef.current++, role: 'rahhal_progress', text: progressText(updated.completionPercentage) },
        ])
        return updated
      })
      setIsThinking(false)
    }, 900)
  }

  const handleContinueToBooking = async (selection: TripBookingSelection) => {
    if (!tripResult) return
    if (!user?.id) {
      setContinueError('يجب تسجيل الدخول لإنشاء جلسة حجز.')
      return
    }
    setContinuingToBooking(true)
    setContinueError(null)
    try {
      const created = await createTripBookingSession({
        userId: user.id,
        travelSessionId: sessionId,
        flight: selection.flight,
        hotel: selection.hotel,
        summary: tripResult.summary,
      })
      if (!created.session) {
        setContinueError(created.error ?? 'تعذّر إنشاء جلسة الحجز.')
        return
      }
      if (created.error && !created.persisted) {
        setContinueError('تم تجهيز الاختيار محلياً، لكن حفظه في قاعدة البيانات فشل. حاول مرة أخرى.')
        return
      }
      navigate('/booking/review', {
        state: { bookingSessionId: created.session.id },
      })
    } catch {
      setContinueError('تعذّر إنشاء جلسة الحجز. حاول مرة أخرى.')
    } finally {
      setContinuingToBooking(false)
    }
  }

  const handleReset = () => {
    clearPersistedSession()
    setSession(createEmptyTravelSession())
    setTripResult(null)
    setOrchestrationError(null)
    setContinueError(null)
    const next = getNextBestQuestion(createEmptyTravelSession())
    setMessages([{ id: msgIdRef.current++, role: 'rahhal', text: buildWelcomeReply(next) }])
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-sky-50 via-white to-white">
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="رجوع"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-900">رحّال</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">درجة فهم رحّال</span>
            <span className="text-sm font-bold text-primary-600">{completion}%</span>
          </div>
          {detectedFields.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="إعادة بدء"
            >
              بدء من جديد
            </button>
          )}
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-l from-primary-400 to-primary-600 transition-all duration-700 ease-out"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
          {detectedFields.length > 0 && (
            <LiveSummaryCard session={session} />
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              {msg.role === 'rahhal_progress' ? (
                <div className="flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-bold text-primary-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" />
                  {msg.text}
                </div>
              ) : (
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-primary-600 text-white'
                      : 'rounded-tl-sm bg-white text-slate-800 border border-slate-100'
                  }`}
                >
                  {msg.role === 'rahhal' && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-md bg-primary-50 text-center text-[10px] leading-5 text-primary-600">ر</span>
                      <span className="text-[11px] font-medium text-slate-400">رحّال</span>
                    </div>
                  )}
                  <p>{msg.text}</p>
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {!isThinking && nextQuestion && mode === 'essential' && (
            <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-sm font-medium text-primary-700">
                {nextQuestion.text}
              </p>
              <div className="mt-3 flex items-start gap-2 border-t border-primary-100 pt-3">
                <span className="text-sm leading-6 text-primary-400">💡</span>
                <div>
                  <p className="text-xs font-medium text-primary-500">لماذا أسأل هذا؟</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {nextQuestion.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isThinking && !nextQuestion && mode === 'preferences' && optionalQuestion && (
            <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-sm font-medium text-primary-700">
                سؤال اختياري — يمكنك الإجابة أو تخطّيه
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {optionalQuestion.text}
              </p>
              <div className="mt-3 flex items-start gap-2 border-t border-primary-100 pt-3">
                <span className="text-sm leading-6 text-primary-400">💡</span>
                <div>
                  <p className="text-xs font-medium text-primary-500">لماذا يساعدني هذا؟</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {optionalQuestion.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {profileReady && (
            <DecisionProfile
              session={session}
              onSessionChange={(updated) => {
                setSession(updated)
                persistSession(updated)
              }}
              onContinuePreferences={() => setMode('preferences')}
            />
          )}

          {session.decisionProfileConfirmed && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-success-200 bg-success-50 px-5 py-4 text-center">
                <p className="text-sm font-bold text-success-700">
                  خطتك جاهزة للبحث والمقارنة
                </p>
              </div>

              {searching ? (
                <div className="flex items-center justify-center py-12" aria-label="جاري البحث">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                    <p className="text-sm text-slate-500">رحّال يجمع رحلاتك وفنادقك...</p>
                  </div>
                </div>
              ) : orchestrationError && !hasItinerary ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center">
                  <p className="text-sm font-bold text-rose-600">{orchestrationError}</p>
                </div>
              ) : !hasItinerary ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
                  <p className="text-sm font-medium text-slate-500">لا توجد خيارات متاحة لهذه الخطة حالياً.</p>
                </div>
              ) : tripResult ? (
                <TripItineraryResults
                  result={tripResult}
                  onContinueToBooking={handleContinueToBooking}
                  continuing={continuingToBooking}
                  continueError={continueError}
                />
              ) : null}
            </section>
          )}

          {!isThinking && !nextQuestion && mode === 'essential' && !profileReady && detectedFields.length > 0 && (
            <div className="rounded-2xl border border-success-200 bg-success-50 p-4 text-center">
              <p className="text-sm font-bold text-success-700">
                اكتمل فهم رحلتك! درجة الفهم {completion}%. رحّال جاهز للتفكير في أفضل خياراتك.
              </p>
            </div>
          )}
        </div>
      </main>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <div className="flex items-end gap-2.5">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={1}
              placeholder={nextQuestion ? nextQuestion.placeholder : 'اكتب أي تفاصيل إضافية...'}
              className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              aria-label="إرسال"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
