/**
 * Consultant response composer — explain, recommend, offer alternatives.
 * Never dump raw search JSON. Voice lines stay short.
 */

import type { TripRequirements } from '../../agent/types'
import type { BilamoSearchBundle } from './types'

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US')}`
}

export function composeRecommendation(input: {
  requirements: TripRequirements
  search: BilamoSearchBundle
  locale: 'ar' | 'en'
}): { displayText: string; spokenText: string } {
  const dest = input.requirements.destination || input.requirements.destinations[0] || 'your destination'
  const flight = input.search.flights[0]
  const altFlight = input.search.flights[1]
  const hotel = input.search.hotels[0]
  const altHotel = input.search.hotels[1]
  const ctx = input.search.context
  const locale = input.locale

  if (locale === 'ar') {
    const lines = [
      `رتّبت لك خياراً واضحاً لـ ${dest}.`,
      flight
        ? `الخيار الأول للطيران: ${flight.airline}، ${flight.stopsLabel}، ${money(flight.price, flight.currency)}. السبب: ${flight.reason}`
        : null,
      altFlight
        ? `بديل قوي: ${altFlight.airline} في ${altFlight.departTime} — ${money(altFlight.price, altFlight.currency)}.`
        : null,
      hotel
        ? `للإقامة أقترح ${hotel.name} في ${hotel.area} (${hotel.nightsLabel}) — ${money(hotel.price, hotel.currency)}. ${hotel.reason}`
        : null,
      altHotel ? `بديل هادئ: ${altHotel.name}.` : null,
      ctx.weather ? `الطقس: ${ctx.weather}` : null,
      ctx.visa ? `التأشيرة: ${ctx.visa}` : null,
      ctx.timeDifference ? `الفرق الزمني: ${ctx.timeDifference}` : null,
      'هل نمضي على هذا، أم تفضّل تعديلاً بسيطاً؟',
    ].filter(Boolean) as string[]

    const spokenText = flight && hotel
      ? `أقترح ${flight.airline} و${hotel.name} لـ ${dest}. هل يناسبك؟`
      : `رتّبت خيارات لـ ${dest}. هل تريد التفاصيل؟`

    return { displayText: lines.join('\n\n'), spokenText }
  }

  const third = input.search.flights[2]
  const scoreBit = flight?.score != null ? ` Bilamo Score ${flight.score}/100.` : ''
  const lines = [
    `Here is what I would choose for ${dest}.`,
    flight
      ? `${flight.kindLabel || 'Best overall'} — ${flight.airline}, ${flight.stopsLabel}, ${money(flight.price, flight.currency)}.${scoreBit} ${flight.reason}`
      : null,
    altFlight
      ? `${altFlight.kindLabel || 'Alternative'} — ${altFlight.airline} at ${altFlight.departTime}, ${money(altFlight.price, altFlight.currency)}. ${altFlight.reason}`
      : null,
    third
      ? `${third.kindLabel || 'Alternative'} — ${third.airline}, ${third.stopsLabel}, ${money(third.price, third.currency)}. ${third.reason}`
      : null,
    hotel
      ? `For the stay, ${hotel.name} in ${hotel.area} (${hotel.nightsLabel}) — ${money(hotel.price, hotel.currency)}. ${hotel.reason}`
      : null,
    altHotel ? `If you prefer another address: ${altHotel.name}.` : null,
    ctx.weather ? `Weather: ${ctx.weather}` : null,
    ctx.visa ? `Entry: ${ctx.visa}` : null,
    ctx.currency ? ctx.currency : null,
    ctx.timeDifference ? `Time: ${ctx.timeDifference}` : null,
    ctx.transfer ? ctx.transfer : null,
    'Shall we proceed with this, or adjust lightly?',
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

/** Stream consultant text in natural phrase chunks. */
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
    // Natural pause between consultant phrases (non-blocking yield).
    await new Promise((r) => setTimeout(r, 28))
  }
  input.onDelta({ displayText: input.displayText, spokenText: input.spokenText })
}
