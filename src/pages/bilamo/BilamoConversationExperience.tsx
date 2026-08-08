import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import {
  BilamoShell,
  Button,
  FlightCard,
  HotelCard,
  Logo,
  TripTimeline,
  VoiceOrb,
  bilamoHaptic,
  springs,
  type OrbState,
  type TripTimelineItem,
} from '../../design-system'
import { greetingForHour, resolveDisplayName } from '../../design-system/greeting'
import { useBilamoVoiceSession } from '../../hooks/useBilamoVoiceSession'
import { useAuth } from '../../lib/auth'
import {
  BILAMO_DEPARTURE_AIRPORTS,
  rememberDeparture,
  resolveDepartureAirport,
  type BilamoDepartureAirport,
  type DepartureResolution,
} from '../../lib/bilamo/departure/departureLocator'
import { progressiveConsultantAck } from '../../lib/bilamo/intelligence/consultantComposer'
import {
  composeUncertainWordConfirm,
  isBilamoReplyLocale,
  replyLocaleToVoiceLocale,
  type BilamoReplyLocale,
} from '../../lib/bilamo/speech/localeBridge'
import { understandSpeechTurn } from '../../lib/bilamo/speech/speechUnderstanding'
import {
  shouldBargeInFromOrb,
  shouldIgnoreOrbTapDuringVoiceSubmit,
  shouldRecoverStuckThinking,
} from '../../lib/bilamo/speech/voiceSubmitGate'
import { captureMicFromUserGesture } from '../../lib/bilamo/voice/micGestureCapture'
import {
  noteSpeechUnderstandingDiag,
  noteVoiceLifecycleStage,
} from '../../lib/bilamo/voice/voiceHttpTrace'
import { unlockAudioPlayback } from '../../lib/chat/voice/audioElementTextToSpeechProvider'
import { sanitizeArabicVoiceTranscript } from '../../lib/chat/voice/sanitizeArabicVoiceTranscript'
import { chatEngine } from '../../lib/chat/chatEngine'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { validateUserMessage } from '../../lib/chat/chatHelpers'
import { isBenignChatError, logChatError } from '../../lib/chat/chatLogger'

export interface BilamoConversationExperienceProps {
  initialPrompt?: string | null
  autoListen?: boolean
}

type BilamoFlightCard = {
  id: string
  airline: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  duration: string
  stopsLabel: string
  priceLabel: string
  reason?: string
  kindLabel?: string | null
  score?: number | null
  baggageSummary?: string | null
}

type BilamoHotelCard = {
  id: string
  name: string
  area: string
  rating: number
  nightsLabel: string
  priceLabel: string
  reason?: string
}

type BilamoFlightsStatus = {
  mode: 'demo' | 'live'
  error: string | null
  stale: boolean
  empty: boolean
  timedOut: boolean
  validation?: string | null
  inventorySource?: 'live' | 'demo' | 'unavailable'
}

type BilamoIntelCard = {
  id: string
  kind: 'weather' | 'visa' | 'costs' | 'currency' | 'transfer' | 'activity'
  title: string
  body: string
  selectable?: boolean
}

type BilamoResultsView = {
  flights: BilamoFlightCard[]
  hotels: BilamoHotelCard[]
  timeline: TripTimelineItem[]
  flightsStatus: BilamoFlightsStatus | null
  intel: BilamoIntelCard[]
}

function moneyLabel(amount: unknown, currency: unknown, locale: 'ar' | 'en' = 'en'): string {
  const cur = typeof currency === 'string' && currency.trim() ? currency : 'SAR'
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : null
  if (n == null) return cur
  const formatted = n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
  if (locale === 'ar' && (cur === 'SAR' || cur === 'ر.س')) return `${formatted} ر.س`
  return `${cur} ${formatted}`
}

function localizeKindLabel(raw: string | null | undefined, locale: 'ar' | 'en'): string | null {
  if (!raw) return null
  if (locale !== 'ar') return raw
  const lower = raw.toLowerCase()
  if (/best|overall|أفضل/.test(lower)) return 'أفضل خيار'
  if (/cheap|lowest|أرخص|سعر/.test(lower)) return 'الأرخص'
  if (/fast|أسرع/.test(lower)) return 'الأسرع'
  return raw
}

function classifyFlightKind(
  flight: BilamoFlightCard,
  index: number,
  locale: 'ar' | 'en',
): { kindLabel: string; variant: 'hero' | 'alternative' } {
  const raw = (flight.kindLabel || '').toLowerCase()
  if (index === 0) {
    return {
      kindLabel: localizeKindLabel(flight.kindLabel, locale)
        || (locale === 'ar' ? 'أفضل خيار' : 'Best overall'),
      variant: 'hero',
    }
  }
  if (/cheap|lowest|سعر|أرخص/.test(raw) || index === 1) {
    return {
      kindLabel: localizeKindLabel(flight.kindLabel, locale)
        || (locale === 'ar' ? 'الأرخص' : 'Cheapest'),
      variant: 'alternative',
    }
  }
  return {
    kindLabel: localizeKindLabel(flight.kindLabel, locale)
      || (locale === 'ar' ? 'الأسرع' : 'Fastest'),
    variant: 'alternative',
  }
}

/** Keep each turn's own text — never rewrite history to a generic pick line. */
function displayAssistantContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return trimmed
  // Drop ephemeral progress stacks if they leaked into content.
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const first = lines[lines.length - 1] || trimmed
  return first.length <= 160 ? first : `${first.slice(0, 140).trim()}…`
}

function resultsFromAssistantMeta(
  meta: Record<string, unknown> | null | undefined,
  locale: 'ar' | 'en' = 'en',
): BilamoResultsView | null {
  if (!meta || typeof meta !== 'object') return null
  const bilamo = meta.bilamo as {
    search?: {
      flights?: Array<Record<string, unknown>>
      hotels?: Array<Record<string, unknown>>
      timeline?: Array<Record<string, unknown>>
      context?: {
        weather?: string | null
        visa?: string | null
        currency?: string | null
        timeDifference?: string | null
        transfer?: string | null
      }
      flightsMeta?: {
        mode?: string
        error?: string | null
        stale?: boolean
        bestScore?: number | null
        validation?: string | null
        inventorySource?: string
      }
    } | null
    memory?: {
      agent?: {
        requirements?: {
          budgetAmount?: number | null
          budgetCurrency?: string | null
        }
      }
    }
  } | undefined
  const search = bilamo?.search
  const flightsMeta = search?.flightsMeta
  const errorStr = typeof flightsMeta?.error === 'string' ? flightsMeta.error : null
  const timedOut = /timeout/i.test(errorStr || '')
  const hasFlightIssue = Boolean(errorStr || flightsMeta?.stale)
  const ctx = search?.context
  const hasIntel = Boolean(
    ctx?.weather || ctx?.visa || ctx?.currency || ctx?.transfer || ctx?.timeDifference,
  )
  if (!search?.flights?.length && !search?.hotels?.length && !hasFlightIssue && !hasIntel) {
    return null
  }

  // Hard gate: never render same-city / invalid airport cards (e.g. RUH→RIY).
  const rawFlights = (search?.flights || []).filter((f) => {
    const o = String(f.origin || '').trim().toUpperCase()
    const d = String(f.destination || '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(o) || !/^[A-Z]{3}$/.test(d)) return false
    if (o === d) return false
    const metro: Record<string, string> = {
      RUH: 'riyadh', RIY: 'riyadh', DXB: 'dubai', DWC: 'dubai', SHJ: 'dubai',
    }
    if ((metro[o] || o) === (metro[d] || d)) return false
    return true
  })

  // Hero + at most 2 alternatives (cheapest / fastest).
  const flights: BilamoFlightCard[] = rawFlights.slice(0, 3).map((f, i) => ({
    id: String(f.id ?? `f-${i}`),
    airline: String(f.airline ?? 'Flight'),
    origin: String(f.origin ?? '—'),
    destination: String(f.destination ?? '—'),
    departTime: String(f.departTime ?? '—'),
    arriveTime: String(f.arriveTime ?? '—'),
    duration: String(f.duration ?? '—'),
    stopsLabel: String(
      f.stopsLabel
        ?? (locale === 'ar' ? 'مباشر' : 'Nonstop'),
    ),
    priceLabel: moneyLabel(f.price, f.currency, locale),
    reason: typeof f.reason === 'string' ? f.reason : undefined,
    kindLabel: typeof f.kindLabel === 'string' ? f.kindLabel : null,
    score: typeof f.score === 'number' ? f.score : null,
    baggageSummary: typeof f.baggageSummary === 'string' ? f.baggageSummary : null,
  }))

  const hotels: BilamoHotelCard[] = (search?.hotels || []).slice(0, 2).map((h, i) => ({
    id: String(h.id ?? `h-${i}`),
    name: String(h.name ?? 'Stay'),
    area: String(h.area ?? 'City center'),
    rating: typeof h.rating === 'number' ? h.rating : 4.6,
    nightsLabel: String(h.nightsLabel ?? 'Stay'),
    priceLabel: moneyLabel(h.price, h.currency, locale),
    reason: typeof h.reason === 'string' ? h.reason : undefined,
  }))

  const timeline: TripTimelineItem[] = (search?.timeline || []).map((t, i) => ({
    id: String(t.id ?? `t-${i}`),
    time: String(t.time ?? ''),
    title: String(t.title ?? ''),
    detail: typeof t.detail === 'string' ? t.detail : undefined,
    kind: (t.kind as TripTimelineItem['kind']) || 'note',
  }))

  const flightsStatus: BilamoFlightsStatus | null = flightsMeta
    ? {
        mode: flightsMeta.mode === 'live' ? 'live' : 'demo',
        error: errorStr,
        stale: flightsMeta.stale === true,
        empty: flights.length === 0,
        timedOut,
        validation: typeof flightsMeta.validation === 'string' ? flightsMeta.validation : null,
        inventorySource:
          flightsMeta.inventorySource === 'live'
            || flightsMeta.inventorySource === 'demo'
            || flightsMeta.inventorySource === 'unavailable'
            ? flightsMeta.inventorySource
            : (flightsMeta.mode === 'live' ? 'live' : 'demo'),
      }
    : (flights.length === 0
      ? {
          mode: 'demo',
          error: null,
          stale: false,
          empty: true,
          timedOut: false,
          inventorySource: 'unavailable',
        }
      : null)

  const titleFor = (kind: BilamoIntelCard['kind']): string => {
    if (locale === 'ar') {
      if (kind === 'weather') return 'الطقس'
      if (kind === 'visa') return 'التأشيرة'
      if (kind === 'costs') return 'التكلفة'
      if (kind === 'currency') return 'العملة'
      if (kind === 'transfer') return 'الانتقال'
      return 'نشاط'
    }
    if (kind === 'weather') return 'Weather'
    if (kind === 'visa') return 'Visa'
    if (kind === 'costs') return 'Costs'
    if (kind === 'currency') return 'Currency'
    if (kind === 'transfer') return 'Transfer'
    return 'Activity'
  }

  const intel: BilamoIntelCard[] = []
  if (ctx?.weather) {
    intel.push({ id: 'intel-weather', kind: 'weather', title: titleFor('weather'), body: ctx.weather, selectable: true })
  }
  if (ctx?.visa) {
    intel.push({ id: 'intel-visa', kind: 'visa', title: titleFor('visa'), body: ctx.visa, selectable: true })
  }
  if (ctx?.currency) {
    intel.push({ id: 'intel-currency', kind: 'currency', title: titleFor('currency'), body: ctx.currency, selectable: true })
  }
  if (ctx?.transfer) {
    intel.push({ id: 'intel-transfer', kind: 'transfer', title: titleFor('transfer'), body: ctx.transfer, selectable: true })
  }
  const budgetAmount = bilamo?.memory?.agent?.requirements?.budgetAmount
  const budgetCurrency = bilamo?.memory?.agent?.requirements?.budgetCurrency
  const flightTotal = typeof search?.flights?.[0]?.price === 'number' ? search.flights[0].price : null
  const hotelTotal = typeof search?.hotels?.[0]?.price === 'number' ? search.hotels[0].price : null
  if (flightTotal != null || hotelTotal != null || budgetAmount != null) {
    const parts = [
      flightTotal != null
        ? (locale === 'ar' ? `طيران ${moneyLabel(flightTotal, search?.flights?.[0]?.currency, locale)}` : `Flights ${moneyLabel(flightTotal, search?.flights?.[0]?.currency, locale)}`)
        : null,
      hotelTotal != null
        ? (locale === 'ar' ? `إقامة ${moneyLabel(hotelTotal, search?.hotels?.[0]?.currency, locale)}` : `Stay ${moneyLabel(hotelTotal, search?.hotels?.[0]?.currency, locale)}`)
        : null,
      budgetAmount != null
        ? (locale === 'ar' ? `ميزانيتك ${moneyLabel(budgetAmount, budgetCurrency, locale)}` : `Budget ${moneyLabel(budgetAmount, budgetCurrency, locale)}`)
        : null,
    ].filter(Boolean)
    intel.push({
      id: 'intel-costs',
      kind: 'costs',
      title: titleFor('costs'),
      body: parts.join(' · '),
      selectable: true,
    })
  }
  for (const item of timeline.filter((t) => t.kind === 'activity').slice(0, 2)) {
    intel.push({
      id: `intel-activity-${item.id}`,
      kind: 'activity',
      title: titleFor('activity'),
      body: [item.title, item.detail].filter(Boolean).join(' — '),
      selectable: true,
    })
  }

  return { flights, hotels, timeline, flightsStatus, intel }
}

function makeLocalUserMessage(conversationId: string, content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `temp-${Date.now()}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content: content.trim(),
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

function presenceLine(state: OrbState, partial: string): string | null {
  if (state === 'listening' && partial.trim()) return partial.trim()
  return null
}

/**
 * Investor-demo living surface.
 * Recognizable by Orb + silence + typography — not by chat chrome.
 */
export function BilamoConversationExperience({
  initialPrompt = null,
  autoListen = false,
}: BilamoConversationExperienceProps) {
  const { user } = useAuth()
  const abortRef = useRef<AbortController | null>(null)
  const silenceTimer = useRef<number | null>(null)
  const speechStartedRef = useRef(false)
  const silenceFinalizeOnceRef = useRef(false)
  const voiceApiRef = useRef<ReturnType<typeof useBilamoVoiceSession> | null>(null)
  const seededRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendRef = useRef<(raw: string) => Promise<void>>(async () => {})
  const speakGenerationRef = useRef(0)
  const sendLockRef = useRef(false)
  const pendingSendRef = useRef<string | null>(null)
  const lastSentRef = useRef<{ text: string; at: number } | null>(null)
  /** Set sync on voice final; cleared when chat send finishes — blocks orb race. */
  const voiceSubmitInFlightRef = useRef(false)
  /** Direct send (no soft mic cancel) for voice finals. */
  const voiceSendRef = useRef<(raw: string) => Promise<void>>(async () => {})
  /** Classic end-of-speech silence window — only after speech has started. */
  const SILENCE_FINALIZE_MS = 1600

  const [chatOrb, setChatOrb] = useState<OrbState | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [results, setResults] = useState<BilamoResultsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speakPulse, setSpeakPulse] = useState(0)
  const [listenPulse, setListenPulse] = useState(0)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [departure, setDeparture] = useState<DepartureResolution | null>(null)
  const [changeAirportOpen, setChangeAirportOpen] = useState(false)
  const [uiLocale, setUiLocale] = useState<BilamoReplyLocale>(() => {
    if (typeof navigator === 'undefined') return 'ar'
    const nav = navigator.language?.toLowerCase() || 'ar'
    if (nav.startsWith('ar')) return 'ar'
    if (nav.startsWith('fr')) return 'fr'
    if (nav.startsWith('es')) return 'es'
    if (nav.startsWith('de')) return 'de'
    if (nav.startsWith('it')) return 'it'
    if (nav.startsWith('tr')) return 'tr'
    if (nav.startsWith('hi')) return 'hi'
    if (nav.startsWith('ur')) return 'ur'
    if (nav.startsWith('zh')) return 'zh'
    if (nav.startsWith('ja')) return 'ja'
    return 'en'
  })
  /** One speak arming per chat turn — prevents overlapping audio. */
  const spokenArmedRef = useRef(false)

  const handleSpeechFinal = useCallback((transcript: string, normalizedHint?: string | null) => {
    // Sync gate FIRST — async import previously left a gap where orb "stuck"
    // recovery called bargeIn and dropped the request before send().
    voiceSubmitInFlightRef.current = true
    const submitStarted = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const previous = isBilamoReplyLocale(uiLocale) ? uiLocale : 'ar'
      const understood = understandSpeechTurn({
        transcript,
        normalizedHint,
        previousLanguage: previous,
        languagePreference: 'auto',
      })
      if (!understood.displayTranscript && !understood.normalizedForExtract) {
        voiceSubmitInFlightRef.current = false
        voiceApiRef.current?.releaseToIdle('empty_transcript')
        return
      }
      noteSpeechUnderstandingDiag({
        language: understood.language,
        dialect: understood.dialect,
        transcriptConfidence: understood.transcriptConfidence,
        normalizedIntent: understood.normalizedIntent,
        submitLatencyMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - submitStarted,
      })
      setUiLocale(understood.language)
      voiceApiRef.current?.setLocale(replyLocaleToVoiceLocale(understood.language))

      // Low confidence: confirm ONLY the uncertain word — never the whole sentence.
      if (understood.needsDestinationConfirm && understood.confirmDestinationLabel) {
        voiceSubmitInFlightRef.current = false
        const confirm = composeUncertainWordConfirm(
          understood.confirmDestinationLabel,
          understood.language,
        )
        const handle = voiceApiRef.current?.speak(
          confirm.spokenText,
          replyLocaleToVoiceLocale(understood.language),
        )
        if (handle) {
          speakGenerationRef.current = handle.generation
          // Stay thinking until VoiceSession reports audible SPEAKING.
          setChatOrb('thinking')
          void handle.done.finally(() => {
            if (speakGenerationRef.current === handle.generation) setChatOrb(null)
          })
        }
        setMessages((prev) => {
          const id = conversationIdRef.current || 'local'
          return [
            ...prev,
            makeLocalUserMessage(id, understood.displayTranscript),
            {
              ...makeLocalUserMessage(id, confirm.displayText),
              role: 'assistant' as const,
            },
          ]
        })
        return
      }

      // Voice finals must use voiceSendRef (not sendWithMicStop soft-cancel).
      void voiceSendRef.current(understood.normalizedForExtract || understood.displayTranscript)
    } catch {
      voiceSubmitInFlightRef.current = false
    }
  }, [uiLocale])

  const voice = useBilamoVoiceSession({
    onFinalUtterance: handleSpeechFinal,
  })
  voiceApiRef.current = voice

  conversationIdRef.current = conversationId

  // Merge voice session FSM with chat "thinking" ownership (no duplicate mic/TTS stacks).
  const orbState: OrbState = (() => {
    const fromVoice = voice.orbState
    if (
      fromVoice === 'listening'
      || fromVoice === 'speaking'
      || voice.snapshot.state === 'interrupted'
    ) {
      return fromVoice === 'listening' || voice.snapshot.state === 'interrupted'
        ? 'listening'
        : 'speaking'
    }
    if (fromVoice === 'thinking') return 'thinking'
    if (busy || chatOrb === 'thinking') return 'thinking'
    if (chatOrb === 'completed') return 'completed'
    return 'idle'
  })()

  const binaryLocale = uiLocale === 'ar' ? 'ar' as const : 'en' as const
  const displayName = useMemo(() => resolveDisplayName(user, binaryLocale), [user, binaryLocale])
  const greeting = useMemo(
    () => greetingForHour(new Date().getHours(), displayName, binaryLocale),
    [displayName, binaryLocale],
  )

  const inConversation = messages.length > 0 || busy || orbState !== 'idle'
  const copy = uiLocale === 'ar'
    ? {
        heroLead: '',
        demoInventory: 'نتائج تجريبية للتوضيح — ليست أسعاراً أو توفّراً حياً.',
        liveUnavailable: 'التوفّر الحي غير متاح حالياً. لم أعرض مخزوناً ملفّقاً.',
        emptyFlights: 'لم أجد رحلة صالحة بهذه التواريخ بعد.',
        emptySuggest: 'جرّب تواريخ أوسع، أو مدينة مغادرة أخرى، أو وجهة قريبة.',
        timeout: 'انتهت مهلة المزوّد — يمكننا إعادة المحاولة الآن.',
        tryAgain: 'أعد البحث',
        flexibleDates: 'تواريخ مرنة',
        nearbyIdeas: 'اقترح بدائل',
        stale: 'قد تكون الأسعار تحرّكت — قل لي إن أردت تحديثاً.',
        backup: 'تعذّر الوصول للمزوّد الحي — لم أعرض بديلاً ملفّقاً كأنه حي.',
        providerError: 'تعذّر الوصول للمزوّد للحظة. يمكنك إعادة المحاولة.',
        compareTitle: 'مقارنة سريعة',
        compareSelect: 'اختيار',
        selectedStay: 'اختيارك محفوظ — الخيارات ما زالت ظاهرة.',
        micNeed: 'تحقق من الميكروفون',
        tapAgain: 'تحدث بشكل طبيعي — سأتابع تلقائياً عند التوقف',
        somethingWrong: 'حدث خطأ ما',
        thinking: 'أفكّر…',
        type: 'اكتب',
        tip: 'اضغط مرة واحدة للتحدث. عند التوقف أكمل تلقائياً.',
        retryVoice: 'إعادة المحاولة',
        continueText: 'متابعة بالنص',
        classicVoice: 'صوت مبسّط',
        changeAirport: 'تغيير المطار',
        audioError: 'تعذر تشغيل الصوت. يمكنك المحاولة مرة أخرى.',
      }
    : uiLocale === 'fr'
      ? {
          heroLead: '',
          demoInventory: 'Résultats d\'échantillon — pas des tarifs live.',
          liveUnavailable: 'Inventaire live indisponible. Aucun tarif fabriqué.',
          emptyFlights: 'Je n\'ai pas encore trouvé de vol valide pour ces dates.',
          emptySuggest: 'Essayez des dates plus souples, une autre ville de départ, ou une destination proche.',
          timeout: 'Le fournisseur a expiré — nous pouvons réessayer maintenant.',
          tryAgain: 'Relancer la recherche',
          flexibleDates: 'Dates flexibles',
          nearbyIdeas: 'Proposer des alternatives',
          stale: 'Les tarifs ont pu bouger — dites-moi si vous voulez une mise à jour.',
          backup: 'Fournisseur live indisponible — aucun inventaire fabriqué.',
          providerError: 'Le fournisseur a marqué une pause. Vous pouvez réessayer.',
          compareTitle: 'Comparaison rapide',
          compareSelect: 'Choisir',
          selectedStay: 'Votre choix est enregistré — les options restent visibles.',
          micNeed: 'Vérifier le microphone',
          tapAgain: 'Parlez naturellement — je continue automatiquement quand vous vous arrêtez',
          somethingWrong: 'Une erreur s\'est produite',
          thinking: 'Je réfléchis…',
          type: 'Écrire',
          tip: 'Appuyez une fois pour parler. À la pause, je continue automatiquement.',
          retryVoice: 'Réessayer',
          continueText: 'Continuer par texte',
          classicVoice: 'Voix simple',
          changeAirport: 'Changer d\'aéroport',
          audioError: 'Impossible de lire l\'audio. Vous pouvez réessayer.',
        }
      : {
          heroLead: '',
          demoInventory: 'Sample inventory for illustration — not live prices or availability.',
          liveUnavailable: 'Live inventory unavailable. No fabricated offers shown.',
          emptyFlights: 'I could not find a valid flight match for those dates yet.',
          emptySuggest: 'Try more flexible dates, another departure city, or a nearby destination.',
          timeout: 'The provider timed out — we can retry right now.',
          tryAgain: 'Search again',
          flexibleDates: 'Flexible dates',
          nearbyIdeas: 'Suggest alternatives',
          stale: 'Prices may have shifted — say if you want me to refresh.',
          backup: 'Live provider unavailable — no fabricated inventory shown as live.',
          providerError: 'The provider paused for a moment. You can try again.',
          compareTitle: 'Quick compare',
          compareSelect: 'Select',
          selectedStay: 'Your choice is saved — recommendations stay visible.',
          micNeed: 'Check microphone',
          tapAgain: 'Speak naturally — I continue automatically when you pause',
          somethingWrong: 'Something went wrong',
          thinking: 'Thinking…',
          type: 'Type',
          tip: 'Tap once to speak. When you pause, I continue automatically.',
          retryVoice: 'Try again',
          continueText: 'Continue by text',
          classicVoice: 'Simple voice',
          changeAirport: 'Change airport',
          audioError: 'Could not play audio. You can try again.',
        }

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current != null) {
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
  }, [])

  /** Typed send: cancel mic without emitting a voice final (no duplicate turn). */
  const cancelListeningSoft = useCallback(() => {
    clearSilenceTimer()
    const api = voiceApiRef.current
    if (typeof api?.cancelListening === 'function') api.cancelListening()
    else api?.stopListening()
  }, [clearSilenceTimer])

  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id)
      if (idx === -1) return [...prev, message]
      const next = [...prev]
      next[idx] = message
      return next
    })
  }, [])

  const send = useCallback(
    async (raw: string) => {
      // Never run Arabic sanitizer on non-Arabic turns (empties/strips Latin).
      const trimmed = raw.trim()
      const content = uiLocale === 'ar'
        ? (sanitizeArabicVoiceTranscript(trimmed) || trimmed)
        : trimmed
      const validation = validateUserMessage(content)
      if (validation) {
        setError(validation)
        return
      }
      // Generation-owned send — never double-submit the same voice final.
      // Use sendLockRef only (never React `busy` — stale closures dropped voice turns).
      if (sendLockRef.current) {
        pendingSendRef.current = content
        void import('../../lib/bilamo/voice/voiceHttpTrace').then(({ noteVoiceDiscardReason }) => {
          noteVoiceDiscardReason('queued_while_busy')
        })
        return
      }
      const last = lastSentRef.current
      if (last && last.text === content && Date.now() - last.at < 5_000) {
        voiceSubmitInFlightRef.current = false
        return
      }
      sendLockRef.current = true
      lastSentRef.current = { text: content, at: Date.now() }
      spokenArmedRef.current = false

      // Only interrupt audible playback (typed barge-in). Voice-final submit must
      // NOT interrupt/finalize again — that raced WebRTC before speak().
      const fromVoiceFinal = voiceSubmitInFlightRef.current
      if (!fromVoiceFinal) {
        speakGenerationRef.current += 1
        voice.interrupt()
        cancelListeningSoft()
      }

      // Best-effort unlock (primary unlock is orb tap). Keep connect warm.
      void unlockAudioPlayback().catch(() => undefined)
      void voice.connect().catch(() => undefined)

      setError(null)
      setBusy(true)
      setChatOrb('thinking')
      setDraft('')
      // Sticky composer — stay open across turns once the traveler is typing.
      setComposerOpen(true)

      // Immediate perceived-speed feedback (not a fake final answer).
      const ackLocale = uiLocale === 'ar' || uiLocale === 'fr' ? uiLocale : 'en'
      setStatusLine(progressiveConsultantAck(ackLocale, 0))
      const ackTimers = [
        window.setTimeout(() => setStatusLine(progressiveConsultantAck(ackLocale, 1)), 420),
        window.setTimeout(() => setStatusLine(progressiveConsultantAck(ackLocale, 2)), 900),
      ]

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const isSelectTurn = /^select\s+(flight|hotel)\s+/i.test(content)

      const armSpeakOnce = (spokenRaw: string, voiceLocale: ReturnType<typeof replyLocaleToVoiceLocale>) => {
        const spoken = spokenRaw.trim()
        if (!spoken || spokenArmedRef.current) return
        spokenArmedRef.current = true
        // Stay thinking until VoiceSession reports audible SPEAKING (play started).
        // Never claim speaking from text/TTS-request alone.
        setChatOrb('thinking')
        const handle = voice.speak(spoken, voiceLocale)
        speakGenerationRef.current = handle.generation
        void handle.done.finally(() => {
          if (speakGenerationRef.current === handle.generation) {
            window.setTimeout(() => setChatOrb(null), 200)
          }
        })
      }

      try {
        let id = conversationIdRef.current
        if (!id) {
          const created = await chatEngine.createConversation('Bilamo')
          id = created.id
          conversationIdRef.current = id
          setConversationId(id)
        }
        const temp = makeLocalUserMessage(id, content)
        setMessages((prev) => [...prev, temp])

        if (isSelectTurn) {
          const match = content.match(/^select\s+(flight|hotel)\s+(\S+)/i)
          if (match?.[2]) setSelectedId(match[2])
        }

        const result = await chatEngine.sendMessage(
          { conversationId: id, content, modality: 'text' },
          {
            signal: controller.signal,
            onAssistantCreate: (msg) => {
              // Text streaming uses thinking — speaking is reserved for audible TTS.
              setChatOrb('thinking')
              setStatusLine(null)
              upsertMessage(msg)
            },
            onDelta: (msg) => {
              upsertMessage(msg)
              // Architecture: start audio on first spoken token — do not wait for onComplete.
              const meta = msg.providerMeta as { spokenText?: string; bilamo?: { replyLanguage?: string } } | undefined
              const spoken = typeof meta?.spokenText === 'string' ? meta.spokenText.trim() : ''
              if (!spoken) return
              const replyLang = isBilamoReplyLocale(meta?.bilamo?.replyLanguage)
                ? meta!.bilamo!.replyLanguage!
                : uiLocale
              const voiceLocale = replyLocaleToVoiceLocale(replyLang)
              armSpeakOnce(spoken, voiceLocale)
            },
            onComplete: (msg) => {
              upsertMessage(msg)
              if (!spokenArmedRef.current) setChatOrb('completed')
              setStatusLine(null)
              const next = resultsFromAssistantMeta(
                (msg.providerMeta as Record<string, unknown> | undefined) ?? null,
                binaryLocale,
              )
              // Preserve prior recommendation cards on selection / non-search turns.
              if (next) {
                setResults(next)
                setCompareIds([])
                setDetailsId(null)
                if (!isSelectTurn) setSelectedId(null)
              }
              const meta = msg.providerMeta as {
                spokenText?: string
                memory?: { locale?: string }
                selectedBookingOptionId?: string | null
                bilamo?: { replyLanguage?: string }
              } | undefined
              if (meta?.selectedBookingOptionId) {
                setSelectedId(meta.selectedBookingOptionId)
              }
              const replyLang = isBilamoReplyLocale(meta?.bilamo?.replyLanguage)
                ? meta!.bilamo!.replyLanguage!
                : meta?.memory?.locale === 'ar'
                  ? 'ar'
                  : uiLocale
              setUiLocale(replyLang)
              const voiceLocale = replyLocaleToVoiceLocale(replyLang)
              voice.setLocale(voiceLocale)
              const spoken = (meta?.spokenText || msg.content || '').trim()
              // Never double-speak — early delta already armed audio for this turn.
              if (spoken) armSpeakOnce(spoken, voiceLocale)
              else if (!spokenArmedRef.current) {
                window.setTimeout(() => setChatOrb(null), 500)
              }
            },
            onError: (msg, err) => {
              upsertMessage(msg)
              if (!isBenignChatError(err)) setError(err)
              voice.interrupt()
              setChatOrb(null)
            },
          },
        )

        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== temp.id && m.id !== result.assistant.id)
          return [...withoutTemp, result.user, result.assistant]
        })
        if (id) voice.setConversationId(id)
      } catch (err) {
        if (!isBenignChatError(err)) {
          logChatError('bilamo.experience.send', err)
          setError(err instanceof Error ? err.message : copy.somethingWrong)
        }
        voice.interrupt()
        setChatOrb(null)
        setStatusLine(null)
      } finally {
        for (const t of ackTimers) window.clearTimeout(t)
        if (abortRef.current === controller) abortRef.current = null
        setBusy(false)
        sendLockRef.current = false
        voiceSubmitInFlightRef.current = false
        const pending = pendingSendRef.current
        pendingSendRef.current = null
        if (pending) {
          // Flush exactly one queued voice turn after the prior request completes.
          void voiceSendRef.current(pending)
        }
      }
    },
    [binaryLocale, cancelListeningSoft, copy.somethingWrong, uiLocale, upsertMessage, voice],
  )

  // Smart departure: geolocation → nearest airport → remembered. Never interrogate for origin.
  useEffect(() => {
    let cancelled = false
    void resolveDepartureAirport({ requestGeolocation: true }).then((resolved) => {
      if (cancelled || !resolved) return
      setDeparture(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const applyDepartureAirport = useCallback((airport: BilamoDepartureAirport) => {
    rememberDeparture(airport)
    setDeparture({
      airport,
      source: 'remembered',
      assumptionLineAr: `سأعتبر ${airport.cityAr} نقطة الانطلاق.`,
      assumptionLineEn: `I'll take ${airport.cityEn} as your departure point.`,
    })
    setChangeAirportOpen(false)
  }, [])

  voiceSendRef.current = send

  // Typed composer only — soft-cancel mic (no voice final). Voice finals use voiceSendRef.
  const sendWithMicStop = useCallback(
    async (raw: string) => {
      voice.cancelListening()
      await send(raw)
    },
    [send, voice],
  )
  sendRef.current = sendWithMicStop

  const startListening = useCallback(async () => {
    setError(null)
    voice.clearError()
    setChatOrb(null)
    bilamoHaptic(6)
    noteVoiceLifecycleStage('GESTURE_RECEIVED')
    // Unlock + mic MUST stay inside this tap — any network await first kills Safari gesture.
    try {
      await unlockAudioPlayback()
    } catch {
      /* best-effort */
    }
    noteVoiceLifecycleStage('MIC_PERMISSION_REQUESTED')
    const mic = await captureMicFromUserGesture()
    if (!mic.ok) {
      noteVoiceLifecycleStage('MIC_PERMISSION_FAILED', { code: mic.code.toUpperCase() })
      setError(voice.lastError || copy.micNeed)
      setComposerOpen(true)
      return
    }
    noteVoiceLifecycleStage('MIC_PERMISSION_GRANTED')
    noteVoiceLifecycleStage('MEDIASTREAM_ACTIVE')
    const locale = isBilamoReplyLocale(uiLocale) ? uiLocale : 'ar'
    setUiLocale(locale)
    voice.setLocale(replyLocaleToVoiceLocale(locale))
    // First orb tap owns persistent hands-free session (survives every turn).
    voice.setContinuousListening(true)
    const ok = await voice.startListening({ localStream: mic.stream })
    if (!ok) {
      setError(voice.lastError || copy.micNeed)
      setComposerOpen(true)
      // Keep session active — auto-relisten / retry; only explicit stop ends it.
    }
  }, [copy.micNeed, uiLocale, voice])

  const stopVoiceSession = useCallback(() => {
    clearSilenceTimer()
    silenceFinalizeOnceRef.current = false
    speechStartedRef.current = false
    speakGenerationRef.current += 1
    setChatOrb(null)
    const api = voiceApiRef.current
    if (typeof api?.session?.stopVoiceSession === 'function') {
      api.session.stopVoiceSession()
    } else {
      voice.setContinuousListening(false)
      voice.stopListening()
      voice.interrupt()
      voice.releaseToIdle('manual_stop')
    }
  }, [clearSilenceTimer, voice])

  const toggleOrb = useCallback(() => {
    bilamoHaptic(orbState === 'listening' ? 4 : 8)
    noteVoiceLifecycleStage('GESTURE_RECEIVED')

    const gate = {
      voiceSubmitInFlight: voiceSubmitInFlightRef.current,
      sendLocked: sendLockRef.current,
      busy,
      voiceState: voice.snapshot.state,
      orbState,
    }

    const sessionActive = Boolean(
      voice.snapshot.voiceSessionActive
      || voice.snapshot.playback?.voiceSessionActive,
    )

    // While session is active: orb = STOP session (EOS is automatic silence).
    if (sessionActive && (orbState === 'listening' || orbState === 'idle')) {
      if (orbState === 'listening' || voice.snapshot.listening) {
        stopVoiceSession()
        return
      }
    }

    // EOS → processing → submit: ignore second tap (do not barge-in / drop request).
    if (shouldIgnoreOrbTapDuringVoiceSubmit(gate) && orbState !== 'listening' && orbState !== 'speaking') {
      // Active session + thinking: treat as stop, not ignore forever.
      if (sessionActive && (orbState === 'thinking' || busy)) {
        stopVoiceSession()
      }
      return
    }

    if (shouldBargeInFromOrb(gate)) {
      // Barge-in keeps the persistent session alive.
      speakGenerationRef.current += 1
      setChatOrb(null)
      void voice.bargeIn()
      return
    }
    // Empty ASR / stuck thinking with no live submit — recover without ending session.
    if (shouldRecoverStuckThinking(gate)) {
      voice.releaseToIdle('orb_stuck_recover')
      setChatOrb(null)
      void startListening()
      return
    }
    if (orbState === 'thinking' || busy) {
      if (sessionActive) stopVoiceSession()
      return
    }
    void startListening()
  }, [busy, orbState, startListening, stopVoiceSession, voice])

  const partial = voice.partialTranscript

  // Hands-free end-of-speech: arm silence timer ONLY after speech has started.
  // Deps are orbState + partial only — never voice/listenPulse callbacks (those
  // re-created every 90ms and previously reset the timer forever → second-tap bug).
  useEffect(() => {
    if (orbState !== 'listening') {
      speechStartedRef.current = false
      silenceFinalizeOnceRef.current = false
      clearSilenceTimer()
      return
    }

    const text = partial.trim()
    if (text) speechStartedRef.current = true

    if (!speechStartedRef.current || silenceFinalizeOnceRef.current) {
      return
    }

    clearSilenceTimer()
    silenceTimer.current = window.setTimeout(() => {
      if (silenceFinalizeOnceRef.current || !speechStartedRef.current) return
      silenceFinalizeOnceRef.current = true
      // Finalize exactly once → commit/submit. No second orb tap required.
      const api = voiceApiRef.current
      if (typeof api?.finalizeListening === 'function') api.finalizeListening()
      else if (api?.session) api.session.finalizeListening()
      else api?.stopListening()
    }, SILENCE_FINALIZE_MS)

    return () => {
      clearSilenceTimer()
    }
  }, [clearSilenceTimer, orbState, partial])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, partial, results, busy, selectedId])

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (initialPrompt) {
      setComposerOpen(true)
      void sendRef.current(initialPrompt)
      return
    }
    if (autoListen) void startListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (orbState !== 'speaking') {
      setSpeakPulse(0)
      return
    }
    const id = window.setInterval(() => setSpeakPulse((n) => n + 1), 90)
    return () => window.clearInterval(id)
  }, [orbState])

  useEffect(() => {
    if (orbState !== 'listening') {
      setListenPulse(0)
      return
    }
    const id = window.setInterval(() => setListenPulse((n) => n + 1), 90)
    return () => window.clearInterval(id)
  }, [orbState])

  const speakingBands = useMemo(() => {
    if (orbState !== 'speaking') return undefined
    return Array.from({ length: 32 }, (_, i) => {
      const t = speakPulse * 0.28 + i * 0.38
      return 0.18 + 0.48 * Math.abs(Math.sin(t)) * (0.6 + 0.4 * Math.abs(Math.cos(t * 0.65)))
    })
  }, [orbState, speakPulse])

  // Synthetic listen bands — avoids a second getUserMedia alongside the transport mic.
  const listeningBands = useMemo(() => {
    if (orbState !== 'listening') return undefined
    return Array.from({ length: 32 }, (_, i) => {
      const t = listenPulse * 0.34 + i * 0.41
      return 0.12 + 0.55 * Math.abs(Math.sin(t)) * (0.55 + 0.45 * Math.abs(Math.cos(t * 0.7)))
    })
  }, [listenPulse, orbState])

  const level = orbState === 'listening' ? 0.38 : orbState === 'speaking' ? 0.42 : 0
  const bands = orbState === 'listening' ? listeningBands : speakingBands
  const transcript = presenceLine(orbState, partial)
  const voiceError = voice.lastError

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || busy) return
    bilamoHaptic(6)
    void sendWithMicStop(draft)
  }

  const selectFlight = (id: string) => {
    bilamoHaptic(6)
    setSelectedId(id)
    void sendWithMicStop(`select flight ${id}`)
  }

  const selectHotel = (id: string) => {
    bilamoHaptic(6)
    setSelectedId(id)
    void sendWithMicStop(`select hotel ${id}`)
  }

  const recoveryActions = (status: BilamoFlightsStatus) => {
    const actions: Array<{ label: string; prompt: string }> = [
      {
        label: copy.tryAgain,
        prompt: uiLocale === 'ar'
          ? 'أعد البحث عن الرحلات بنفس الوجهة'
          : 'Please search flights again for the same destination',
      },
      {
        label: copy.flexibleDates,
        prompt: uiLocale === 'ar'
          ? 'ابحث بتواريخ أكثر مرونة حول نفس الفترة'
          : 'Search again with more flexible dates around the same period',
      },
    ]
    if (status.timedOut || status.error) {
      actions.unshift({
        label: uiLocale === 'ar' ? 'أعد المحاولة الآن' : 'Retry now',
        prompt: uiLocale === 'ar'
          ? 'حاول مرة أخرى الآن بعد انتهاء المهلة'
          : 'Please retry the flight search now after the timeout',
      })
    }
    if (status.empty) {
      actions.push({
        label: copy.nearbyIdeas,
        prompt: uiLocale === 'ar'
          ? 'اقترح وجهات قريبة أو بدائل إن لم تتوفر رحلات'
          : 'Suggest nearby destinations or alternatives if flights are unavailable',
      })
    }
    return actions
  }

  return (
    <BilamoShell>
      <LayoutGroup>
        <div
          className="mx-auto flex min-h-[100dvh] w-full max-w-[24rem] flex-col px-8 pb-10 pt-14 sm:max-w-md"
          dir={uiLocale === 'ar' ? 'rtl' : 'ltr'}
          lang={uiLocale === 'fr' ? 'fr' : uiLocale === 'ar' ? 'ar' : 'en'}
        >
          <header className="relative z-10 text-center">
            <Logo size={inConversation ? 'sm' : 'md'} className="justify-center" />
            <AnimatePresence mode="wait">
              {!inConversation ? (
                <motion.h1
                  key="greeting"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={springs.gentle}
                  className="mt-8 text-[1.9rem] font-medium leading-[1.12] tracking-[-0.045em] text-[var(--bilamo-text)] sm:text-[2.15rem]"
                >
                  {greeting}
                </motion.h1>
              ) : null}
            </AnimatePresence>
          </header>

          <section
            className={`relative z-10 flex flex-col items-center ${
              inConversation ? 'py-8' : 'flex-1 justify-center py-16'
            }`}
          >
            <motion.div layout transition={springs.soft}>
              <VoiceOrb
                state={orbState}
                level={level}
                bands={bands}
                size={inConversation ? 140 : 248}
                onClick={toggleOrb}
                label={
                  orbState === 'listening'
                    ? (uiLocale === 'ar' ? 'إيقاف' : 'Stop')
                    : (uiLocale === 'ar' ? 'تحدث' : 'Speak')
                }
              />
            </motion.div>

            <div className="mt-8 flex min-h-[1.4rem] items-center justify-center px-4">
              <AnimatePresence mode="wait">
                {transcript ? (
                  <motion.p
                    key={transcript.slice(0, 40)}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={springs.soft}
                    className="max-w-[18rem] text-center text-[14px] leading-relaxed tracking-[-0.01em] text-[var(--bilamo-muted)]"
                  >
                    {transcript}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>

            {departure && !transcript ? (
              <div className="mt-4 max-w-[18rem] space-y-2 text-center">
                <p className="text-[13px] leading-relaxed text-[var(--bilamo-muted)]">
                  {uiLocale === 'ar' ? departure.assumptionLineAr : departure.assumptionLineEn}
                </p>
                <button
                  type="button"
                  className="text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                  onClick={() => setChangeAirportOpen((v) => !v)}
                >
                  {copy.changeAirport}
                </button>
                {changeAirportOpen ? (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {BILAMO_DEPARTURE_AIRPORTS.slice(0, 6).map((airport) => (
                      <button
                        key={airport.code}
                        type="button"
                        className="rounded-full border border-[var(--bilamo-border)] px-3 py-1 text-[12px] text-[var(--bilamo-text)]/85"
                        onClick={() => applyDepartureAirport(airport)}
                      >
                        {uiLocale === 'ar' ? airport.cityAr : airport.cityEn}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <AnimatePresence>
              {(voiceError || error) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 max-w-[18rem] space-y-2 text-center"
                  role="alert"
                >
                  <p className="text-[13px] leading-relaxed text-[var(--bilamo-danger)]/85">
                    {error ?? voiceError ?? copy.audioError}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                      <button
                        type="button"
                        className="text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                        onClick={() => {
                          setError(null)
                          voice.clearError()
                          voice.releaseToIdle('error_retry')
                          void startListening()
                        }}
                      >
                        {copy.retryVoice}
                      </button>
                      <button
                        type="button"
                        className="text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                        onClick={() => {
                          setError(null)
                          voice.clearError()
                          voice.releaseToIdle('continue_text')
                          setComposerOpen(true)
                        }}
                      >
                        {copy.continueText}
                      </button>
                      {voiceError && voice.transportKind === 'realtime_webrtc' ? (
                        <button
                          type="button"
                          className="text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                          onClick={() => {
                            void voice.switchToClassic().then(() => {
                              voice.clearError()
                              voice.releaseToIdle('classic_switch')
                            })
                          }}
                        >
                          {copy.classicVoice}
                        </button>
                      ) : null}
                    </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <AnimatePresence>
            {messages.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.soft}
                className="relative z-10 mb-2 flex-1 space-y-7 overflow-y-auto"
                aria-live="polite"
              >
                {messages.map((msg) => {
                  const isLastAssistant =
                    busy && msg.role === 'assistant' && msg === messages[messages.length - 1]
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={springs.soft}
                      className={msg.role === 'user' ? 'text-end' : 'text-start'}
                    >
                      {msg.role === 'user' ? (
                        <p className="inline-block max-w-[90%] text-[14px] leading-relaxed tracking-[-0.01em] text-[var(--bilamo-muted)]">
                          {msg.content}
                        </p>
                      ) : (
                        <p className="max-w-[98%] text-[16.5px] leading-[1.72] tracking-[-0.02em] whitespace-pre-wrap text-[var(--bilamo-text)]/93">
                          {displayAssistantContent(msg.content || '')}
                          {isLastAssistant ? (
                            <motion.span
                              aria-hidden
                              className="ms-1 inline-block h-1.5 w-1.5 translate-y-[-0.1em] rounded-full bg-[var(--bilamo-secondary)] align-middle"
                              animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.85, 1.05, 0.85] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          ) : null}
                        </p>
                      )}
                    </motion.div>
                  )
                })}

                {statusLine && busy && orbState === 'thinking' ? (
                  <motion.p
                    key={statusLine}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={springs.soft}
                    className="px-1 text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]"
                  >
                    {statusLine}
                  </motion.p>
                ) : null}

                {busy && orbState === 'thinking' && !results ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={springs.soft}
                    className="space-y-2 pt-2"
                    aria-label={copy.thinking}
                  >
                    {[0, 1].map((i) => (
                      <motion.div
                        key={i}
                        className="bilamo-glass h-[4.5rem] rounded-[1.25rem]"
                        animate={{ opacity: [0.35, 0.7, 0.35] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </motion.div>
                ) : null}

                {selectedId && results ? (
                  <p className="px-1 text-[12.5px] text-[var(--bilamo-secondary)]/90">
                    {copy.selectedStay}
                  </p>
                ) : null}

                {results && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.soft, delay: 0.05 }}
                    className="space-y-2 pt-2"
                    layout
                  >
                    {results.flightsStatus?.empty && !results.flights.length ? (
                      <div className="space-y-3 px-1 py-2">
                        <p className="text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]">
                          {results.flightsStatus.timedOut
                            ? copy.timeout
                            : results.flightsStatus.error
                              ? copy.providerError
                              : copy.emptyFlights}
                        </p>
                        <p className="text-[13px] leading-relaxed text-[var(--bilamo-text)]/75">
                          {copy.emptySuggest}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {recoveryActions(results.flightsStatus).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={() => void sendWithMicStop(action.prompt)}
                              className="text-[13px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {results.flightsStatus?.mode === 'demo'
                      || results.flightsStatus?.inventorySource === 'demo' ? (
                      <p className="px-1 pb-2 text-[12.5px] leading-relaxed text-[var(--bilamo-muted)]">
                        {copy.demoInventory}
                      </p>
                    ) : null}
                    {results.flightsStatus?.inventorySource === 'unavailable' ? (
                      <p className="px-1 pb-2 text-[12.5px] leading-relaxed text-[var(--bilamo-muted)]">
                        {copy.liveUnavailable}
                      </p>
                    ) : null}
                    {results.flightsStatus?.stale ? (
                      <div className="space-y-2 px-1">
                        <p className="text-[12.5px] text-[var(--bilamo-muted)]/90">
                          {copy.stale}
                        </p>
                        <button
                          type="button"
                          onClick={() => void sendWithMicStop(
                            uiLocale === 'ar'
                              ? 'حدّث نتائج الرحلات الآن'
                              : 'Please refresh the flight results now',
                          )}
                          className="text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                        >
                          {copy.tryAgain}
                        </button>
                      </div>
                    ) : null}
                    {results.flightsStatus?.error && results.flights.length > 0 ? (
                      <p className="px-1 text-[12.5px] text-[var(--bilamo-muted)]/90">
                        {copy.backup}
                      </p>
                    ) : null}

                    <AnimatePresence initial={false}>
                      {compareIds.length >= 2 ? (
                        <motion.div
                          key="compare"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={springs.soft}
                          className="bilamo-glass mx-0 space-y-2 rounded-[1.25rem] px-5 py-4"
                        >
                          <p className="text-[12.5px] tracking-[-0.01em] text-[var(--bilamo-muted)]">
                            {copy.compareTitle}
                          </p>
                          {results.flights
                            .filter((f) => compareIds.includes(f.id))
                            .map((f) => (
                              <div
                                key={`cmp-${f.id}`}
                                className="flex items-baseline justify-between gap-3 border-t border-[var(--bilamo-border)] pt-2 first:border-0 first:pt-0"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[13.5px] text-[var(--bilamo-text)]/90">
                                    {f.airline} · {f.stopsLabel}
                                  </p>
                                  <p className="text-[12px] text-[var(--bilamo-muted)]">
                                    {f.departTime} → {f.arriveTime}
                                    {f.score != null ? ` · ${f.score}` : ''}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <p className="tabular-nums text-[13px] text-[var(--bilamo-text)]">
                                    {f.priceLabel}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => selectFlight(f.id)}
                                    className="text-[12px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                                  >
                                    {copy.compareSelect}
                                  </button>
                                </div>
                              </div>
                            ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {results.flights.map((flight, i) => {
                      const classified = classifyFlightKind(flight, i, binaryLocale)
                      const isHero = classified.variant === 'hero'
                      return (
                      <motion.div
                        key={flight.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springs.soft, delay: 0.04 * i }}
                      >
                        <FlightCard
                          airline={flight.airline}
                          origin={flight.origin}
                          destination={flight.destination}
                          departTime={flight.departTime}
                          arriveTime={flight.arriveTime}
                          duration={flight.duration}
                          stopsLabel={flight.stopsLabel}
                          priceLabel={flight.priceLabel}
                          reason={isHero ? flight.reason : flight.reason}
                          kindLabel={classified.kindLabel}
                          score={flight.score}
                          baggageSummary={flight.baggageSummary}
                          highlighted={isHero && selectedId == null}
                          selected={selectedId === flight.id}
                          variant={classified.variant}
                          locale={binaryLocale}
                          onSelect={() => selectFlight(flight.id)}
                          onCompare={() => {
                            setCompareIds((prev) => {
                              if (prev.includes(flight.id)) return prev.filter((id) => id !== flight.id)
                              return [...prev, flight.id].slice(-3)
                            })
                            bilamoHaptic(4)
                          }}
                          onViewDetails={() => {
                            setDetailsId((prev) => (prev === flight.id ? null : flight.id))
                            bilamoHaptic(4)
                          }}
                        />
                        <AnimatePresence>
                          {detailsId === flight.id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={springs.soft}
                              className="overflow-hidden px-5 pb-3"
                            >
                              <p className="text-[13px] leading-relaxed text-[var(--bilamo-text)]/75">
                                {flight.reason
                                  || (uiLocale === 'ar'
                                    ? 'تفاصيل هذه التوصية مرتبطة بتوازن السعر والراحة والتوقيت.'
                                    : 'This recommendation balances price, comfort, and schedule fit.')}
                              </p>
                              <p className="mt-1 text-[12px] text-[var(--bilamo-muted)]">
                                {[
                                  flight.duration,
                                  flight.stopsLabel,
                                  flight.baggageSummary
                                    ? (uiLocale === 'ar'
                                      ? `أمتعة ${flight.baggageSummary}`
                                      : `Bags ${flight.baggageSummary}`)
                                    : null,
                                  flight.score != null
                                    ? (uiLocale === 'ar'
                                      ? `درجة بيلامو ${flight.score}`
                                      : `Bilamo Score ${flight.score}`)
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                      )
                    })}
                    {results.hotels.map((hotel, i) => (
                      <motion.div
                        key={hotel.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springs.soft, delay: 0.04 * (results.flights.length + i) }}
                      >
                        <HotelCard
                          {...hotel}
                          highlighted={i === 0 && selectedId == null}
                          selected={selectedId === hotel.id}
                          locale={binaryLocale}
                          onSelect={() => selectHotel(hotel.id)}
                          onViewDetails={() => {
                            setDetailsId((prev) => (prev === hotel.id ? null : hotel.id))
                            bilamoHaptic(4)
                          }}
                        />
                        <AnimatePresence>
                          {detailsId === hotel.id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={springs.soft}
                              className="overflow-hidden px-5 pb-3"
                            >
                              <p className="text-[13px] leading-relaxed text-[var(--bilamo-text)]/75">
                                {hotel.reason
                                  || (uiLocale === 'ar'
                                    ? 'اخترت هذا الفندق لتوازن الموقع والهدوء وجودة الإقامة.'
                                    : 'I chose this stay for location calm, fit, and overnight value.')}
                              </p>
                              <p className="mt-1 text-[12px] text-[var(--bilamo-muted)]">
                                {hotel.area} · {hotel.nightsLabel} · {hotel.rating.toFixed(1)}
                              </p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                    {results.intel.map((card, i) => (
                      <motion.div
                        key={card.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springs.soft, delay: 0.04 * (results.flights.length + results.hotels.length + i) }}
                        className="bilamo-glass mx-0 rounded-[1.25rem] px-5 py-4"
                      >
                        <p className="text-[12.5px] tracking-[-0.01em] text-[var(--bilamo-muted)]">
                          {card.title}
                        </p>
                        <p className="mt-1 text-[14px] leading-snug text-[var(--bilamo-text)]/90">
                          {card.body}
                        </p>
                        {card.selectable ? (
                          <button
                            type="button"
                            className="mt-2 text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                            onClick={() => {
                              setSelectedId(card.id)
                              bilamoHaptic(4)
                              void sendWithMicStop(`select intel ${card.kind}`)
                            }}
                          >
                            {uiLocale === 'ar' ? 'اعتماد' : uiLocale === 'fr' ? 'Choisir' : 'Select'}
                          </button>
                        ) : null}
                      </motion.div>
                    ))}
                    {results.timeline.length > 0 ? (
                      <motion.div
                        layout
                        className="px-5 py-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ ...springs.gentle, delay: 0.12 }}
                      >
                        <TripTimeline items={results.timeline} />
                      </motion.div>
                    ) : null}
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </motion.section>
            )}
          </AnimatePresence>

          {!inConversation && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...springs.gentle, delay: 0.25 }}
              className="relative z-10 mt-auto px-1 text-center text-[12.5px] leading-relaxed text-[var(--bilamo-muted)]/70"
            >
              {copy.tip}
            </motion.p>
          )}

          <div className="sticky bottom-0 z-20 mt-6 flex flex-col items-center bg-gradient-to-t from-[var(--bilamo-bg)] via-[var(--bilamo-bg)] to-transparent pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
            <AnimatePresence mode="wait">
              {!composerOpen ? (
                <motion.button
                  key="type"
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setComposerOpen(true)}
                  className="min-h-11 text-[12px] tracking-[-0.01em] text-[var(--bilamo-muted)]/40 transition-colors hover:text-[var(--bilamo-muted)]/75"
                >
                  {copy.type}
                </motion.button>
              ) : (
                <motion.form
                  key="composer"
                  onSubmit={onSubmit}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={springs.soft}
                  className="bilamo-glass flex w-full items-end gap-2 rounded-full p-1.5 pl-5"
                >
                  <textarea
                    autoFocus
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (draft.trim() && !busy) void sendWithMicStop(draft)
                      }
                      if (e.key === 'Escape' && !inConversation) setComposerOpen(false)
                    }}
                    placeholder=""
                    aria-label="Message"
                    disabled={busy}
                    className="max-h-28 min-h-[40px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug tracking-[-0.01em] text-[var(--bilamo-text)] outline-none"
                  />
                  <Button
                    type="submit"
                    size="iconSm"
                    variant="primary"
                    disabled={busy || !draft.trim()}
                    aria-label="Send"
                    className="shrink-0"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </LayoutGroup>
    </BilamoShell>
  )
}
