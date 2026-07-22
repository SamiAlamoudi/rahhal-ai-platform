/**
 * Sprint 103 — canonical traveler journey routes (aliases → existing pages).
 */

import type { AlphaJourneyRouteDef } from './types'

export const ALPHA_JOURNEY_ROUTES: AlphaJourneyRouteDef[] = [
  {
    id: 'new_chat',
    path: '/new-chat',
    resolvesTo: '/chat',
    description: 'Alias for starting conversation (ChatPage)',
  },
  {
    id: 'chat',
    path: '/chat',
    resolvesTo: '/chat',
    description: 'Primary conversation experience',
  },
  {
    id: 'booking',
    path: '/booking',
    resolvesTo: '/booking-assistant/review',
    description: 'Booking entry — prefers assistant review when flag ON',
  },
  {
    id: 'booking_review',
    path: '/booking/review',
    resolvesTo: '/booking/review',
    description: 'Legacy booking review',
  },
  {
    id: 'booking_assistant_review',
    path: '/booking-assistant/review',
    resolvesTo: '/booking-assistant/review',
    description: 'Sprint 102 booking assistant review',
  },
  {
    id: 'booking_confirmation',
    path: '/booking/confirmation',
    resolvesTo: '/booking/confirmation',
    description: 'Legacy booking confirmation',
  },
  {
    id: 'booking_assistant_confirmation',
    path: '/booking-assistant/confirmation/:bookingId',
    resolvesTo: '/booking-assistant/confirmation/:bookingId',
    description: 'Sprint 102 assistant confirmation',
  },
  {
    id: 'my_trips',
    path: '/my-trips',
    resolvesTo: '/my-trips',
    description: 'My Trips dashboard entry',
  },
]

export function resolveJourneyPath(
  path: string,
  options?: { bookingExecutionEnabled?: boolean },
): string {
  const normalized = path.replace(/\/+$/, '') || '/'
  if (normalized === '/new-chat') return '/chat'
  if (normalized === '/booking') {
    return options?.bookingExecutionEnabled === false
      ? '/booking/review'
      : '/booking-assistant/review'
  }
  return path
}

export function listKnownJourneyPaths(): string[] {
  return ALPHA_JOURNEY_ROUTES.map((r) => r.path)
}
