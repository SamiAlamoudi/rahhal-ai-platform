/**
 * Parallel Search Orchestrator — one request → multi-domain bundle.
 * Flights ∥ Hotels ∥ Transfer ∥ Weather ∥ Visa ∥ Currency ∥ Time difference.
 * Flights go through Bilamo FlightSearchProvider (demo by default, live via server API).
 */

import { enrichMockHotel } from '../../agent/hotelSearchEngine/normalize'
import type { TripRequirements } from '../../agent/types'
import {
  createBilamoFlightSearchProvider,
  recommendFlights,
  scoredOfferToBilamoFlight,
  type BilamoFlightSearchRequest,
  type FlightSearchProvider,
} from '../flights'
import {
  isValidRenderableFlight,
  resolveDestinationAirport,
  resolveOriginAirport,
  validateFlightRoute,
} from './flightRouteValidation'
import type {
  BilamoContextIntel,
  BilamoFlightOption,
  BilamoHotelOption,
  BilamoSearchBundle,
} from './types'

function toFlightSearchRequest(
  req: TripRequirements,
  signal?: AbortSignal,
): { request: BilamoFlightSearchRequest } | { error: string } {
  const destLabel = req.destination || req.destinations[0] || null
  if (!destLabel) return { error: 'missing_destination' }

  const destination = resolveDestinationAirport(destLabel)
  const origin = resolveOriginAirport(req.origin, 'RUH')
  const route = validateFlightRoute(origin, destination)
  if (!route.ok) {
    return { error: route.reason }
  }

  const preferred = req.preferredAirline ? [req.preferredAirline] : []
  const cabinRaw = (req.cabinPreference || 'economy').toLowerCase()
  const cabin = cabinRaw.includes('business')
    ? 'business' as const
    : cabinRaw.includes('first')
      ? 'first' as const
      : cabinRaw.includes('premium')
        ? 'premium_economy' as const
        : 'economy' as const

  const directOnly = /prefer_direct|direct|nonstop|non-stop|مباشر|بدون\s*توقف/i.test(req.notes || '')

  return {
    request: {
      origin: route.origin,
      destination: route.destination,
      departureDate: req.startDate || '2026-09-12',
      returnDate: req.endDate,
      adults: Math.max(1, (req.travelers ?? 1) - Math.max(0, req.children ?? 0)),
      children: Math.max(0, req.children ?? 0),
      infants: /\binfant|baby|رضيع|رضع/i.test(req.notes || '') ? 1 : 0,
      cabin,
      directOnly,
      preferredAirlines: preferred,
      maxStops: directOnly ? 0 : null,
      currency: req.budgetCurrency || 'SAR',
      signal,
    },
  }
}

async function searchFlights(
  req: TripRequirements,
  options?: {
    signal?: AbortSignal
    provider?: FlightSearchProvider
    onProgress?: (message: string) => void
    locale?: 'ar' | 'en'
  },
): Promise<{
  flights: BilamoFlightOption[]
  meta: NonNullable<BilamoSearchBundle['flightsMeta']>
}> {
  const built = toFlightSearchRequest(req, options?.signal)
  if ('error' in built) {
    return {
      flights: [],
      meta: {
        mode: 'demo',
        error: built.error,
        stale: false,
        bestScore: null,
        validation: built.error,
        inventorySource: 'unavailable',
      },
    }
  }
  const request = built.request

  const locale = options?.locale === 'en' ? 'en' : 'ar'
  options?.onProgress?.(
    locale === 'ar' ? 'لديّ ما يكفي للبحث.' : 'I have enough information to search.',
  )
  const provider = options?.provider ?? createBilamoFlightSearchProvider()
  options?.onProgress?.(
    locale === 'ar'
      ? (request.directOnly
        ? 'أقارن الرحلات المباشرة أولاً.'
        : 'أقارن المباشرة وخيارات التوقف الواحد.')
      : (request.directOnly
        ? 'Comparing direct options first.'
        : 'Comparing direct and one-stop options.'),
  )

  const result = await provider.searchFlights(request)
  const validOffers = (result.offers || []).filter((o) =>
    isValidRenderableFlight({ origin: o.origin, destination: o.destination }),
  )
  const recommendation = recommendFlights(validOffers, request, {
    mode: result.mode,
    error: result.error,
    stale: Boolean(result.error && result.ok),
    locale,
  })

  if (!recommendation) {
    return {
      flights: [],
      meta: {
        mode: result.mode,
        error: result.error || 'no_offers',
        stale: false,
        bestScore: null,
        validation: result.offers?.length && !validOffers.length
          ? 'same_city'
          : 'ok',
        inventorySource: result.mode === 'live' ? 'live' : 'demo',
      },
    }
  }

  options?.onProgress?.(
    locale === 'ar'
      ? `وجدت ${recommendation.display.length} خيارات قوية.`
      : `I found ${recommendation.display.length} strong choice${recommendation.display.length === 1 ? '' : 's'}.`,
  )
  if (recommendation.best.kind === 'best') {
    options?.onProgress?.(recommendation.best.reason)
  }

  const flights = recommendation.display
    .map(scoredOfferToBilamoFlight)
    .filter((f) => isValidRenderableFlight(f))
    .map((f) => ({
      ...f,
      source: result.mode === 'live' ? 'live' as const : 'demo' as const,
      provider: result.mode === 'live' ? 'amadeus' : 'demo',
      fetchedAt: f.fetchedAt || new Date().toISOString(),
    }))

  return {
    flights,
    meta: {
      mode: recommendation.mode,
      error: recommendation.error,
      stale: recommendation.stale,
      bestScore: recommendation.best.score,
      validation: flights.length ? 'ok' : 'no_offers',
      inventorySource: recommendation.mode === 'live' ? 'live' : 'demo',
    },
  }
}

async function searchHotels(
  req: TripRequirements,
  locale: 'ar' | 'en' = 'ar',
): Promise<BilamoHotelOption[]> {
  // Hotels are demo/sample until a live hotel provider is wired — never look live.
  const city = req.destinationCity || req.destination || req.destinations[0] || 'City'
  const currency = req.budgetCurrency || 'SAR'
  const nights = req.durationDays ?? 4
  const hotelPref = (req.hotelPreference || '').toLowerCase()
  const luxury = hotelPref.includes('luxury') || hotelPref.includes('فاخر')
    || req.budgetStyle === 'luxury'
  const fetchedAt = new Date().toISOString()

  const nameA = locale === 'ar'
    ? (luxury ? `إقامة فاخرة في ${city}` : `إقامة موصى بها في ${city}`)
    : (luxury ? `Luxury stay in ${city}` : `Recommended stay in ${city}`)
  const nameB = locale === 'ar'
    ? `خيار مركزي في ${city}`
    : `Central option in ${city}`

  const raw = [
    enrichMockHotel({
      city,
      currency,
      pricePerNight: luxury ? 920 : 620,
      stars: 5,
      hotelName: nameA,
      rating: 4.8,
    }, 0),
    enrichMockHotel({
      city,
      currency,
      pricePerNight: luxury ? 780 : 480,
      stars: 4,
      hotelName: nameB,
      rating: 4.5,
    }, 1),
  ]

  return raw.map((h, i) => ({
    id: h.hotelId || `bilamo-h-${i}`,
    name: h.hotelName,
    area: locale === 'ar' ? 'وسط المدينة' : 'City center',
    rating: h.rating ?? (i === 0 ? 4.8 : 4.5),
    nightsLabel: locale === 'ar'
      ? (nights === 1 ? 'ليلة واحدة' : `${nights} ليالٍ`)
      : (nights === 1 ? '1 night' : `${nights} nights`),
    price: Math.round((h.pricePerNight || 500) * nights),
    currency: h.currency || currency,
    reason: locale === 'ar'
      ? (i === 0
        ? 'عينة إقامة — ليست توفّراً حياً.'
        : 'خيار تجريبي مركزي — للتوضيح فقط.')
      : (i === 0
        ? 'Sample stay — not live inventory.'
        : 'Sample central option — illustrative only.'),
    score: 96 - i * 10,
    source: 'demo' as const,
    provider: 'demo',
    fetchedAt,
  }))
}

async function searchTransfer(req: TripRequirements, locale: 'ar' | 'en'): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  return locale === 'ar'
    ? `نقل خاص من المطار عند الوصول إلى ${dest} (حوالي 45–60 دقيقة).`
    : `Private airport transfer arranged on arrival in ${dest} (~45–60 min).`
}

async function searchWeather(req: TripRequirements, locale: 'ar' | 'en'): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const month = req.startDate ? new Date(req.startDate).getUTCMonth() : new Date().getUTCMonth()
  const mild = month >= 3 && month <= 5 || month >= 8 && month <= 10
  if (locale === 'ar') {
    return mild
      ? `${dest}: طقس لطيف للمشي — طبقات خفيفة كافية.`
      : `${dest}: طقس موسمي — طبقة مرنة للمساء مفيدة.`
  }
  return mild
    ? `${dest}: mild and pleasant for walking — light layers recommended.`
    : `${dest}: expect seasonal weather — pack a versatile layer for evenings.`
}

async function searchVisa(req: TripRequirements, locale: 'ar' | 'en'): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const lower = dest.toLowerCase()
  const isYemen = /yemen|اليمن/.test(lower)
  if (isYemen) {
    return locale === 'ar'
      ? 'اليمن: أتحقق من متطلبات الدخول لجوازك قبل تثبيت أي شيء.'
      : 'Yemen: I will verify entry requirements for your passport before we lock anything.'
  }
  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('osaka') || /اليابان|طوكيو/.test(dest)) {
    return locale === 'ar'
      ? 'اليابان: معظم جوازات الخليج تدخل بدون تأشيرة للإقامة القصيرة — نؤكد قبل السفر.'
      : 'Japan: most Gulf passport holders can enter visa-free for short stays — confirm before travel.'
  }
  if (lower.includes('dubai') || lower.includes('istanbul') || lower.includes('maldives')) {
    return locale === 'ar'
      ? `${dest}: الدخول عادةً سلس للإقامة القصيرة — أؤكد قواعد جوازك.`
      : `${dest}: typically straightforward entry for short leisure stays — I will confirm your passport rules.`
  }
  return locale === 'ar'
    ? `${dest}: أتحقق من التأشيرة وفق جواز سفرك قبل التثبيت.`
    : `${dest}: I will verify visa requirements against your passport before we lock anything.`
}

async function searchCurrency(req: TripRequirements, locale: 'ar' | 'en'): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const lower = dest.toLowerCase()
  if (locale === 'ar') {
    if (lower.includes('japan') || lower.includes('tokyo') || /اليابان|طوكيو/.test(dest)) {
      return 'العملة المحلية: الين الياباني (JPY). البطاقات شائعة في المدن.'
    }
    if (/yemen|اليمن/.test(lower)) return 'العملة المحلية: الريال اليمني (YER).'
    if (lower.includes('istanbul') || lower.includes('turkey')) return 'العملة المحلية: الليرة التركية (TRY).'
    if (lower.includes('paris') || lower.includes('rome') || lower.includes('lisbon') || lower.includes('barcelona')) {
      return 'العملة المحلية: اليورو (EUR).'
    }
    if (lower.includes('dubai') || lower.includes('uae')) return 'العملة المحلية: الدرهم الإماراتي (AED).'
    if (lower.includes('london')) return 'العملة المحلية: الجنيه الإسترليني (GBP).'
    return `أعرض الأسعار بـ ${req.budgetCurrency || 'ر.س'} مع ملاحظة العملة المحلية.`
  }
  if (lower.includes('japan') || lower.includes('tokyo')) return 'Local currency: Japanese Yen (JPY). Cards widely accepted in cities.'
  if (lower.includes('istanbul') || lower.includes('turkey')) return 'Local currency: Turkish Lira (TRY).'
  if (lower.includes('paris') || lower.includes('rome') || lower.includes('lisbon') || lower.includes('barcelona')) {
    return 'Local currency: Euro (EUR).'
  }
  if (lower.includes('dubai') || lower.includes('uae')) return 'Local currency: UAE Dirham (AED).'
  if (lower.includes('london')) return 'Local currency: British Pound (GBP).'
  return `I will quote options in ${req.budgetCurrency || 'SAR'} and note the local currency on the ground.`
}

async function searchTimeDifference(req: TripRequirements, locale: 'ar' | 'en'): Promise<string | null> {
  const dest = req.destination || req.destinations[0]
  if (!dest) return null
  const lower = dest.toLowerCase()
  if (locale === 'ar') {
    if (lower.includes('japan') || lower.includes('tokyo') || /اليابان|طوكيو/.test(dest)) {
      return 'حوالي +6 ساعات عن الرياض — اجعل أول مساء هادئاً.'
    }
    if (/yemen|اليمن/.test(lower)) return 'فرق التوقيت عن الرياض طفيف — وصول مريح.'
    if (lower.includes('london') || lower.includes('paris') || lower.includes('lisbon')) {
      return 'حوالي −2 إلى −3 ساعات عن الرياض — إرهاق خفيف.'
    }
    if (lower.includes('dubai')) return 'نفس توقيت الرياض — وصول سهل.'
    if (lower.includes('istanbul')) return 'حوالي −1 ساعة عن الرياض.'
    return 'أضبط يوم الوصول على التوقيت المحلي ليكون هادئاً.'
  }
  if (lower.includes('japan') || lower.includes('tokyo')) return 'About +6 hours ahead of Riyadh — plan a soft first evening.'
  if (lower.includes('london') || lower.includes('paris') || lower.includes('lisbon')) {
    return 'Roughly −2 to −3 hours from Riyadh — mild jet lag.'
  }
  if (lower.includes('dubai')) return 'Same time zone as Riyadh — easy arrival.'
  if (lower.includes('istanbul')) return 'About −1 hour from Riyadh.'
  return 'I will align your first day to the local clock so arrival feels calm.'
}

function buildTimeline(
  req: TripRequirements,
  flight: BilamoFlightOption | null,
  hotel: BilamoHotelOption | null,
  locale: 'ar' | 'en',
): BilamoSearchBundle['timeline'] {
  const dest = req.destination || req.destinations[0] || (locale === 'ar' ? 'الوجهة' : 'destination')
  const items: BilamoSearchBundle['timeline'] = []
  const day1Morning = locale === 'ar' ? 'اليوم الأول · صباحًا' : 'Day 1 · Morning'
  const day1Midday = locale === 'ar' ? 'اليوم الأول · الظهر' : 'Day 1 · Midday'
  const day1Evening = locale === 'ar' ? 'اليوم الأول · مساءً' : 'Day 1 · Evening'
  if (flight) {
    items.push({
      id: 'tl-arrive',
      time: day1Morning,
      title: locale === 'ar' ? `الوصول إلى ${dest}` : `Arrive ${dest}`,
      detail: locale === 'ar'
        ? `${flight.airline} · ${flight.departTime} → ${flight.arriveTime}. وصول هادئ.`
        : `${flight.airline} · ${flight.departTime} → ${flight.arriveTime}. Soft landing.`,
      kind: 'flight',
    })
  }
  items.push({
    id: 'tl-transfer',
    time: day1Midday,
    title: locale === 'ar' ? 'الانتقال من المطار' : 'Airport transfer',
    detail: locale === 'ar'
      ? 'سيارة خاصة إلى الإقامة — بدون استعجال.'
      : 'Private car to your stay — no rushing.',
    kind: 'transfer',
  })
  if (hotel) {
    items.push({
      id: 'tl-hotel',
      time: day1Evening,
      title: hotel.name,
      detail: `${hotel.area}. ${hotel.reason}`,
      kind: 'hotel',
    })
  }
  return items
}

export async function runBilamoSearchOrchestrator(input: {
  requirements: TripRequirements
  signal?: AbortSignal
  flightProvider?: FlightSearchProvider
  onFlightProgress?: (message: string) => void
  locale?: 'ar' | 'en'
}): Promise<BilamoSearchBundle> {
  const req = input.requirements
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const [
    flightPack,
    hotels,
    transfer,
    weather,
    visa,
    currency,
    timeDifference,
  ] = await Promise.all([
    searchFlights(req, {
      signal: input.signal,
      provider: input.flightProvider,
      onProgress: input.onFlightProgress,
      locale,
    }),
    searchHotels(req, locale),
    searchTransfer(req, locale),
    searchWeather(req, locale),
    searchVisa(req, locale),
    searchCurrency(req, locale),
    searchTimeDifference(req, locale),
  ])

  if (input.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const flights = flightPack.flights
  // Do not attach sample hotels when the flight route itself is invalid.
  const routeBlocked = /same_city|same_airport|same_metro|missing_|invalid_airport/i.test(
    String(flightPack.meta.error || ''),
  )
  const safeHotels = routeBlocked ? [] : hotels
  const context: BilamoContextIntel = {
    weather: routeBlocked ? null : weather,
    visa: routeBlocked ? null : visa,
    currency: routeBlocked ? null : currency,
    timeDifference: routeBlocked ? null : timeDifference,
    transfer: routeBlocked ? null : transfer,
  }

  return {
    flights,
    hotels: safeHotels,
    context,
    timeline: buildTimeline(req, flights[0] ?? null, safeHotels[0] ?? null, locale),
    flightsMeta: flightPack.meta,
  }
}
