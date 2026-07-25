/**
 * Integration Sprint 9 — lightweight currency abstraction (no live FX rewrite).
 */

const RATES_TO_SAR: Record<string, number> = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.05,
  GBP: 4.75,
  AED: 1.02,
  MAD: 0.38,
}

export function normalizeCurrency(code: string | null | undefined): string {
  const c = (code ?? 'SAR').trim().toUpperCase()
  return c || 'SAR'
}

export function convertAmount(amount: number, from: string, to: string): number {
  const src = normalizeCurrency(from)
  const dst = normalizeCurrency(to)
  if (src === dst) return amount
  const toSar = amount * (RATES_TO_SAR[src] ?? 1)
  const rate = RATES_TO_SAR[dst] ?? 1
  return Math.round((toSar / rate) * 100) / 100
}

export function formatMoney(amount: number, currency: string): string {
  return `${Math.round(amount)} ${normalizeCurrency(currency)}`
}
