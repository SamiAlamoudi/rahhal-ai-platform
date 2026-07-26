import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../../lib/auth'
import { loadUserBookingRecords } from '../../../lib/booking'
import {
  PRODUCT_HOME_SUGGESTIONS,
  productBrandName,
  productCopy,
  productMotion,
  suggestionText,
  type ProductLocale,
} from '../../../lib/productUx'
import { buildVoiceAwareChatNavigation } from '../../../lib/aiHome/voiceEntryHandoff'
import { ConversationComposer } from '../../home/ConversationComposer'
import { AppShell } from '../AppShell'
import { BrandMark } from '../BrandMark'
import { ProductStatePanel } from '../states/ProductStates'

/**
 * Conversation-first home — primary action is talking to Rahhal.
 * Seeds existing `/chat` spine; no booking search form.
 */
export function NewHomeExperience() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const locale: ProductLocale = 'ar'
  const [draft, setDraft] = useState('')
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [recentCount, setRecentCount] = useState(0)
  const [loadingTrips, setLoadingTrips] = useState(true)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user?.id) {
        if (!cancelled) {
          setRecentCount(0)
          setLoadingTrips(false)
        }
        return
      }
      setLoadingTrips(true)
      try {
        const records = await loadUserBookingRecords(user.id)
        if (!cancelled) setRecentCount(records.length)
      } catch {
        if (!cancelled) setRecentCount(0)
      } finally {
        if (!cancelled) setLoadingTrips(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const startConversation = useCallback(
    (text: string, meta?: { source?: 'text' | 'voice' }) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const startVoice = meta?.source === 'voice'
      // Durable handoff — do not rely on location.state alone (iPhone Safari drops it).
      const entry = buildVoiceAwareChatNavigation(trimmed, { startVoice })
      navigate(
        { pathname: entry.pathname, search: entry.search },
        { state: entry.state },
      )
    },
    [navigate],
  )

  const greetingName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined
    return meta?.full_name || meta?.name || null
  }, [user])

  return (
    <AppShell locale={locale} transparentHeader>
      <section
        className="mx-auto flex max-w-3xl flex-col px-4 pb-8 pt-6 sm:px-5 sm:pt-10"
        data-testid="new-home-experience"
        aria-label={productBrandName(locale)}
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: productMotion.enterMs / 1000, ease: productMotion.ease }}
          className="text-center text-white"
        >
          <div className="mb-5 flex justify-center sm:hidden">
            <BrandMark locale={locale} size="lg" inverted />
          </div>
          <p className="text-sm font-medium text-sky-100/85">{productCopy(locale, 'tagline')}</p>
          <h1 className="mt-3 text-[clamp(2rem,7vw,3.25rem)] font-bold tracking-tight leading-tight">
            {greetingName
              ? locale === 'ar'
                ? `مرحباً ${greetingName}`
                : `Welcome, ${greetingName}`
              : productBrandName(locale)}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-2xl font-semibold leading-snug text-white sm:text-3xl">
            {productCopy(locale, 'homeHeadline')}
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-sky-100/85 sm:text-base">
            {productCopy(locale, 'homeValue')}
          </p>
        </motion.div>

        <div className="relative z-10 mt-8">
          {!online ? (
            <ProductStatePanel
              kind="offline"
              locale={locale}
              onAction={() => window.location.reload()}
            />
          ) : (
            <ConversationComposer
              locale={locale}
              value={draft}
              onChange={setDraft}
              onSubmit={startConversation}
              disabled={authLoading}
            />
          )}
        </div>

        <p className="mt-4 text-center text-xs text-sky-100/70">{productCopy(locale, 'homeTrust')}</p>

        <section className="mt-8" aria-label={locale === 'ar' ? 'اقتراحات' : 'Suggestions'}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-sky-100/70 uppercase">
            {locale === 'ar' ? 'ابدأ من هنا' : 'Start here'}
          </p>
          <div className="flex flex-col gap-2">
            {PRODUCT_HOME_SUGGESTIONS.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                data-testid={`new-home-suggestion-${item.id}`}
                onClick={() => startConversation(suggestionText(item, locale))}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * index, duration: 0.3 }}
                className="min-h-12 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-start text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {suggestionText(item, locale)}
              </motion.button>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/8 px-4 py-4 text-sky-50 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {locale === 'ar' ? 'رحلاتك الأخيرة' : 'Recent trips'}
              </p>
              <p className="mt-0.5 text-xs text-sky-100/70">
                {loadingTrips
                  ? locale === 'ar'
                    ? 'جاري التحميل…'
                    : 'Loading…'
                  : recentCount > 0
                    ? locale === 'ar'
                      ? `${recentCount} سجل سفر`
                      : `${recentCount} travel records`
                    : locale === 'ar'
                      ? 'لا رحلات بعد — ابدأ بمحادثة'
                      : 'No trips yet — start a conversation'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/my-trips')}
              className="min-h-10 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
            >
              {productCopy(locale, 'navTrips')}
            </button>
          </div>
        </section>
      </section>
    </AppShell>
  )
}

export default NewHomeExperience
