/**
 * Sprint 80 P2 — canonical validation scenarios (sandbox-friendly).
 */

import type { LiveFlightValidationScenario } from './types'

export const DEFAULT_LIVE_FLIGHT_VALIDATION_SCENARIO: LiveFlightValidationScenario = {
  id: 'ruh-cmn-roundtrip',
  label: 'Riyadh → Casablanca (round trip)',
  origin: 'Riyadh',
  destination: 'Casablanca',
  departureDate: '2026-09-15',
  returnDate: '2026-09-22',
  adults: 2,
  children: 0,
  cabin: 'economy',
  currency: 'SAR',
}

export const LIVE_FLIGHT_VALIDATION_SCENARIOS: LiveFlightValidationScenario[] = [
  DEFAULT_LIVE_FLIGHT_VALIDATION_SCENARIO,
  {
    id: 'ruh-dxb-oneway-business',
    label: 'Riyadh → Dubai (one way, business)',
    origin: 'Riyadh',
    destination: 'Dubai',
    departureDate: '2026-10-01',
    returnDate: null,
    adults: 1,
    children: 0,
    cabin: 'business',
    currency: 'SAR',
  },
]
