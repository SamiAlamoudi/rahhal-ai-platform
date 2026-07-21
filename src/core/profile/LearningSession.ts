/**
 * Sprint 80 — learning session lifecycle.
 */

import type { LearningSession } from './TravelerProfile'

export function startLearningSession(userId: string): LearningSession {
  return {
    sessionId: `learn_${userId}_${Date.now()}`,
    userId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    eventsProcessed: 0,
    preferencesUpdated: 0,
    learningEnabled: true,
  }
}

export function completeLearningSession(
  session: LearningSession,
  patch: Partial<Pick<LearningSession, 'eventsProcessed' | 'preferencesUpdated' | 'learningEnabled'>>,
): LearningSession {
  return {
    ...session,
    ...patch,
    completedAt: new Date().toISOString(),
  }
}
