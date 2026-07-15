import type { TripRequirements, AgentLocale } from '../types'
import type { AgentToolName } from './types'

/** Derive deterministic tool input from trip requirements (no vendor coupling). */
export function buildToolInput(
  tool: AgentToolName,
  requirements: TripRequirements,
  locale: AgentLocale,
): Record<string, unknown> {
  const destination = requirements.destination || requirements.destinations[0] || ''
  const travelers = requirements.travelers ?? (
    requirements.travelerType === 'solo' || requirements.travelerType === 'business'
      ? 1
      : requirements.travelerType === 'couple'
        ? 2
        : 2
  )
  const currency = requirements.budgetCurrency || 'USD'
  const durationDays = requirements.durationDays ?? 3

  switch (tool) {
    case 'flights':
      return {
        origin: requirements.origin || 'RUH',
        destination,
        startDate: requirements.startDate,
        endDate: requirements.endDate,
        travelers,
        locale,
      }
    case 'hotels':
      return {
        destination,
        checkIn: requirements.startDate,
        nights: Math.max(1, durationDays - 1),
        travelers,
        budgetAmount: requirements.budgetAmount,
        currency,
        locale,
      }
    case 'weather':
      return {
        destination,
        startDate: requirements.startDate,
        durationDays,
        locale,
      }
    case 'maps':
      return {
        destination,
        hubs: requirements.destinations.length > 0 ? requirements.destinations : [destination],
        locale,
      }
    case 'currency':
      return {
        amount: requirements.budgetAmount ?? 1000,
        fromCurrency: currency,
        toCurrency: guessLocalCurrency(destination),
        locale,
      }
    case 'visa':
      return {
        destination,
        nationality: 'SA',
        purpose: requirements.tripPurpose || 'leisure',
        locale,
      }
    case 'attractions':
    case 'local_recommendations':
      return {
        destination,
        durationDays,
        interests: requirements.interests,
        locale,
      }
    default:
      return { destination, locale }
  }
}

function guessLocalCurrency(destination: string): string {
  const key = destination.toLowerCase()
  if (key.includes('japan') || key.includes('tokyo') || key.includes('osaka')) return 'JPY'
  if (key.includes('london') || key.includes('uk')) return 'GBP'
  if (key.includes('dubai') || key.includes('uae')) return 'AED'
  if (key.includes('riyadh') || key.includes('jeddah')) return 'SAR'
  if (key.includes('paris') || key.includes('france')) return 'EUR'
  if (key.includes('bali') || key.includes('indonesia')) return 'IDR'
  return 'USD'
}
