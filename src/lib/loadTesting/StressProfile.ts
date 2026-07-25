/**
 * Sprint 16 — StressProfile catalog for concurrent / long-running / mixed loads.
 */

import type { StressProfile, StressScenarioId } from './types'

export const STRESS_PROFILES: Record<StressScenarioId, StressProfile> = {
  concurrent_100: {
    id: 'concurrent_100',
    name: '100 concurrent users',
    concurrentUsers: 100,
    turnsPerSession: 3,
    providerCallsPerTurn: 2,
    bookingOrchestrationWeight: 0.1,
    longRunning: false,
    mixed: false,
    thinkTimeMs: 0,
  },
  concurrent_500: {
    id: 'concurrent_500',
    name: '500 concurrent users',
    concurrentUsers: 500,
    turnsPerSession: 3,
    providerCallsPerTurn: 2,
    bookingOrchestrationWeight: 0.15,
    longRunning: false,
    mixed: false,
    thinkTimeMs: 0,
  },
  concurrent_1000: {
    id: 'concurrent_1000',
    name: '1000 concurrent users',
    concurrentUsers: 1000,
    turnsPerSession: 2,
    providerCallsPerTurn: 2,
    bookingOrchestrationWeight: 0.2,
    longRunning: false,
    mixed: false,
    thinkTimeMs: 0,
  },
  long_running_conversations: {
    id: 'long_running_conversations',
    name: 'Long-running conversations',
    concurrentUsers: 50,
    turnsPerSession: 20,
    providerCallsPerTurn: 1,
    bookingOrchestrationWeight: 0.05,
    longRunning: true,
    mixed: false,
    thinkTimeMs: 1,
  },
  heavy_provider_activity: {
    id: 'heavy_provider_activity',
    name: 'Heavy provider activity',
    concurrentUsers: 200,
    turnsPerSession: 4,
    providerCallsPerTurn: 8,
    bookingOrchestrationWeight: 0.1,
    longRunning: false,
    mixed: false,
    thinkTimeMs: 0,
  },
  high_booking_orchestration: {
    id: 'high_booking_orchestration',
    name: 'High booking orchestration',
    concurrentUsers: 150,
    turnsPerSession: 5,
    providerCallsPerTurn: 3,
    bookingOrchestrationWeight: 0.8,
    longRunning: false,
    mixed: false,
    thinkTimeMs: 0,
  },
  mixed_workloads: {
    id: 'mixed_workloads',
    name: 'Mixed workloads',
    concurrentUsers: 300,
    turnsPerSession: 6,
    providerCallsPerTurn: 3,
    bookingOrchestrationWeight: 0.35,
    longRunning: true,
    mixed: true,
    thinkTimeMs: 0,
  },
}

export function getStressProfile(id: StressScenarioId): StressProfile {
  return { ...STRESS_PROFILES[id] }
}

export function listStressProfiles(): StressProfile[] {
  return Object.values(STRESS_PROFILES).map((p) => ({ ...p }))
}

/** Test/CI-safe scaled-down profile (keeps scenario identity, fewer users). */
export function scaleProfileForTests(profile: StressProfile, maxUsers = 20): StressProfile {
  return {
    ...profile,
    concurrentUsers: Math.min(profile.concurrentUsers, maxUsers),
    turnsPerSession: Math.min(profile.turnsPerSession, profile.longRunning ? 8 : 3),
    providerCallsPerTurn: Math.min(profile.providerCallsPerTurn, 4),
  }
}
