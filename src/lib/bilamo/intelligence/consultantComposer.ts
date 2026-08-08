/**
 * Consultant response composer — explain, recommend, offer alternatives.
 * Keep prose tight; cards carry secondary options (source of truth).
 */

import type { TripRequirements } from '../../agent/types'
import type { BilamoReplyLocale } from '../speech/localeBridge'
import type { BilamoSearchBundle } from './types'

function money(amount: number, currency: string, locale: BilamoReplyLocale): string {
  const formatted = amount.toLocaleString(
    locale === 'ar' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : 'en-US',
  )
  if (locale === 'ar' && (currency === 'SAR' || currency === 'ر.س')) {
    return `${formatted} ر.س`
  }
  return `${currency} ${formatted}`
}

export function composeRecommendation(input: {
  requirements: TripRequirements
  search: BilamoSearchBundle
  locale: BilamoReplyLocale
  /** True when travelers were soft-defaulted to 1 */
  assumedSolo?: boolean
}): { displayText: string; spokenText: string } {
  const dest = input.requirements.destination || input.requirements.destinations[0] || 'your destination'
  const flight = input.search.flights[0]
  const locale = input.locale
  const emptyFlights = !input.search.flights.length
  const flightsMeta = input.search.flightsMeta
  const timedOut = /timeout/i.test(String(flightsMeta?.error || ''))
  const stale = flightsMeta?.stale === true

  const validationError = String(flightsMeta?.error || '')
  const sameCity = /same_city|same_airport|same_metro/i.test(validationError)
  const demoInventory = flightsMeta?.mode === 'demo' || flightsMeta?.inventorySource === 'demo'

  if (locale === 'ar') {
    if (emptyFlights) {
      const displayText = sameCity
        ? 'المسار غير صالح: المغادرة والوصول في نفس المدينة. حدّد وجهة مختلفة.'
        : timedOut
          ? 'تعذّر الوصول لمزوّد الرحلات لحظة. أقدر أبحث مجدداً أو بتواريخ مرنة.'
          : `لم أجد رحلات حية صالحة لـ ${dest} بهذه الشروط.`
      return {
        displayText,
        spokenText: sameCity
          ? 'المسار غير صالح. إلى أي مدينة تريد السفر؟'
          : 'لم أجد رحلة مناسبة بعد. هل نجرّب تواريخ أوسع؟',
      }
    }

    // Specific consultant line — never a repeated generic pick phrase.
    let displayText = flight
      ? `أنصح بـ ${flight.airline} إلى ${dest}.`
      : `رتّبت خيارات مناسبة إلى ${dest}.`
    if (demoInventory) displayText += ' (عينة توضيحية — ليست أسعاراً حية).'
    if (input.assumedSolo) displayText += ' افترضت أنك لوحدك.'
    if (stale) displayText += ' قد تتحرك الأسعار.'
    const spokenText = flight
      ? `أنصح بـ ${flight.airline} إلى ${dest}.`
      : `رتّبت خيارات لـ ${dest}.`
    return {
      displayText,
      spokenText: input.assumedSolo ? `${spokenText} افترضت أنك لوحدك.` : spokenText,
    }
  }

  if (locale === 'fr') {
    if (emptyFlights) {
      const displayText = sameCity
        ? 'Itinéraire invalide : départ et arrivée dans la même ville.'
        : timedOut
          ? 'Le fournisseur de vols a marqué une pause. Je peux relancer ou élargir les dates.'
          : `Je n'ai pas trouvé de vols live valides pour ${dest}.`
      return {
        displayText,
        spokenText: sameCity
          ? 'Itinéraire invalide. Quelle ville visez-vous ?'
          : 'Pas encore de vol solide. On élargit les dates ?',
      }
    }

    let displayText = flight
      ? `Je retiendrais ${flight.airline} pour ${dest}.`
      : `J'ai préparé des options pour ${dest}.`
    if (demoInventory) displayText += ' (échantillon — pas des tarifs live).'
    if (input.assumedSolo) displayText += ' Solo par défaut.'
    if (stale) displayText += ' Les tarifs ont pu bouger.'
    const spokenText = flight
      ? `Je retiendrais ${flight.airline} pour ${dest}.`
      : `J'ai préparé des options pour ${dest}.`
    return {
      displayText,
      spokenText: input.assumedSolo ? `${spokenText} Solo par défaut.` : spokenText,
    }
  }

  if (emptyFlights) {
    const displayText = sameCity
      ? 'Invalid route: origin and destination are the same city.'
      : timedOut
        ? 'The flight provider paused for a moment. I can retry or search with flexible dates.'
        : `I could not find valid live flights for ${dest} with those constraints.`
    return {
      displayText,
      spokenText: sameCity
        ? 'That route is invalid. Which city should we fly to?'
        : 'No strong flight yet. Shall we try more flexible dates?',
    }
  }

  let displayText = flight
    ? `I'd take ${flight.airline} to ${dest}.`
    : `I've shaped options for ${dest}.`
  if (demoInventory) displayText += ' (Sample inventory — not live prices).'
  if (input.assumedSolo) displayText += ' Solo assumed.'
  if (stale) displayText += ' Prices may have shifted.'
  const spokenText = flight
    ? `I'd take ${flight.airline} to ${dest}.`
    : `I've shaped options for ${dest}.`
  return {
    displayText,
    spokenText: input.assumedSolo ? `${spokenText} Solo assumed.` : spokenText,
  }
}

export function composeGreeting(locale: BilamoReplyLocale): { displayText: string; spokenText: string } {
  if (locale === 'ar') {
    const displayText = 'أهلاً بك. أنا بيلامو — مستشارك للسفر الفاخر. إلى أين تتخيّل الرحلة؟'
    return { displayText, spokenText: 'أهلاً بك. إلى أين تتخيّل الرحلة؟' }
  }
  if (locale === 'fr') {
    const displayText = 'Bonjour. Je suis Bilamo — votre conseiller voyage. Où imaginez-vous ce voyage ?'
    return { displayText, spokenText: 'Bonjour. Où imaginez-vous ce voyage ?' }
  }
  const displayText = 'Welcome. I am Bilamo — your luxury travel consultant. Where are you imagining this trip?'
  return { displayText, spokenText: 'Welcome. Where are you imagining this trip?' }
}

/** Progressive consultant status lines for perceived responsiveness. */
export function progressiveConsultantAck(locale: BilamoReplyLocale, phase: 0 | 1 | 2): string {
  if (locale === 'ar') {
    if (phase === 0) return 'تمام، فهمت.'
    if (phase === 1) return 'أبحث لك الآن.'
    return 'وجدت خيارات مناسبة.'
  }
  if (locale === 'fr') {
    if (phase === 0) return 'Très bien, j\'ai compris.'
    if (phase === 1) return 'Je cherche pour vous.'
    return 'J\'ai trouvé de bonnes options.'
  }
  if (phase === 0) return 'Got it.'
  if (phase === 1) return 'Looking for you now.'
  return 'I found solid options.'
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
