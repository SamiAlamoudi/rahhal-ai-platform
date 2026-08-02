import type { BrainRecommendationsBundle } from '../../brain'
import type { UserPreferenceProfile } from '../../brain/preferences/types'
import type { TravelDraft } from '../../brain/travel/types'
import type { ExplainedRecommendation } from '../types'

export function buildExplainedRecommendations(
  bundle: BrainRecommendationsBundle,
  prefs: UserPreferenceProfile,
  draft: TravelDraft,
  locale: 'ar' | 'en' = 'en',
): ExplainedRecommendation[] {
  const out: ExplainedRecommendation[] = []
  const ar = locale === 'ar'

  const flights = bundle.flights.slice(0, 3)
  flights.forEach((scored, index) => {
    const item = scored.item
    const alt = flights.filter((_, i) => i !== index).slice(0, 2)
    const preferred = prefs.favoriteAirlines.some(
      (a) => a.toLowerCase() === item.airline.toLowerCase(),
    )
    const priceDelta = draft.budgetAmount
      ? Math.round(((draft.budgetAmount - item.price) / draft.budgetAmount) * 100)
      : item.price < 1200
        ? 18
        : 8
    const why = preferred
      ? ar
        ? `هذه الرحلة تناسب تفضيلك السابق لـ ${item.airline}.`
        : `This flight matches your preferred airline, ${item.airline}.`
      : prefs.travelStyle === 'business' || item.quality >= 0.9
        ? ar
          ? 'مسافرو الأعمال عادةً يفضّلون هذه الرحلة.'
          : 'Business travelers usually prefer this flight.'
        : item.stops === 0
          ? ar
            ? 'أقصر اتصال — بدون توقف.'
            : 'Shortest connection — nonstop.'
          : ar
            ? `السعر أقل بنحو ${Math.abs(priceDelta)}٪ من متوسط ميزانيتك.`
            : `Price is about ${Math.abs(priceDelta)}% ${priceDelta >= 0 ? 'lower' : 'above'} than your budget band.`

    out.push({
      id: item.id,
      kind: 'flight',
      title: `${item.origin} → ${item.destination}`,
      subtitle: `${item.airline} · ${item.durationHours}h · ${item.stops === 0 ? (ar ? 'مباشر' : 'Nonstop') : `${item.stops} stop`}`,
      priceLabel: `${item.currency} ${item.price.toLocaleString()}`,
      why,
      pros: [
        item.stops === 0
          ? ar
            ? 'بدون توقف'
            : 'Nonstop convenience'
          : ar
            ? 'مرونة في التوقيت'
            : 'Flexible timing',
        ar ? 'رضا مسافرين مرتفع' : 'Highest traveler satisfaction',
        preferred ? (ar ? 'يطابق ذوقك' : 'Matches your taste') : ar ? 'جودة مقصورة جيدة' : 'Strong cabin quality',
      ],
      cons: [
        item.price > (draft.budgetAmount ?? Infinity)
          ? ar
            ? 'أعلى من الميزانية المذكورة'
            : 'Above stated budget'
          : ar
            ? 'قد يمتلئ سريعاً في الذروة'
            : 'May sell out in peak weeks',
      ],
      confidence: scored.score,
      alternatives: alt.map((a) => ({
        id: a.item.id,
        title: `${a.item.airline} ${a.item.origin}→${a.item.destination}`,
        why: ar ? 'بديل بهدوء مماثل' : 'A calm alternative with similar balance',
      })),
      badges: [
        item.stops === 0 ? (ar ? 'أقصر اتصال' : 'Shortest connection') : '',
        priceDelta >= 10 ? (ar ? `أقل ${priceDelta}%` : `${priceDelta}% below average`) : '',
        preferred ? (ar ? 'مفضّل لديك' : 'Your preference') : '',
      ].filter(Boolean),
    })
  })

  for (const scored of bundle.hotels.slice(0, 2)) {
    const item = scored.item
    const luxuryMatch =
      prefs.luxuryLevel === 'premium' ||
      prefs.luxuryLevel === 'ultra' ||
      prefs.travelStyle === 'luxury' ||
      item.stars >= 5
    out.push({
      id: item.id,
      kind: 'hotel',
      title: item.name,
      subtitle: `${item.city} · ${item.stars}★`,
      priceLabel: `${item.currency} ${item.pricePerNight}/night`,
      why: luxuryMatch
        ? ar
          ? 'هذا الفندق يطابق إقاماتك الفاخرة السابقة.'
          : 'This hotel matches your previous luxury stays.'
        : ar
          ? 'توازن هادئ بين الموقع والراحة.'
          : 'A quiet balance of location and comfort.',
      pros: [
        ar ? 'أجواء هادئة' : 'Calm atmosphere',
        ar ? 'موقع مناسب للتنقّل' : 'Easy transfers',
      ],
      cons: [
        item.stars >= 5
          ? ar
            ? 'سعر أعلى لليالي الذروة'
            : 'Higher peak-night rates'
          : ar
            ? 'مرافق أقل من الفئة الفاخرة'
            : 'Fewer ultra-luxury amenities',
      ],
      confidence: scored.score,
      alternatives: bundle.hotels.slice(1, 3).map((h) => ({
        id: h.item.id,
        title: h.item.name,
        why: ar ? 'خيار بديل بنفس الروح' : 'Alternative with a similar spirit',
      })),
      badges: [luxuryMatch ? (ar ? 'فاخر مألوف' : 'Familiar luxury') : (ar ? 'راحة ذكية' : 'Smart comfort')],
    })
  }

  for (const scored of bundle.packages.slice(0, 1)) {
    const item = scored.item
    out.push({
      id: item.id,
      kind: 'package',
      title: item.title,
      subtitle: `${item.nights} ${ar ? 'ليالٍ' : 'nights'} · ${item.destination}`,
      priceLabel: `${item.currency} ${item.totalPrice.toLocaleString()}`,
      why: ar
        ? 'باقة متماسكة تقلّل قراراتك اليومية.'
        : 'A composed package that reduces daily decisions.',
      pros: [
        item.includesFlight ? (ar ? 'شامل الطيران' : 'Flight included') : '',
        item.includesHotel ? (ar ? 'شامل الإقامة' : 'Stay included') : '',
      ].filter(Boolean),
      cons: [ar ? 'مرونة أقل من الحجز المنفصل' : 'Less flexibility than à-la-carte'],
      confidence: scored.score,
      alternatives: [],
      badges: [ar ? 'هدوء منظم' : 'Composed calm'],
    })
  }

  return out
}
