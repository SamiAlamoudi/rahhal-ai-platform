/**
 * Consultant response composer — explain, recommend, offer alternatives.
 * Keep prose tight; cards carry secondary options (source of truth).
 */

import type { TripRequirements } from '../../agent/types'
import type { BilamoSearchBundle } from './types'

function money(amount: number, currency: string, locale: 'ar' | 'en'): string {
  const formatted = amount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
  if (locale === 'ar' && (currency === 'SAR' || currency === 'ر.س')) {
    return `${formatted} ر.س`
  }
  return `${currency} ${formatted}`
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
  const hotel = input.search.hotels[0]
  const locale = input.locale
  const emptyFlights = !input.search.flights.length
  const flightsMeta = input.search.flightsMeta
  const timedOut = /timeout/i.test(String(flightsMeta?.error || ''))
  const stale = flightsMeta?.stale === true

  if (locale === 'ar') {
    if (emptyFlights) {
      const displayText = timedOut
        ? 'تعذّر الوصول لمزوّد الرحلات لحظة. أقدر أبحث مجدداً أو بتواريخ مرنة.'
        : `لم أجد رحلة مناسبة لـ ${dest} بهذه الشروط. أقدر أبحث بتوقيت مرن.`
      return {
        displayText,
        spokenText: 'لم أجد رحلة مناسبة بعد. هل نجرّب تواريخ أوسع؟',
      }
    }

    const lines = [
      `هذا ما أختاره لك إلى ${dest}.`,
      input.assumedSolo ? 'افترضت أنك تسافر لوحدك — قل لي إن كان معك أحد.' : null,
      hotel ? `وللإقامة: ${hotel.name}.` : null,
      stale ? 'قد تكون الأسعار تحرّكت — قل لي إن أردت تحديثاً.' : null,
    ].filter(Boolean) as string[]

    const spokenText = flight
      ? `أقترح ${flight.airline} لـ ${dest}. ${String(flight.reason || '').split(/[.!?؟]/)[0]}.`
      : `رتّبت خيارات لـ ${dest}.`

    return { displayText: lines.join(' '), spokenText }
  }

  if (emptyFlights) {
    const displayText = timedOut
      ? 'The flight provider paused for a moment. I can retry or search with flexible dates.'
      : `I could not find a strong flight for ${dest} with those constraints. I can search with flexible timing.`
    return {
      displayText,
      spokenText: 'No strong flight yet. Shall we try more flexible dates?',
    }
  }

  const lines = [
    `Here is my pick for ${dest}.`,
    input.assumedSolo ? 'I assumed you are traveling solo — tell me if someone is joining.' : null,
    hotel ? `For the stay: ${hotel.name}.` : null,
    stale ? 'Prices may have shifted — say if you want a refresh.' : null,
  ].filter(Boolean) as string[]

  const spokenText = flight
    ? `I'd take the ${flight.airline} for ${dest}. ${String(flight.reason || '').split(/[.!?]/)[0]}.`
    : `I've shaped options for ${dest}.`

  return { displayText: lines.join(' '), spokenText }
}

export function composeGreeting(locale: 'ar' | 'en'): { displayText: string; spokenText: string } {
  if (locale === 'ar') {
    const displayText = 'أهلاً بك. أنا بيلامو — مستشارك للسفر الفاخر. إلى أين تتخيّل الرحلة؟'
    return { displayText, spokenText: 'أهلاً بك. إلى أين تتخيّل الرحلة؟' }
  }
  const displayText = 'Welcome. I am Bilamo — your luxury travel consultant. Where are you imagining this trip?'
  return { displayText, spokenText: 'Welcome. Where are you imagining this trip?' }
}

/** Progressive consultant status lines for perceived responsiveness. */
export function progressiveConsultantAck(locale: 'ar' | 'en', phase: 0 | 1 | 2): string {
  if (locale === 'ar') {
    if (phase === 0) return 'فهمتك.'
    if (phase === 1) return 'أبحث الآن عن أفضل الخيارات.'
    return 'أقارن بين الرحلات المباشرة والأسرع.'
  }
  if (phase === 0) return 'Got it.'
  if (phase === 1) return 'I am looking for the best options now.'
  return 'Comparing nonstop and fastest flights.'
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

/** @deprecated kept for callers that still format money in prose */
export function formatConsultantMoney(amount: number, currency: string, locale: 'ar' | 'en'): string {
  return money(amount, currency, locale)
}
