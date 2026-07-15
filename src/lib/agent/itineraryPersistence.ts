import { savedTripRepository } from '../repositories/savedTripRepository'
import type { SavedTripRow } from '../types'
import type { TravelItinerary } from './types'
import { buildSavedTripData, parseSavedTripData, type SavedTripData } from '../savedTrips/savedTripHelpers'

export function itineraryToSavedTripData(itinerary: TravelItinerary): SavedTripData {
  const base = buildSavedTripData({
    currency: itinerary.estimatedBudget.currency,
    items: itinerary.activities.flatMap((day) =>
      day.activities.map((activity) => ({
        type: 'activity',
        title: `${day.title}: ${activity.title}`,
        providerName: 'travel-agent',
        price: 0,
        currency: itinerary.estimatedBudget.currency,
      })),
    ),
    travelSessionId: null,
    bookingSessionId: null,
    savedFrom: 'travel_agent',
  })
  return {
    ...base,
    total: itinerary.estimatedBudget.amount,
    agentItinerary: itinerary,
  }
}

export function parseAgentItineraryFromTripData(
  raw: Record<string, unknown> | null | undefined,
): TravelItinerary | null {
  const parsed = parseSavedTripData(raw)
  return parsed.agentItinerary ?? null
}

export async function saveGeneratedItinerary(input: {
  itinerary: TravelItinerary
  existingSavedTripId?: string | null
}): Promise<SavedTripRow> {
  const tripData = itineraryToSavedTripData(input.itinerary) as unknown as Record<string, unknown>
  const destination = input.itinerary.destinations[0] || input.itinerary.title
  if (input.existingSavedTripId) {
    const updated = await savedTripRepository.update(input.existingSavedTripId, {
      title: input.itinerary.title,
      destination,
      trip_data: tripData,
    })
    if (!updated) throw new Error('Failed to update saved itinerary')
    return updated
  }
  const created = await savedTripRepository.create({
    session_id: null,
    title: input.itinerary.title,
    destination,
    trip_data: tripData,
  })
  if (!created) throw new Error('Failed to save itinerary')
  return created
}

export async function updateSavedItinerary(
  savedTripId: string,
  itinerary: TravelItinerary,
): Promise<SavedTripRow> {
  return saveGeneratedItinerary({ itinerary, existingSavedTripId: savedTripId })
}
