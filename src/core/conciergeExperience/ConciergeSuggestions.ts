/**
 * Sprint 96 — Concierge Suggestions (proactive add-ons & tips).
 */

import type { ConciergeSuggestion, ConciergeTripFacts } from './types'

export function buildConciergeSuggestions(input: {
  trip: ConciergeTripFacts
  hasInsuranceOffer?: boolean
  hasTransferOffer?: boolean
}): ConciergeSuggestion[] {
  const destination = input.trip.destination?.trim() || 'your destination'
  const start = input.trip.startDate
  const travelers = input.trip.travelers ?? 1
  const suggestions: ConciergeSuggestion[] = []

  if (!input.hasInsuranceOffer) {
    suggestions.push({
      kind: 'travel_insurance',
      title: 'Travel insurance',
      message: `Consider travel insurance covering medical and trip interruption for ${travelers} traveler(s) to ${destination}.`,
      priority: 'high',
      actionable: true,
    })
  }

  if (!input.hasTransferOffer) {
    suggestions.push({
      kind: 'airport_transfer',
      title: 'Airport transfer',
      message: `Pre-book an airport transfer on arrival to ${destination} to avoid late-night taxi uncertainty.`,
      priority: 'medium',
      actionable: true,
    })
  }

  suggestions.push({
    kind: 'visa_reminder',
    title: 'Visa reminder',
    message: `Confirm visa / entry requirements for ${destination} before finalizing tickets${start ? ` (travel starts ${start})` : ''}.`,
    priority: 'high',
    actionable: true,
  })

  suggestions.push({
    kind: 'weather',
    title: 'Weather',
    message: `Check the seasonal forecast for ${destination} around your dates so packing and day plans stay realistic.`,
    priority: 'medium',
    actionable: false,
  })

  suggestions.push({
    kind: 'packing_tips',
    title: 'Packing tips',
    message: (input.trip.travelerType || '').toLowerCase() === 'family'
      ? `Pack light layers, child essentials, and a small day bag for family days in ${destination}.`
      : `Pack versatile layers and a compact day bag for ${destination}; keep documents and chargers in your carry-on.`,
    priority: 'low',
    actionable: false,
  })

  suggestions.push({
    kind: 'local_transportation',
    title: 'Local transportation',
    message: `Plan local transport in ${destination} (metro, rideshare, or short transfers) for the first 48 hours after arrival.`,
    priority: 'medium',
    actionable: true,
  })

  return suggestions
}
