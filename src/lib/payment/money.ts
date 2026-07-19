/**
 * Shared money formatting for checkout / order surfaces.
 */

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'USD',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('en-US')} ${currency}`
  }
}
