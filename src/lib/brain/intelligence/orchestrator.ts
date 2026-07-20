/**
 * Sprint 53 — Live Intelligence orchestrator.
 * Called only from RahhalBrain. No parallel pipeline.
 */

import type { AgentMemory } from '../../agent/types'
import type { BrainIntentResult, ConversationUnderstanding } from '../core/types'
import { liveCacheGet, liveCacheSet, liveCacheStats, resetLiveCache } from './cache'
import { selectLiveDomains } from './domainSelection'
import { getLiveEventHistory } from './eventBus'
import { isRealWorldIntelligenceEnabled } from './feature'
import { recordLiveSample } from './observability'
import {
  createDefaultLiveProviders,
  providersForDomains,
  type LiveProvider,
} from './providers'
import {
  circuitAllow,
  circuitFailure,
  circuitSuccess,
} from './resilience'
import type {
  EventSignal,
  ExchangeSignal,
  FlightOffer,
  HotelOffer,
  LiveDomain,
  LiveEventType,
  LiveIntelligenceSnapshot,
  LiveQuery,
  PriceWatchSignal,
  SafetySignal,
  TransportSignal,
  VisaSignal,
  WeatherSignal,
} from './types'

export interface GatherLiveIntelligenceInput {
  userText: string
  memory: AgentMemory
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  enabled?: boolean
  providers?: LiveProvider[]
  now?: Date
}

/**
 * Sync entry used by RahhalBrain. Mock providers resolve immediately;
 * live HTTP adapters should prefetch into cache before the turn.
 */
export function gatherLiveIntelligence(
  input: GatherLiveIntelligenceInput,
): LiveIntelligenceSnapshot {
  if (!isRealWorldIntelligenceEnabled({ enabled: input.enabled })) {
    return emptySnapshot()
  }

  const started = Date.now()
  const domains = selectLiveDomains(input)
  if (domains.length === 0) return emptySnapshot()

  const providers = providersForDomains(
    input.providers ?? createDefaultLiveProviders(),
    domains,
  )

  const query = buildQuery(input)
  const state: {
    flights: FlightOffer[]
    hotels: HotelOffer[]
    weather: WeatherSignal | null
    visa: VisaSignal | null
    events: EventSignal | null
    safety: SafetySignal | null
    exchange: ExchangeSignal | null
    transport: TransportSignal | null
    priceWatch: PriceWatchSignal | null
  } = {
    flights: [],
    hotels: [],
    weather: null,
    visa: null,
    events: null,
    safety: null,
    exchange: null,
    transport: null,
    priceWatch: null,
  }
  let degraded = false
  let cacheHits = 0
  let cacheMisses = 0
  const providerIds: string[] = []

  for (const provider of providers) {
    const meta = provider.metadata()
    providerIds.push(meta.providerId)
    const cacheKey = `live:${meta.domain}:${query.destination ?? ''}:${query.startDate ?? ''}:${query.origin ?? ''}`
    const cached = liveCacheGet<unknown>(cacheKey)
    if (cached.hit === 'fresh') cacheHits += 1
    else if (cached.hit === 'miss') cacheMisses += 1
    else cacheHits += 1

    const callStarted = Date.now()
    try {
      if (!circuitAllow(meta.providerId)) {
        if (cached.value != null) {
          degraded = true
          applyDomain(state, meta.domain, cached.value)
          recordLiveSample({
            domain: meta.domain,
            providerId: meta.providerId,
            latencyMs: Date.now() - callStarted,
            ok: true,
            cacheHit: true,
            degraded: true,
            at: new Date().toISOString(),
          })
          continue
        }
        throw new Error(`circuit_open:${meta.providerId}`)
      }

      let value: unknown
      if (cached.hit === 'fresh' && cached.value != null) {
        value = cached.value
      } else {
        value = resolveSync(provider.search(query), meta.providerId)
        liveCacheSet(cacheKey, value, ttlFor(meta.domain), ttlFor(meta.domain) * 4)
      }

      circuitSuccess(meta.providerId, Date.now() - callStarted)
      applyDomain(state, meta.domain, value)

      recordLiveSample({
        domain: meta.domain,
        providerId: meta.providerId,
        latencyMs: Date.now() - callStarted,
        ok: true,
        cacheHit: cached.hit !== 'miss',
        degraded: false,
        at: new Date().toISOString(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      circuitFailure(meta.providerId, message)
      degraded = true
      if (cached.value != null) {
        applyDomain(state, meta.domain, cached.value)
      }
      recordLiveSample({
        domain: meta.domain,
        providerId: meta.providerId,
        latencyMs: Date.now() - callStarted,
        ok: false,
        cacheHit: cached.hit !== 'miss',
        degraded: true,
        at: new Date().toISOString(),
      })
      // Graceful degradation — never crash the conversation.
    }
  }

  const eventsEmitted = [...new Set(
    getLiveEventHistory()
      .slice(-20)
      .map((e) => e.type),
  )] as LiveEventType[]

  const confidence = average([
    state.flights[0]?.confidence,
    state.hotels[0]?.confidence,
    state.weather?.confidence,
    state.visa?.confidence,
    state.events?.confidence,
    state.safety?.confidence,
    state.exchange?.confidence,
    state.transport?.confidence,
    state.priceWatch?.confidence,
  ].filter((v): v is number => typeof v === 'number'))

  const stats = liveCacheStats()
  return {
    domains,
    flights: state.flights,
    hotels: state.hotels,
    weather: state.weather,
    visa: state.visa,
    events: state.events,
    safety: state.safety,
    exchange: state.exchange,
    transport: state.transport,
    priceWatch: state.priceWatch,
    providerIds,
    eventsEmitted,
    cacheHits: cacheHits || stats.hits,
    cacheMisses: cacheMisses || stats.misses,
    degraded,
    latencyMs: Date.now() - started,
    confidence,
    summary: composeSummary({
      locale: input.memory.locale,
      flights: state.flights,
      hotels: state.hotels,
      weather: state.weather,
      visa: state.visa,
      safety: state.safety,
      priceWatch: state.priceWatch,
      degraded,
    }),
  }
}

function buildQuery(input: GatherLiveIntelligenceInput): LiveQuery {
  const req = input.memory.requirements
  return {
    domain: 'flight',
    destination: req.destination
      ?? (input.understanding.travelContext.hasDestination ? req.destinations[0] : null)
      ?? null,
    origin: req.origin ?? 'Riyadh',
    startDate: req.startDate,
    endDate: req.endDate,
    adults: req.travelers,
    currency: req.budgetCurrency ?? 'SAR',
    nationality: 'SA',
    cabin: null,
    budgetAmount: req.budgetAmount,
    locale: input.memory.locale,
    now: input.now ?? new Date(),
  }
}

function ttlFor(domain: LiveDomain): number {
  switch (domain) {
    case 'weather':
      return 15 * 60_000
    case 'exchange':
      return 60 * 60_000
    case 'visa':
    case 'safety':
      return 6 * 60 * 60_000
    case 'event':
      return 3 * 60 * 60_000
    case 'price_watch':
    case 'flight':
    case 'hotel':
      return 2 * 60_000
    case 'transport':
      return 10 * 60_000
    default:
      return 60_000
  }
}

function applyDomain(
  state: {
    flights: FlightOffer[]
    hotels: HotelOffer[]
    weather: WeatherSignal | null
    visa: VisaSignal | null
    events: EventSignal | null
    safety: SafetySignal | null
    exchange: ExchangeSignal | null
    transport: TransportSignal | null
    priceWatch: PriceWatchSignal | null
  },
  domain: LiveDomain,
  value: unknown,
): void {
  switch (domain) {
    case 'flight':
      state.flights = value as FlightOffer[]
      break
    case 'hotel':
      state.hotels = value as HotelOffer[]
      break
    case 'weather':
      state.weather = value as WeatherSignal
      break
    case 'visa':
      state.visa = value as VisaSignal
      break
    case 'event':
      state.events = value as EventSignal
      break
    case 'safety':
      state.safety = value as SafetySignal
      break
    case 'exchange':
      state.exchange = value as ExchangeSignal
      break
    case 'transport':
      state.transport = value as TransportSignal
      break
    case 'price_watch':
      state.priceWatch = value as PriceWatchSignal
      break
  }
}

function composeSummary(input: {
  locale: 'ar' | 'en'
  flights: FlightOffer[]
  hotels: HotelOffer[]
  weather: WeatherSignal | null
  visa: VisaSignal | null
  safety: SafetySignal | null
  priceWatch: PriceWatchSignal | null
  degraded: boolean
}): string | null {
  const parts: string[] = []
  const ar = input.locale === 'ar'
  if (input.flights[0]) {
    parts.push(ar
      ? `طيران: ${input.flights[0].airline} ${input.flights[0].price.amount} ${input.flights[0].price.currency}`
      : `Flight: ${input.flights[0].airline} ${input.flights[0].price.amount} ${input.flights[0].price.currency}`)
  }
  if (input.hotels[0]) {
    parts.push(ar
      ? `فندق: ${input.hotels[0].name} (${input.hotels[0].guestRating})`
      : `Hotel: ${input.hotels[0].name} (${input.hotels[0].guestRating})`)
  }
  if (input.weather) {
    parts.push(ar
      ? `طقس: ${input.weather.currentC}°C ${input.weather.condition}`
      : `Weather: ${input.weather.currentC}°C ${input.weather.condition}`)
  }
  if (input.visa) {
    parts.push(ar
      ? `تأشيرة: ${input.visa.requirement}`
      : `Visa: ${input.visa.requirement}`)
  }
  if (input.safety && input.safety.advisoryLevel !== 'none') {
    parts.push(ar
      ? `سلامة: ${input.safety.advisoryLevel}`
      : `Safety: ${input.safety.advisoryLevel}`)
  }
  if (input.priceWatch?.watches.some((w) => w.notify === 'drop')) {
    parts.push(ar ? 'تنبيه: انخفاض سعر' : 'Alert: price drop')
  }
  if (input.degraded) {
    parts.push(ar ? '(بيانات احتياطية)' : '(degraded/cached)')
  }
  return parts.length ? parts.join(' · ') : null
}

function emptySnapshot(): LiveIntelligenceSnapshot {
  return {
    domains: [],
    flights: [],
    hotels: [],
    weather: null,
    visa: null,
    events: null,
    safety: null,
    exchange: null,
    transport: null,
    priceWatch: null,
    providerIds: [],
    eventsEmitted: [],
    cacheHits: 0,
    cacheMisses: 0,
    degraded: false,
    latencyMs: 0,
    confidence: 0,
    summary: null,
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0.5
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Prefer sync mock values; live HTTP adapters must prefetch into cache before the turn. */
function resolveSync<T>(value: T | Promise<T>, providerId: string): T {
  if (value != null && typeof (value as Promise<T>).then === 'function') {
    throw new Error(`async_provider_requires_prefetch:${providerId}`)
  }
  return value as T
}

export { resetLiveCache }
