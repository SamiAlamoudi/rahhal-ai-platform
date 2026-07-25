/**
 * Phase 3 Stage 5 — Experience Layer feature registry helpers.
 * Flag `ai.experience_layer` default OFF.
 *
 * Not wired into planTurn — isolated presentation layer.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { ExperienceFutureModulePlaceholder } from './types'

export const EXPERIENCE_LAYER_FEATURE_ID = 'ai.experience_layer' as const

export function isExperienceLayerEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(EXPERIENCE_LAYER_FEATURE_ID)
}

export const EXPERIENCE_FUTURE_MODULES: readonly ExperienceFutureModulePlaceholder[] = [
  {
    moduleId: 'voice_experience',
    status: 'placeholder',
    description: 'Future Voice Center integration for speakable trip experiences.',
  },
  {
    moduleId: 'knowledge_center',
    status: 'placeholder',
    description: 'Future Knowledge Center for guides, books, and articles.',
  },
  {
    moduleId: 'books',
    status: 'placeholder',
    description: 'Travel books library surface (retrieval not implemented).',
  },
  {
    moduleId: 'documents',
    status: 'placeholder',
    description: 'Traveler document vault presentation.',
  },
  {
    moduleId: 'pdf_assistant',
    status: 'placeholder',
    description: 'PDF assistant UX over saved trip documents.',
  },
  {
    moduleId: 'trip_dashboard',
    status: 'placeholder',
    description: 'Mobile/web trip dashboard consuming experience models.',
  },
  {
    moduleId: 'live_flight_tracking',
    status: 'placeholder',
    description: 'Live flight tracking UI (no API in this stage).',
  },
  {
    moduleId: 'hotel_tracking',
    status: 'placeholder',
    description: 'Hotel stay tracking UI (no API in this stage).',
  },
  {
    moduleId: 'notifications',
    status: 'placeholder',
    description: 'Push/in-app notification presentation hooks.',
  },
  {
    moduleId: 'maps',
    status: 'placeholder',
    description: 'Maps presentation hooks (no maps SDK here).',
  },
  {
    moduleId: 'offline_mode',
    status: 'placeholder',
    description: 'Offline-capable experience cache (architecture only).',
  },
] as const

export const ExperienceRegistry = {
  featureId: EXPERIENCE_LAYER_FEATURE_ID,
  isEnabled: isExperienceLayerEnabled,
  futureModules: EXPERIENCE_FUTURE_MODULES,
}
