import type { BookingOffer, MoneyAmount } from './types'

/** Simple FX table for simulation — live FX adapters replace this later. */
const FX_TO_SAR: Record<string, number> = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.1,
  GBP: 4.8,
  AED: 1.02,
  JPY: 0.025,
}

export function normalizeCurrencyCode(raw: string | null | undefined): string {
  const code = (raw || 'SAR').trim().toUpperCase()
  return code || 'SAR'
}

export function convertMoney(amount: MoneyAmount, targetCurrency: string): MoneyAmount {
  const from = normalizeCurrencyCode(amount.currency)
  const to = normalizeCurrencyCode(targetCurrency)
  const fromRate = FX_TO_SAR[from] ?? 1
  const toRate = FX_TO_SAR[to] ?? 1
  const inSar = amount.amount * fromRate
  const converted = toRate === 0 ? inSar : inSar / toRate
  return {
    amount: Math.round(converted * 100) / 100,
    currency: to,
    normalizedAmount: Math.round(converted * 100) / 100,
    normalizedCurrency: to,
  }
}

export function normalizeOfferCurrency(offer: BookingOffer, targetCurrency: string): BookingOffer {
  const converted = convertMoney(offer.price, targetCurrency)
  return {
    ...offer,
    price: {
      ...offer.price,
      normalizedAmount: converted.amount,
      normalizedCurrency: converted.currency,
    },
  }
}

export function normalizeIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

export function nightsBetween(start: string | null | undefined, end: string | null | undefined): number {
  const a = normalizeIsoDate(start)
  const b = normalizeIsoDate(end)
  if (!a || !b) return 1
  const ms = Date.parse(b) - Date.parse(a)
  if (!Number.isFinite(ms) || ms <= 0) return 1
  return Math.max(1, Math.round(ms / 86_400_000))
}

export function offerFingerprint(offer: BookingOffer): string {
  const airline = (offer.airline || '').toLowerCase()
  const chain = (offer.hotelChain || '').toLowerCase()
  const durationBand = offer.durationMinutes != null
    ? String(Math.round(offer.durationMinutes / 60))
    : ''
  const priceBand = String(Math.round((offer.price.normalizedAmount ?? offer.price.amount) / 250))
  const layover = offer.layoverCount == null ? '' : String(offer.layoverCount)
  const stars = offer.stars == null ? '' : String(offer.stars)
  const walkBand = offer.walkingDistanceMeters == null
    ? ''
    : String(Math.round(offer.walkingDistanceMeters / 250))
  if (offer.domain === 'flights') {
    return ['flights', airline, durationBand, layover, priceBand].join('|')
  }
  if (offer.domain === 'hotels') {
    return ['hotels', stars, walkBand, priceBand].join('|')
  }
  const title = offer.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 24)
  return [offer.domain, airline || chain, priceBand, title].join('|')
}
