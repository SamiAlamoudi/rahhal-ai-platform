import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getFeatureRegistry } from '../lib/ai'
import {
  buildAiHomeModel,
  conversationEntryPath,
  promptText,
  type AiHomeModel,
  type HomeLocale,
  type SuggestedPrompt,
  type TravelSmartCardModel,
} from '../lib/aiHome'
import { loadUserBookingRecords } from '../lib/booking'
import { listManagedOrdersForUser } from '../lib/orderManagement'
import { useAuth } from '../lib/auth'
import {
  AiHomeHero,
  ContinueBookingPanel,
  ConversationComposer,
  HomeErrorState,
  HomeSkeleton,
  SuggestedPromptGrid,
  TravelCardsSection,
} from '../components/home'

/**
 * Sprint 16 — conversation-first AI Home (flag-gated from Home.tsx).
 */
export default function AiHomeExperience() {
  const navigate = useNavigate()
  const { user, isAdmin, loading: authLoading } = useAuth()
  const registry = getFeatureRegistry()
  const conversationHome = registry.isEnabled('ui.conversation_home')
  const travelCardsEnabled = registry.isEnabled('ui.travel_cards')
  const continueEnabled = registry.isEnabled('ui.continue_booking')

  const locale: HomeLocale = 'ar'
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  const [draft, setDraft] = useState('')
  const [model, setModel] = useState<AiHomeModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined
    return meta?.full_name || meta?.name || user?.email?.split('@')[0] || null
  }, [user])

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setModel(
        buildAiHomeModel({
          locale,
          displayName,
          returning: false,
          records: [],
          orders: [],
        }),
      )
      return
    }
    setError(null)
    try {
      const records = await loadUserBookingRecords(user.id)
      const orders = listManagedOrdersForUser(user.id)
      setModel(
        buildAiHomeModel({
          locale,
          displayName,
          returning: records.length > 0,
          records,
          orders,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load home')
    }
  }, [user?.id, displayName, locale])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, refresh])

  const startConversation = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      // Recovery Phase 1 — ONE Chat UI: always seed `/chat` (never travel-conversation).
      if (conversationHome) {
        const entry = conversationEntryPath(trimmed)
        navigate(entry.pathname, { state: entry.state })
        return
      }
      navigate('/chat', { state: { initialPrompt: trimmed, tripText: trimmed } })
    },
    [conversationHome, navigate],
  )

  const onSelectPrompt = useCallback(
    (prompt: SuggestedPrompt) => {
      if (prompt.resumeBooking && model?.continueBooking && continueEnabled) {
        const c = model.continueBooking
        navigate(c.resumePath, { state: c.resumeState })
        return
      }
      startConversation(promptText(prompt, locale))
    },
    [model?.continueBooking, continueEnabled, startConversation, locale, navigate],
  )

  const onOpenCard = useCallback(
    (card: TravelSmartCardModel) => {
      if (card.href.startsWith('/chat?seed=')) {
        const seed = decodeURIComponent(card.href.replace('/chat?seed=', ''))
        startConversation(seed)
        return
      }
      navigate(card.href)
    },
    [navigate, startConversation],
  )

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-950/[0.03] via-sky-50/40 to-white"
      data-testid="ai-home"
    >
      <header className="sticky top-0 z-30 border-b border-slate-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-600/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">رحّال</p>
              <p className="text-[10px] leading-tight text-slate-400">
                {t('مستشار السفر الذكي', 'AI travel concierge')}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-0.5" aria-label={t('التنقل', 'Navigation')}>
            <Link
              to="/my-trips"
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:text-sm"
            >
              {t('رحلاتي', 'Trips')}
            </Link>
            <button
              type="button"
              onClick={() => navigate('/search')}
              data-testid="nav-search"
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 sm:text-sm"
            >
              {t('بحث', 'Search')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50 sm:text-sm"
            >
              {t('محادثة', 'Chat')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:text-sm"
            >
              {t('إعدادات', 'Settings')}
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="rounded-lg px-2.5 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 sm:text-sm"
              >
                {t('إدارة', 'Admin')}
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-5 sm:px-5">
        {loading || authLoading ? <HomeSkeleton /> : null}

        {!loading && !authLoading && error ? (
          <HomeErrorState
            title={t('تعذر تحميل الصفحة', 'Could not load home')}
            body={error}
            onRetry={() => void refresh()}
            retryLabel={t('إعادة المحاولة', 'Retry')}
          />
        ) : null}

        {!loading && !authLoading && model ? (
          <>
            <AiHomeHero
              greeting={model.greeting}
              locale={locale}
              brandName="رحّال"
              brandTagline={t('منصة السفر بالمحادثة', 'Conversation-first travel')}
            />

            <div className="-mt-5 relative z-10 px-1 sm:px-2">
              <ConversationComposer
                locale={locale}
                value={draft}
                onChange={setDraft}
                onSubmit={startConversation}
              />
            </div>

            {continueEnabled && model.continueBooking ? (
              <ContinueBookingPanel
                locale={locale}
                model={model.continueBooking}
                onResume={() => {
                  const c = model.continueBooking!
                  navigate(c.resumePath, { state: c.resumeState })
                }}
              />
            ) : null}

            <SuggestedPromptGrid
              locale={locale}
              prompts={model.suggestions}
              onSelect={onSelectPrompt}
            />

            {travelCardsEnabled ? (
              <TravelCardsSection
                locale={locale}
                cards={model.travelCards}
                onOpen={onOpenCard}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}
