/**
 * Consultant response composer — explain, recommend, offer alternatives.
 * Never dump raw search JSON. Voice lines stay short.
 */

import type { TripRequirements } from '../../agent/types'
import type { BilamoSearchBundle } from './types'

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US')}`
}

function explainFlight(flight: BilamoSearchBundle['flights'][number], locale: 'ar' | 'en'): string {
  const bits: string[] = []
  if (flight.reason) bits.push(flight.reason.replace(/\.$/, ''))
  if (flight.stopsLabel === 'Nonstop' || /غير متوقف|مباشر/i.test(flight.stopsLabel)) {
    bits.push(locale === 'ar' ? 'بدون توقف' : 'no connection risk')
  }
  if (flight.baggageSummary) {
    bits.push(locale === 'ar' ? `أمتعة: ${flight.baggageSummary}` : `bags: ${flight.baggageSummary}`)
  }
  if (flight.score != null) {
    bits.push(locale === 'ar' ? `درجة بيلامو ${flight.score}` : `Bilamo Score ${flight.score}/100`)
  }
  return bits.join(' · ')
}

export function composeRecommendation(input: {
  requirements: TripRequirements
  search: BilamoSearchBundle
  locale: 'ar' | 'en'
  /** True when travelers were soft-defaulted to 1 */
  assumedSolo?: boolean
}): { displayText: string; spokenText: string } {
  const dest = input.requirements.destination || input.requirements.destinations[0] || 'your destination'
  const flight = input.search.flights[0]
  const altFlight = input.search.flights[1]
  const third = input.search.flights[2]
  const hotel = input.search.hotels[0]
  const altHotel = input.search.hotels[1]
  const ctx = input.search.context
  const locale = input.locale
  const origin = input.requirements.origin

  if (locale === 'ar') {
    const lines = [
      `رتّبت لك خياراً واضحاً لـ ${dest}${origin ? ` من ${origin}` : ''}.`,
      input.assumedSolo
        ? 'افترضت أنك تسافر لوحدك — قل لي إن كان معك أحد وسأعدّل فوراً.'
        : null,
      flight
        ? `توصيتي الأولى للطيران: ${flight.airline}، ${flight.stopsLabel}، ${money(flight.price, flight.currency)}.\nلماذا: ${explainFlight(flight, 'ar')}.`
        : null,
      altFlight
        ? `بديل قوي: ${altFlight.airline} في ${altFlight.departTime} — ${money(altFlight.price, altFlight.currency)}. ${altFlight.reason}`
        : null,
      third
        ? `خيار ثالث: ${third.airline} — ${money(third.price, third.currency)}. ${third.reason}`
        : null,
      hotel
        ? `للإقامة أقترح ${hotel.name} في ${hotel.area} (${hotel.nightsLabel}) — ${money(hotel.price, hotel.currency)}.\nلماذا: ${hotel.reason}`
        : null,
      altHotel ? `بديل هادئ: ${altHotel.name}.` : null,
      ctx.weather ? `الطقس: ${ctx.weather}` : null,
      ctx.visa ? `التأشيرة: ${ctx.visa}` : null,
      ctx.timeDifference ? `الفرق الزمني: ${ctx.timeDifference}` : null,
      !origin ? 'إن كان مطار المغادرة مختلفاً عن الرياض، قل لي وسأعيد الترتيب.' : null,
      'هل نمضي على توصيتي، أم تفضّل مقارنة أوسع؟',
    ].filter(Boolean) as string[]

    const spokenText = flight && hotel
      ? `أقترح ${flight.airline} و${hotel.name} لـ ${dest}. هل يناسبك؟`
      : `رتّبت خيارات لـ ${dest}. هل تريد التفاصيل؟`

    return { displayText: lines.join('\n\n'), spokenText }
  }

  const lines = [
    `Here is what I would choose for ${dest}${origin ? ` from ${origin}` : ''}.`,
    input.assumedSolo
      ? 'I assumed you are traveling solo — tell me if someone is joining and I will reshape instantly.'
      : null,
    flight
      ? `${flight.kindLabel || 'Best overall'} — ${flight.airline}, ${flight.stopsLabel}, ${money(flight.price, flight.currency)}.\nWhy this one: ${explainFlight(flight, 'en')}.`
      : null,
    altFlight
      ? `${altFlight.kindLabel || 'Strong alternative'} — ${altFlight.airline} at ${altFlight.departTime}, ${money(altFlight.price, altFlight.currency)}. ${altFlight.reason}`
      : null,
    third
      ? `${third.kindLabel || 'Alternative'} — ${third.airline}, ${third.stopsLabel}, ${money(third.price, third.currency)}. ${third.reason}`
      : null,
    hotel
      ? `For the stay, ${hotel.name} in ${hotel.area} (${hotel.nightsLabel}) — ${money(hotel.price, hotel.currency)}.\nWhy: ${hotel.reason}`
      : null,
    altHotel ? `If you prefer another address: ${altHotel.name}.` : null,
    ctx.weather ? `Weather: ${ctx.weather}` : null,
    ctx.visa ? `Entry: ${ctx.visa}` : null,
    ctx.currency ? ctx.currency : null,
    ctx.timeDifference ? `Time: ${ctx.timeDifference}` : null,
    ctx.transfer ? ctx.transfer : null,
    !origin ? 'If you are not departing from Riyadh, tell me your city and I will re-rank.' : null,
    'Shall we proceed with my recommendation, or compare further?',
  ].filter(Boolean) as string[]

  const spokenText = flight
    ? `I'd take the ${flight.airline} ${flight.stopsLabel.toLowerCase()} for ${dest}. ${flight.reason.split('.')[0]}.`
    : `I've shaped options for ${dest}. Want the details?`

  return { displayText: lines.join('\n\n'), spokenText }
}

export function composeGreeting(locale: 'ar' | 'en'): { displayText: string; spokenText: string } {
  if (locale === 'ar') {
    const displayText = 'أهلاً بك. أنا بيلامو — مستشارك للسفر الفاخر. إلى أين تتخيّل الرحلة؟'
    return { displayText, spokenText: 'أهلاً بك. إلى أين تتخيّل الرحلة؟' }
  }
  const displayText = 'Welcome. I am Bilamo — your luxury travel consultant. Where are you imagining this trip?'
  return { displayText, spokenText: 'Welcome. Where are you imagining this trip?' }
}

/** Stream consultant text in natural phrase chunks (tuned for perceived speed). */
export async function streamConsultantText(input: {
  displayText: string
  spokenText: string
  onDelta?: (partial: { displayText: string; spokenText: string }) => void
  signal?: AbortSignal
}): Promise<void> {
  if (!input.onDelta) return
  const parts = input.displayText.split(/(?<=[.!?؟])\s+/).filter(Boolean)
  let acc = ''
  for (let i = 0; i < parts.length; i += 1) {
    if (input.signal?.aborted) return
    acc = acc ? `${acc} ${parts[i]}` : parts[i]
    input.onDelta({
      displayText: acc,
      spokenText: i === parts.length - 1 ? input.spokenText : input.spokenText.split(/[.!?؟]/)[0] || input.spokenText,
    })
    // Short phrase cadence — keeps presence without feeling slow.
    await new Promise((r) => setTimeout(r, 12))
  }
  input.onDelta({ displayText: input.displayText, spokenText: input.spokenText })
}
