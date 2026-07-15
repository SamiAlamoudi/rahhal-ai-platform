import type {
  AccommodationRecommendation,
  AgentLocale,
  EstimatedBudget,
  ItineraryDay,
  TransportationItem,
  TripPlan,
  TripRequirements,
} from './types'
import { t } from './locale'

const CITY_PLAYBOOK: Record<string, { hubs: string[]; vibes: string[] }> = {
  Japan: {
    hubs: ['Tokyo', 'Kyoto', 'Osaka'],
    vibes: ['temples', 'street food', 'modern districts', 'day trip'],
  },
  Riyadh: {
    hubs: ['Diriyah', 'Olaya', 'Boulevard World'],
    vibes: ['heritage', 'dining', 'family entertainment', 'museums'],
  },
  Jeddah: {
    hubs: ['Historic Jeddah', 'Corniche', 'Red Sea Mall'],
    vibes: ['waterfront', 'cafes', 'old town', 'families'],
  },
  Dubai: {
    hubs: ['Downtown', 'Marina', 'Old Dubai'],
    vibes: ['skyline', 'shopping', 'desert', 'beach'],
  },
  Paris: {
    hubs: ['Louvre area', 'Marais', 'Montmartre'],
    vibes: ['museums', 'cafes', 'walks', 'river cruise'],
  },
  Istanbul: {
    hubs: ['Sultanahmet', 'Karaköy', 'Kadıköy'],
    vibes: ['bazaars', 'ferries', 'mosques', 'street food'],
  },
  London: {
    hubs: ['Westminster', 'South Bank', 'Shoreditch'],
    vibes: ['museums', 'parks', 'markets', 'theatre'],
  },
  Cairo: {
    hubs: ['Giza', 'Islamic Cairo', 'Zamalek'],
    vibes: ['pyramids', 'souks', 'nile', 'culture'],
  },
  Maldives: {
    hubs: ['Resort island', 'House reef', 'Sandbank'],
    vibes: ['snorkel', 'relax', 'sunset', 'spa'],
  },
  Bali: {
    hubs: ['Ubud', 'Canggu', 'Uluwatu'],
    vibes: ['rice terraces', 'temples', 'surf', 'cafes'],
  },
}

export function buildTripPlan(input: {
  requirements: TripRequirements
  conversationId: string
  locale: AgentLocale
  seed?: string
}): TripPlan {
  const destination = input.requirements.destination
    || input.requirements.destinations[0]
    || (input.locale === 'ar' ? 'وجهة مقترحة' : 'Suggested destination')
  const durationDays = resolveDuration(input.requirements)
  const travelers = input.requirements.travelers
  const costingTravelers = travelers ?? assumedTravelersForCosting(input.requirements.travelerType)
  const destinations = unique([
    destination,
    ...input.requirements.destinations,
    ...splitMultiCity(destination, durationDays),
  ])

  const dailyItinerary = buildDays({
    destination,
    destinations,
    durationDays,
    locale: input.locale,
    interests: input.requirements.interests,
    travelerType: input.requirements.travelerType,
    tripPurpose: input.requirements.tripPurpose,
    seed: input.seed ?? `${destination}-${durationDays}`,
  })

  const transportation = buildTransportation({
    destination,
    destinations,
    origin: input.requirements.origin,
    locale: input.locale,
    currency: input.requirements.budgetCurrency || 'USD',
  })

  const accommodations = buildAccommodations({
    destination,
    destinations,
    locale: input.locale,
    travelerType: input.requirements.travelerType,
    tripPurpose: input.requirements.tripPurpose,
    currency: input.requirements.budgetCurrency || 'USD',
  })

  const estimatedBudget = estimateBudget({
    requirements: input.requirements,
    durationDays,
    travelers: costingTravelers,
    destinations,
  })

  const title = input.locale === 'ar'
    ? `رحلة ${durationDays} ${durationDays === 1 ? 'يوم' : 'أيام'} إلى ${destination}`
    : `${durationDays}-day trip to ${destination}`

  const notes = buildNotes(input.requirements, input.locale, estimatedBudget, travelers == null)

  return {
    id: `plan_${hashSeed(`${input.conversationId}:${destination}:${durationDays}:${input.seed ?? ''}`)}`,
    title,
    locale: input.locale,
    destinations,
    startDate: input.requirements.startDate,
    endDate: input.requirements.endDate || deriveEndDate(input.requirements.startDate, durationDays),
    durationDays,
    travelers,
    travelerType: input.requirements.travelerType,
    interests: [...input.requirements.interests],
    dailyItinerary,
    activities: dailyItinerary,
    transportation,
    accommodations,
    estimatedBudget,
    estimatedCosts: estimatedBudget,
    notes,
    conversationId: input.conversationId,
    requirements: input.requirements,
    updatedAt: new Date().toISOString(),
  }
}

/** @deprecated Prefer buildTripPlan */
export const buildTravelItinerary = buildTripPlan

export function applyTripPlanEdits(
  plan: TripPlan,
  patch: Partial<TripRequirements>,
  locale: AgentLocale,
): TripPlan {
  const requirements = {
    ...plan.requirements,
    ...patch,
    destinations: patch.destinations?.length
      ? patch.destinations
      : plan.requirements.destinations,
    interests: patch.interests?.length
      ? patch.interests
      : plan.requirements.interests,
    destination: patch.destination ?? plan.requirements.destination,
  }
  return buildTripPlan({
    requirements,
    conversationId: plan.conversationId,
    locale,
    seed: `edit-${Date.now()}`,
  })
}

/** @deprecated Prefer applyTripPlanEdits */
export const applyItineraryEdits = applyTripPlanEdits

function resolveDuration(requirements: TripRequirements): number {
  if (requirements.durationDays != null) return Math.min(21, Math.max(1, requirements.durationDays))
  if (requirements.startDate && requirements.endDate) {
    const start = Date.parse(requirements.startDate)
    const end = Date.parse(requirements.endDate)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.min(21, Math.max(1, Math.round((end - start) / 86_400_000) + 1))
    }
  }
  return 3
}

function assumedTravelersForCosting(type: TripRequirements['travelerType']): number {
  if (type === 'solo' || type === 'business') return 1
  if (type === 'couple') return 2
  if (type === 'family') return 3
  if (type === 'friends') return 3
  return 2
}

function splitMultiCity(destination: string, days: number): string[] {
  const playbook = CITY_PLAYBOOK[destination]
  if (!playbook || days < 5) return [destination]
  return playbook.hubs.slice(0, Math.min(3, Math.ceil(days / 3)))
}

function buildDays(input: {
  destination: string
  destinations: string[]
  durationDays: number
  locale: AgentLocale
  interests: string[]
  travelerType: TripRequirements['travelerType']
  tripPurpose: TripRequirements['tripPurpose']
  seed: string
}): ItineraryDay[] {
  const playbook = CITY_PLAYBOOK[input.destination] ?? {
    hubs: input.destinations,
    vibes: ['highlights', 'local food', 'neighborhood walk', 'flexible afternoon'],
  }
  const days: ItineraryDay[] = []
  for (let day = 1; day <= input.durationDays; day += 1) {
    const hub = playbook.hubs[(day - 1) % playbook.hubs.length] || input.destination
    const vibe = playbook.vibes[(day - 1) % playbook.vibes.length]
    const interest = input.interests[(day - 1) % Math.max(1, input.interests.length)] || null
    const family = input.travelerType === 'family' || input.tripPurpose === 'family'
    const business = input.travelerType === 'business' || input.tripPurpose === 'business'
    days.push({
      day,
      title: input.locale === 'ar' ? `اليوم ${day}: ${hub}` : `Day ${day}: ${hub}`,
      location: hub,
      activities: [
        {
          time: business ? '08:30' : '09:00',
          title: business
            ? t(input.locale, { ar: `صباح عمل في ${hub}`, en: `Work morning in ${hub}` })
            : (input.locale === 'ar' ? `صباح في ${hub}` : `Morning in ${hub}`),
          description: interest
            ? (input.locale === 'ar' ? `تركيز على ${interest}` : `Focus on ${interest}`)
            : (input.locale === 'ar' ? `استكشاف ${vibe}` : `Explore ${vibe}`),
        },
        {
          time: '13:00',
          title: input.locale === 'ar' ? 'غداء محلي' : 'Local lunch',
          description: family
            ? t(input.locale, { ar: 'خيار مناسب للعائلات', en: 'Family-friendly option' })
            : business
              ? t(input.locale, { ar: 'غداء سريع قرب منطقة العمل', en: 'Quick lunch near the business district' })
              : t(input.locale, { ar: 'تجربة طعام محلي', en: 'Local food experience' }),
        },
        {
          time: business ? '18:00' : '16:00',
          title: input.locale === 'ar' ? `مسائي في ${hub}` : `Afternoon in ${hub}`,
          description: t(input.locale, {
            ar: day === input.durationDays ? 'وقت مرن أو تسوق للهدايا' : 'نشاط اختياري أو استراحة',
            en: day === input.durationDays ? 'Flexible time or souvenir shopping' : 'Optional activity or rest',
          }),
        },
      ],
    })
  }
  if (hashSeed(input.seed) % 2 === 1 && days[0]?.activities[1]) {
    days[0].activities[1].title = input.locale === 'ar' ? 'غداء مع إطلالة' : 'Lunch with a view'
  }
  return days
}

function buildAccommodations(input: {
  destination: string
  destinations: string[]
  locale: AgentLocale
  travelerType: TripRequirements['travelerType']
  tripPurpose: TripRequirements['tripPurpose']
  currency: string
}): AccommodationRecommendation[] {
  const area = input.destinations[0] || input.destination
  const honeymoon = input.tripPurpose === 'honeymoon' || input.travelerType === 'couple'
  const business = input.tripPurpose === 'business' || input.travelerType === 'business'
  const family = input.tripPurpose === 'family' || input.travelerType === 'family'
  const nightly = input.currency === 'SAR' ? 450 : input.currency === 'AED' ? 420 : 140

  const primary: AccommodationRecommendation = {
    name: honeymoon
      ? t(input.locale, { ar: `منتجع رومانسي قرب ${area}`, en: `Romantic resort near ${area}` })
      : business
        ? t(input.locale, { ar: `فندق أعمال في ${area}`, en: `Business hotel in ${area}` })
        : family
          ? t(input.locale, { ar: `شقة عائلية في ${area}`, en: `Family apartment in ${area}` })
          : t(input.locale, { ar: `فندق وسط ${area}`, en: `Central hotel in ${area}` }),
    area,
    category: honeymoon ? 'resort' : family ? 'apartment' : business ? 'hotel' : 'boutique',
    fit: honeymoon
      ? t(input.locale, { ar: 'إطلالة خاصة وإيقاع هادئ', en: 'Private feel and quieter pacing' })
      : business
        ? t(input.locale, { ar: 'قريب من المواصلات وخدمات العمل', en: 'Near transit and work amenities' })
        : family
          ? t(input.locale, { ar: 'مساحة أكبر ومطبخ صغير', en: 'More space and a small kitchen' })
          : t(input.locale, { ar: 'موقع مركزي للتنقل اليومي', en: 'Central base for daily exploring' }),
    estimatedNightly: nightly,
    currency: input.currency,
  }

  const secondary: AccommodationRecommendation = {
    name: t(input.locale, {
      ar: `خيار متوسط الميزانية في ${area}`,
      en: `Mid-budget stay in ${area}`,
    }),
    area,
    category: 'hotel',
    fit: t(input.locale, {
      ar: 'توازن بين الموقع والسعر (يحتاج تأكيد مزود الفنادق لاحقاً)',
      en: 'Balance of location and price (hotel tool confirms later)',
    }),
    estimatedNightly: Math.round(nightly * 0.7),
    currency: input.currency,
  }

  return [primary, secondary]
}

function buildTransportation(input: {
  destination: string
  destinations: string[]
  origin: string | null
  locale: AgentLocale
  currency: string
}): TransportationItem[] {
  const items: TransportationItem[] = [
    {
      mode: 'flight',
      from: input.origin || (input.locale === 'ar' ? 'مدينتك' : 'Your city'),
      to: input.destinations[0] || input.destination,
      notes: t(input.locale, {
        ar: 'رحلات مباشرة إن توفرت؛ وإلا أفضل توقف واحد',
        en: 'Prefer nonstop when available; otherwise one stop',
      }),
      estimatedCost: null,
      currency: input.currency,
    },
  ]
  if (input.destinations.length > 1) {
    for (let i = 0; i < input.destinations.length - 1; i += 1) {
      items.push({
        mode: 'train_or_transfer',
        from: input.destinations[i],
        to: input.destinations[i + 1],
        notes: t(input.locale, {
          ar: 'انتقال داخلي بين المدن في الخطة',
          en: 'Intercity transfer within the plan',
        }),
        estimatedCost: null,
        currency: input.currency,
      })
    }
  }
  items.push({
    mode: 'local',
    from: input.destination,
    to: input.destination,
    notes: t(input.locale, {
      ar: 'مترو/مشي/تطبيقات توصيل للتنقل اليومي',
      en: 'Metro / walking / ride-hail for daily moves',
    }),
    estimatedCost: null,
    currency: input.currency,
  })
  return items
}

function estimateBudget(input: {
  requirements: TripRequirements
  durationDays: number
  travelers: number
  destinations: string[]
}): EstimatedBudget {
  const currency = input.requirements.budgetCurrency || 'USD'
  const perDay = currency === 'SAR' ? 700 : currency === 'AED' ? 650 : 180
  const stay = perDay * 0.55 * input.durationDays * input.travelers
  const food = perDay * 0.25 * input.durationDays * input.travelers
  const local = perDay * 0.12 * input.durationDays * input.travelers
  const activities = perDay * 0.08 * input.durationDays * input.travelers
  const multiCityBump = Math.max(0, input.destinations.length - 1) * (currency === 'USD' ? 120 : 400)
  let amount = Math.round(stay + food + local + activities + multiCityBump)
  if (input.requirements.budgetAmount != null) {
    amount = Math.min(amount, Math.round(input.requirements.budgetAmount))
  }
  return {
    amount,
    currency,
    breakdown: [
      { label: 'stay', amount: Math.round(stay) },
      { label: 'food', amount: Math.round(food) },
      { label: 'local_transport', amount: Math.round(local) },
      { label: 'activities', amount: Math.round(activities) },
      { label: 'intercity', amount: Math.round(multiCityBump) },
    ],
  }
}

function buildNotes(
  requirements: TripRequirements,
  locale: AgentLocale,
  budget: EstimatedBudget,
  travelersUnknown: boolean,
): string[] {
  const notes: string[] = []
  notes.push(t(locale, {
    ar: 'هذه خطة أولية قابلة للتعديل من المحادثة.',
    en: 'This is a draft plan you can edit from the conversation.',
  }))
  if (travelersUnknown) {
    notes.push(t(locale, {
      ar: 'عدد المسافرين غير مؤكد — تقدير التكلفة افترض حجماً تقريبياً فقط.',
      en: 'Traveler count is unconfirmed — cost estimates use a provisional party size only.',
    }))
  }
  if (requirements.budgetAmount != null) {
    notes.push(t(locale, {
      ar: `الميزانية المستهدفة: ${requirements.budgetAmount} ${budget.currency}`,
      en: `Target budget: ${requirements.budgetAmount} ${budget.currency}`,
    }))
  }
  if (requirements.tripPurpose === 'honeymoon') {
    notes.push(t(locale, {
      ar: 'تم ضبط الإيقاع والإقامة لرحلة شهر عسل.',
      en: 'Pacing and stays tuned for a honeymoon trip.',
    }))
  }
  if (requirements.tripPurpose === 'business' || requirements.travelerType === 'business') {
    notes.push(t(locale, {
      ar: 'تم إدخال فترات عمل وهدوء مسائي لرحلة عمل.',
      en: 'Includes work blocks and quieter evenings for a business trip.',
    }))
  }
  if (requirements.travelerType === 'family' || requirements.tripPurpose === 'family') {
    notes.push(t(locale, {
      ar: 'تم تفضيل أنشطة مناسبة للعائلات وأوقات مرنة.',
      en: 'Enriched with family-friendly pacing and flexible blocks.',
    }))
  }
  if (requirements.interests.length) {
    notes.push(t(locale, {
      ar: `اهتمامات مرعية: ${requirements.interests.join('، ')}`,
      en: `Interests reflected: ${requirements.interests.join(', ')}`,
    }))
  }
  notes.push(t(locale, {
    ar: 'أدوات الطيران/الفنادق/الطقس ستُربط لاحقاً دون تغيير محرك المحادثة.',
    en: 'Flight/hotel/weather tools will plug in later without changing the chat engine.',
  }))
  if (requirements.notes) notes.push(requirements.notes)
  return notes
}

function deriveEndDate(start: string | null, days: number): string | null {
  if (!start) return null
  const ms = Date.parse(start)
  if (!Number.isFinite(ms)) return null
  const end = new Date(ms + (days - 1) * 86_400_000)
  return end.toISOString().slice(0, 10)
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}

function hashSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return hash
}
