/**
 * Sprint 91 — traveler-facing recovery messages (never expose technical errors).
 */

export function toTravelerRecoveryMessage(
  technical: string | null | undefined,
  context: 'flights' | 'hotels' | 'package' | 'provider' | 'generic' = 'generic',
): string {
  const raw = (technical ?? '').toLowerCase()

  if (context === 'flights' || raw.includes('flight')) {
    if (raw.includes('unavailable') || raw.includes('failover') || raw.includes('timeout')) {
      return 'Searching alternative flights...'
    }
    if (raw.includes('empty') || raw.includes('no result')) {
      return 'Unable to find matching flights. Would you like to adjust your dates or nearby airports?'
    }
    return 'Trying another flight provider...'
  }

  if (context === 'hotels' || raw.includes('hotel')) {
    if (raw.includes('unavailable') || raw.includes('failover') || raw.includes('timeout')) {
      return 'Searching alternative hotels...'
    }
    if (raw.includes('empty') || raw.includes('no result')) {
      return 'Unable to find matching hotels. Would you like to adjust your budget or area?'
    }
    return 'Trying another hotel provider...'
  }

  if (context === 'package' || raw.includes('package')) {
    return 'Unable to find matching package. Would you like to adjust your budget?'
  }

  if (
    context === 'provider'
    || raw.includes('circuit')
    || raw.includes('provider')
    || raw.includes('failover')
    || raw.includes('timeout')
  ) {
    return 'Trying another provider...'
  }

  if (raw.includes('refine') || raw.includes('itinerary')) {
    return 'Optimizing itinerary...'
  }

  return 'Working on alternatives to keep your trip on track...'
}

export function buildBudgetAdjustmentPrompt(currency: string, budget: number | null): string {
  if (budget != null && Number.isFinite(budget)) {
    return `Unable to find matching package within ${budget} ${currency}. Would you like to adjust your budget?`
  }
  return 'Unable to find matching package. Would you like to adjust your budget?'
}
