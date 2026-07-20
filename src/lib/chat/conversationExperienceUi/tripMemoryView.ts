/**
 * Sprint 42 — conversation memory chips for chat UI.
 * Reads Sprint 28 preference/memory shapes already attached to meta or assemblers.
 */

export interface ConversationMemoryChip {
  id: string
  label: string
  value: string
}

export function buildMemoryChips(
  memory: Record<string, unknown> | null | undefined,
  locale: 'ar' | 'en' = 'ar',
): ConversationMemoryChip[] {
  if (!memory) return []
  const chips: ConversationMemoryChip[] = []
  const push = (id: string, labelAr: string, labelEn: string, value: unknown) => {
    if (value == null || value === '') return
    const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value)
    if (!text.trim()) return
    chips.push({ id, label: locale === 'ar' ? labelAr : labelEn, value: text })
  }

  push('airlines', 'شركات مفضلة', 'Favorite airlines', memory.preferredAirlines ?? memory.airlines)
  push('seat', 'مقعد', 'Seat', memory.seatPreferences ?? memory.seat)
  push('hotel', 'فنادق مفضلة', 'Hotel preference', memory.preferredHotelBrands ?? memory.hotelPreference)
  const budget = memory.budgetRange && typeof memory.budgetRange === 'object'
    ? memory.budgetRange as { max?: number | null; currency?: string | null }
    : null
  if (budget?.max != null) {
    push('budget', 'ميزانية', 'Budget', `${budget.max} ${budget.currency ?? ''}`.trim())
  } else {
    push('budget', 'ميزانية', 'Budget', memory.budget)
  }
  push('loyalty', 'ولاء', 'Loyalty', formatLoyalty(memory.loyaltyPrograms ?? memory.loyalty))
  push('nationality', 'جنسية الجواز', 'Passport nationality',
    (memory.passportNationality as { nationality?: string } | undefined)?.nationality
    ?? memory.nationality)
  push('visa', 'تأشيرة', 'Visa history', memory.visaStatus ?? memory.visaHistory)

  return chips
}

function formatLoyalty(value: unknown): string {
  if (!Array.isArray(value)) return value == null ? '' : String(value)
  return value
    .map((row) => {
      if (typeof row === 'string') return row
      if (row && typeof row === 'object' && 'program' in row) {
        return String((row as { program: string }).program)
      }
      return ''
    })
    .filter(Boolean)
    .join(', ')
}
