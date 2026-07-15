/**
 * Phase AH — map existing TravelSession UI state → TripPlannerRequest.
 * Transport mapping only; no planning/scoring logic.
 */

import type { TravelSession } from '../../../../utils/travelSession'
import type {
  PreferredLanguage,
  TripPlannerExplicitPreferences,
  TripPlannerRequest,
  TripPlannerTravelerType,
} from '../models'

function mapTravelerType(session: TravelSession): TripPlannerTravelerType | null {
  const purpose = `${session.tripPurpose ?? ''} ${session.travelPurpose ?? ''}`.toLowerCase()
  if (purpose.includes('business') || purpose.includes('عمل')) return 'business'
  if ((session.adults ?? 0) >= 2 && (session.children ?? 0) > 0) return 'family'
  if ((session.adults ?? 0) >= 3) return 'friends'
  if (session.adults === 2) return 'couple'
  if (session.adults === 1) return 'solo'
  return null
}

function mapTravelStyle(session: TravelSession): string | null {
  const purpose = `${session.tripPurpose ?? ''} ${session.activityStyle ?? ''}`.toLowerCase()
  if (!purpose.trim()) return null
  if (purpose.includes('adventure') || purpose.includes('مغامر')) return 'adventure'
  if (purpose.includes('culture') || purpose.includes('ثقاف')) return 'cultural'
  if (purpose.includes('relax') || purpose.includes('استرخ')) return 'relaxed'
  if (purpose.includes('luxury') || purpose.includes('فاخر')) return 'luxury_focus'
  return 'balanced'
}

function mapBudgetStyle(
  session: TravelSession,
): TripPlannerExplicitPreferences['budgetStyle'] {
  const cat = `${session.preferredHotelCategory ?? ''} ${session.hotelCategory ?? ''}`.toLowerCase()
  if (cat.includes('luxury') || cat.includes('5') || cat.includes('فاخر')) return 'luxury'
  if (cat.includes('budget') || cat.includes('hostel') || cat.includes('اقتصاد')) return 'budget'
  if (session.budgetAmount != null && session.budgetAmount < 3000) return 'budget'
  if (session.budgetAmount != null && session.budgetAmount > 15000) return 'luxury'
  return 'midrange'
}

function interestsFromSession(session: TravelSession): string[] {
  const out: string[] = []
  if (typeof session.interests === 'string' && session.interests.trim()) {
    out.push(
      ...session.interests
        .split(/[,،|/]/)
        .map((i) => i.trim().toLowerCase())
        .filter(Boolean),
    )
  }
  const scored: Array<[string, number]> = [
    ['shopping', session.shoppingInterest],
    ['nature', session.natureInterest],
    ['culture', session.cultureInterest],
    ['entertainment', session.entertainmentInterest],
    ['beach', session.beachInterest],
    ['city', session.cityInterest],
  ]
  for (const [key, value] of scored) {
    if (typeof value === 'number' && value >= 60) out.push(key)
  }
  return [...new Set(out)]
}

function preferDirect(session: TravelSession): boolean {
  return (
    session.directFlightPreference === 'direct-only' ||
    session.directFlightPreference === 'direct-preferred'
  )
}

export interface MapSessionOptions {
  userId: string
  requestId?: string
  idempotencyKey?: string
  preferredLanguage?: PreferredLanguage
  includeBookingPreview?: boolean
  expiresAt?: string | null
}

export function mapTravelSessionToTripPlannerRequest(
  session: TravelSession,
  options: MapSessionOptions,
): TripPlannerRequest {
  const destinations = [session.destination]
    .filter((d): d is string => Boolean(d && String(d).trim()))
    .map((d) => d.trim())

  const flexible = session.flexibleDates === 'flexible'
  const travelerType = mapTravelerType(session)
  const travelStyle = mapTravelStyle(session)
  const interests = interestsFromSession(session)
  const locale: PreferredLanguage =
    options.preferredLanguage ??
    (session.preferredLanguage === 'en' ? 'en' : 'ar')

  const seed =
    options.idempotencyKey ??
    [
      options.userId,
      destinations.join('|'),
      session.departureDate ?? '',
      session.returnDate ?? '',
      String(session.durationDays ?? ''),
      String(session.budgetAmount ?? ''),
      String(session.decisionProfileConfirmed),
    ].join('::')

  return {
    requestId: options.requestId ?? `ui_${Date.now().toString(36)}`,
    userId: options.userId,
    destinations: destinations.length ? destinations : [],
    origin: session.departureCity || null,
    startDate: session.departureDate || null,
    endDate: session.returnDate || null,
    flexibleDates: flexible,
    durationDays: session.durationDays ?? null,
    travelers: {
      adults: Math.max(1, session.adults ?? 1),
      children: session.children ?? 0,
      infants: session.infants ?? 0,
      travelerType,
    },
    budget:
      session.budgetAmount != null
        ? {
            amount: session.budgetAmount,
            currency: session.budgetCurrency || 'SAR',
          }
        : null,
    currency: session.budgetCurrency || 'SAR',
    travelStyle,
    explicitPreferences: {
      travelerType,
      interests,
      budgetStyle: mapBudgetStyle(session),
      travelStyle,
      preferDirectFlights: preferDirect(session),
      preferCentralHotels:
        (session.preferredHotelArea ?? '').toLowerCase().includes('central') ||
        (session.accommodationPreference ?? '') === 'hotel',
      preferredAirlines: session.preferredAirline ? [session.preferredAirline] : [],
    },
    constraints: {
      preferDirectFlights: preferDirect(session),
      preferCentralHotels: (session.preferredHotelArea ?? '').toLowerCase().includes('central'),
      preferRelaxedPace: travelStyle === 'relaxed',
      preferPackedSchedule: travelStyle === 'adventure',
    },
    preferredLanguage: locale,
    includeBookingPreview: options.includeBookingPreview === true,
    idempotencyKey: seed,
    expiresAt: options.expiresAt ?? null,
    inferredPreferences: {
      interestSignals: interests,
      typicalSpend: session.budgetAmount ?? null,
    },
  }
}
