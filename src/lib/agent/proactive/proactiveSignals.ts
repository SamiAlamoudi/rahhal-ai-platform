/**
 * Phase 3 Stage 3 — Proactive signal definitions (catalog metadata).
 */

import type { ProactiveSignalKind } from './types'

export interface ProactiveSignalDefinition {
  signal: ProactiveSignalKind
  /** Default priority weight (higher = sooner). */
  defaultPriority: number
  /** Typical missing evidence if cue is weak. */
  commonMissing: string[]
}

export const PROACTIVE_SIGNAL_DEFINITIONS: Readonly<
  Record<ProactiveSignalKind, ProactiveSignalDefinition>
> = {
  visa_reminder: {
    signal: 'visa_reminder',
    defaultPriority: 90,
    commonMissing: ['passport_nationality', 'destination_entry_rules'],
  },
  passport_expiry_reminder: {
    signal: 'passport_expiry_reminder',
    defaultPriority: 88,
    commonMissing: ['passport_expiry_date'],
  },
  season_advice: {
    signal: 'season_advice',
    defaultPriority: 70,
    commonMissing: ['travel_month'],
  },
  weather_notice: {
    signal: 'weather_notice',
    defaultPriority: 72,
    commonMissing: ['travel_dates', 'destination_climate'],
  },
  airport_recommendation: {
    signal: 'airport_recommendation',
    defaultPriority: 55,
    commonMissing: ['origin_city', 'preferred_hub'],
  },
  hotel_checkin_reminder: {
    signal: 'hotel_checkin_reminder',
    defaultPriority: 50,
    commonMissing: ['arrival_time'],
  },
  transportation_reminder: {
    signal: 'transportation_reminder',
    defaultPriority: 60,
    commonMissing: ['party_size', 'mobility_needs'],
  },
  packing_suggestion: {
    signal: 'packing_suggestion',
    defaultPriority: 40,
    commonMissing: ['season', 'activities'],
  },
  currency_reminder: {
    signal: 'currency_reminder',
    defaultPriority: 58,
    commonMissing: ['destination_currency'],
  },
  esim_suggestion: {
    signal: 'esim_suggestion',
    defaultPriority: 45,
    commonMissing: ['destination_connectivity'],
  },
  timezone_warning: {
    signal: 'timezone_warning',
    defaultPriority: 52,
    commonMissing: ['origin_timezone', 'destination_timezone'],
  },
  travel_insurance_reminder: {
    signal: 'travel_insurance_reminder',
    defaultPriority: 65,
    commonMissing: ['trip_duration', 'coverage_preference'],
  },
  meeting_logistics: {
    signal: 'meeting_logistics',
    defaultPriority: 80,
    commonMissing: ['meeting_schedule'],
  },
  executive_travel: {
    signal: 'executive_travel',
    defaultPriority: 78,
    commonMissing: ['lounge_access', 'transfer_preference'],
  },
  family_travel: {
    signal: 'family_travel',
    defaultPriority: 76,
    commonMissing: ['children_ages'],
  },
  accessibility: {
    signal: 'accessibility',
    defaultPriority: 85,
    commonMissing: ['accessibility_requirements'],
  },
  budget_optimization: {
    signal: 'budget_optimization',
    defaultPriority: 68,
    commonMissing: ['flexible_dates'],
  },
  alternative_timing: {
    signal: 'alternative_timing',
    defaultPriority: 62,
    commonMissing: ['date_flexibility'],
  },
}

export function getSignalDefinition(
  signal: ProactiveSignalKind,
): ProactiveSignalDefinition {
  return PROACTIVE_SIGNAL_DEFINITIONS[signal]
}

export const ProactiveSignals = {
  definitions: PROACTIVE_SIGNAL_DEFINITIONS,
  get: getSignalDefinition,
}
