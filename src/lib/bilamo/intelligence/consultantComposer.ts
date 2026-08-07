/**
 * Consultant response composer — explain, recommend, offer alternatives.
 * Keep prose tight; cards carry secondary options.
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
    bits.push(locale === 'ar' ? `أمتعة ${flight.baggageSummary}` : `bags ${flight.baggageSummary}`)
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
  const hotel = input.search.hotels[0]
  const ctx = input.search.context
  const locale = input.locale
  const origin = input.requirements.origin
  const emptyFlights = !input.search.flights.length
  const flightsMeta = input.search.flightsMeta
  const timedOut = /timeout/i.test(String(flightsMeta?.error || ''))
  const stale = flightsMeta?.stale === true

  if (locale === 'ar') {
    if (emptyFlights) {
      const displayText = [
        timedOut
          ? `تعذّر الوصول لمزوّد الرحلات لحظة — لم أتركك بدون مسار.`
          : `لم أجد رحلة قوية لـ ${dest} بهذه التواريخ بعد.`,
        'أقترح: تواريخ أكثر مرونة، أو مغادرة من مدينة أخرى، أو وجهة قريبة بنفس الروح.',
        'قل لي أي مسار تفضّل وسأعيد البحث فوراً.',
      ].join('\n\n')
      return {
        displayText,
        spokenText: 'لم أجد رحلة مناسبة بعد. هل نجرّب تواريخ أوسع؟',
      }
    }

    const lines = [
      `توصيتي لـ ${dest}${origin ? ` من ${origin}` : ''}:`,
      input.assumedSolo
        ? 'افترضت أنك تسافر لوحدك — قل لي إن كان معك أحد.'
        : null,
      flight
        ? `${flight.kindLabel || 'الأفضل عموماً'} — ${flight.airline}، ${flight.stopsLabel}، ${money(flight.price, flight.currency)}.\nلماذا: ${explainFlight(flight, 'ar')}.`
        : null,
      altFlight
        ? `بديل: ${altFlight.airline} — ${money(altFlight.price, altFlight.currency)}. ${altFlight.reason || ''}`.trim()
        : null,
      hotel
        ? `للإقامة: ${hotel.name} في ${hotel.area} — ${money(hotel.price, hotel.currency)}. ${hotel.reason || ''}`.trim()
        : null,
      stale ? 'قد تكون الأسعار تحرّكت قليلاً — أخبرني إن أردت تحديثاً.' : null,
      ctx.weather ? `الطقس: ${ctx.weather}` : null,
      !origin ? 'إن كان مطار المغادرة غير الرياض، قل لي وسأعيد الترتيب.' : null,
      'اختر بطاقة، أو قارن، وسنكمل من هناك.',
    ].filter(Boolean) as string[]

    const spokenText = flight
      ? `أقترح ${flight.airline} لـ ${dest}. هل يناسبك؟`
      : `رتّبت خيارات لـ ${dest}.`

    return { displayText: lines.join('\n\n'), spokenText }
  }

  if (emptyFlights) {
    const displayText = [
      timedOut
        ? `The flight provider paused for a moment — I will not leave you without a path.`
        : `I could not find a strong flight match for ${dest} on those dates yet.`,
      'I suggest: more flexible dates, a different departure city, or a nearby destination with the same spirit.',
      'Tell me which path you prefer and I will search again immediately.',
    ].join('\n\n')
    return {
      displayText,
      spokenText: 'No strong flight yet. Shall we try more flexible dates?',
    }
  }

  const lines = [
    `My pick for ${dest}${origin ? ` from ${origin}` : ''}:`,
    input.assumedSolo
      ? 'I assumed you are traveling solo — tell me if someone is joining.'
      : null,
    flight
      ? `${flight.kindLabel || 'Best overall'} — ${flight.airline}, ${flight.stopsLabel}, ${money(flight.price, flight.currency)}.\nWhy: ${explainFlight(flight, 'en')}.`
      : null,
    altFlight
      ? `Alternative: ${altFlight.airline} — ${money(altFlight.price, altFlight.currency)}. ${altFlight.reason || ''}`.trim()
      : null,
    hotel
      ? `Stay: ${hotel.name} in ${hotel.area} — ${money(hotel.price, hotel.currency)}. ${hotel.reason || ''}`.trim()
      : null,
    stale ? 'Prices may have shifted slightly — say if you want a refresh.' : null,
    ctx.weather ? `Weather: ${ctx.weather}` : null,
    !origin ? 'If you are not departing from Riyadh, tell me your city and I will re-rank.' : null,
    'Select a card, or compare — we continue from there.',
  ].filter(Boolean) as string[]

  const spokenText = flight
    ? `I'd take the ${flight.airline} for ${dest}. ${String(flight.reason || '').split('.')[0]}.`
    : `I've shaped options for ${dest}.`

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
    await new Promise((r) => setTimeout(r, 12))
  }
  input.onDelta({ displayText: input.displayText, spokenText: input.spokenText })
}
