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
 * Recovery Phase 2 — premium conversation-first home.
 * Seeds `/chat` (Recovery Phase 1 spine unchanged).
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
    <div className="min-h-screen bg-slate-50" data-testid="ai-home">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-5">
          <p className="sr-only">رحّال</p>
          <nav
            className="ms-auto flex items-center gap-0.5 rounded-2xl bg-black/20 p-1 backdrop-blur-md"
            aria-label={t('التنقل', 'Navigation')}
          >
            <Link
              to="/my-trips"
              className="min-h-10 rounded-xl px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10 sm:text-sm"
            >
              {t('رحلاتي', 'Trips')}
            </Link>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="min-h-10 rounded-xl px-2.5 py-2 text-xs font-medium text-white hover:bg-white/10 sm:text-sm"
            >
              {t('محادثة', 'Chat')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="min-h-10 rounded-xl px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10 sm:text-sm"
            >
              {t('إعدادات', 'Settings')}
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="min-h-10 rounded-xl px-2.5 py-2 text-xs font-medium text-sky-100 hover:bg-white/10 sm:text-sm"
              >
                {t('إدارة', 'Admin')}
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      {loading || authLoading ? (
        <div className="mx-auto max-w-3xl px-4 pt-24">
          <HomeSkeleton />
        </div>
      ) : null}

      {!loading && !authLoading && error ? (
        <div className="mx-auto max-w-3xl px-4 pt-24">
          <HomeErrorState
            title={t('تعذر تحميل الصفحة', 'Could not load home')}
            body={error}
            onRetry={() => void refresh()}
            retryLabel={t('إعادة المحاولة', 'Retry')}
          />
        </div>
      ) : null}

      {!loading && !authLoading && model ? (
        <>
          <AiHomeHero
            greeting={model.greeting}
            locale={locale}
            brandName="رحّال"
            brandTagline={t('مستشار السفر الذكي', 'AI travel concierge')}
          />

          <main className="relative z-10 mx-auto max-w-3xl space-y-6 px-4 pb-24 sm:px-5">
            <div className="-mt-8 sm:-mt-10">
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
          </main>
        </>
      ) : null}
    </div>
  )
}
