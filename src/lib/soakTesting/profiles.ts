/**
 * Sprint 19 — soak / concurrency / long-conversation profiles.
 */

import type { SoakProfile, SoakProfileId } from './types'

export const SOAK_PROFILES: Record<SoakProfileId, SoakProfile> = {
  sessions_500: {
    id: 'sessions_500',
    name: '500 extended sessions',
    sessions: 500,
    turnsPerSession: 4,
    providerCallsPerTurn: 2,
    bookingWeight: 0.2,
    injectFailures: false,
    mixedLengths: true,
  },
  sessions_1000: {
    id: 'sessions_1000',
    name: '1000 extended sessions',
    sessions: 1000,
    turnsPerSession: 3,
    providerCallsPerTurn: 2,
    bookingWeight: 0.25,
    injectFailures: true,
    mixedLengths: true,
  },
  concurrency_50: {
    id: 'concurrency_50',
    name: '50 concurrent users',
    sessions: 50,
    turnsPerSession: 3,
    providerCallsPerTurn: 2,
    bookingWeight: 0.15,
    injectFailures: false,
    mixedLengths: false,
  },
  concurrency_100: {
    id: 'concurrency_100',
    name: '100 concurrent users',
    sessions: 100,
    turnsPerSession: 3,
    providerCallsPerTurn: 2,
    bookingWeight: 0.2,
    injectFailures: false,
    mixedLengths: false,
  },
  concurrency_250: {
    id: 'concurrency_250',
    name: '250 concurrent users',
    sessions: 250,
    turnsPerSession: 3,
    providerCallsPerTurn: 3,
    bookingWeight: 0.25,
    injectFailures: true,
    mixedLengths: true,
  },
  concurrency_500: {
    id: 'concurrency_500',
    name: '500 concurrent users',
    sessions: 500,
    turnsPerSession: 2,
    providerCallsPerTurn: 3,
    bookingWeight: 0.3,
    injectFailures: true,
    mixedLengths: true,
  },
  long_turns_50: {
    id: 'long_turns_50',
    name: 'Long conversation 50 turns',
    sessions: 5,
    turnsPerSession: 50,
    providerCallsPerTurn: 1,
    bookingWeight: 0.05,
    injectFailures: false,
    mixedLengths: false,
  },
  long_turns_100: {
    id: 'long_turns_100',
    name: 'Long conversation 100 turns',
    sessions: 3,
    turnsPerSession: 100,
    providerCallsPerTurn: 1,
    bookingWeight: 0.05,
    injectFailures: false,
    mixedLengths: false,
  },
  long_turns_150: {
    id: 'long_turns_150',
    name: 'Long conversation 150 turns',
    sessions: 2,
    turnsPerSession: 150,
    providerCallsPerTurn: 1,
    bookingWeight: 0.05,
    injectFailures: true,
    mixedLengths: false,
  },
  mixed_recovery: {
    id: 'mixed_recovery',
    name: 'Mixed recovery soak',
    sessions: 200,
    turnsPerSession: 5,
    providerCallsPerTurn: 3,
    bookingWeight: 0.35,
    injectFailures: true,
    mixedLengths: true,
  },
}

export function getSoakProfile(id: SoakProfileId): SoakProfile {
  return { ...SOAK_PROFILES[id] }
}
