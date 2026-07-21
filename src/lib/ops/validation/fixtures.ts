/**
 * Sprint 66 — shared fixtures for E2E validation (simulated providers only).
 */

import { emptyMemory, emptyRequirements } from '../../agent/types'
import type { AgentMemory } from '../../agent/types'
import {
  createBookingProviderRegistry,
  createDefaultSimulatedBookingProviders,
} from '../../agent/bookingIntelligence'
import type { BookingProviderRegistry } from '../../agent/bookingIntelligence/types'

export function validationMemory(overrides?: Partial<AgentMemory['requirements']>): AgentMemory {
  return {
    ...emptyMemory('en'),
    requirements: {
      ...emptyRequirements(),
      destination: 'Dubai',
      destinations: ['Dubai'],
      origin: 'RUH',
      startDate: '2026-11-01',
      durationDays: 5,
      travelers: 2,
      budgetAmount: 15000,
      budgetCurrency: 'SAR',
      packageScope: 'full_package',
      budgetStyle: 'midrange',
      ...overrides,
    },
    missingFields: [],
  }
}

export function createValidationRegistry(): BookingProviderRegistry {
  return createBookingProviderRegistry(createDefaultSimulatedBookingProviders())
}

export function step(
  id: string,
  label: string,
  status: 'pass' | 'fail' | 'skip' | 'warn',
  detail?: string,
  durationMs?: number,
) {
  return { id, label, status, detail, durationMs }
}
