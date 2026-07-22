/**
 * Sprint 120 — Home screen production data loader.
 * Reuses Memory Engine, chatEngine, My Trips — no mock data.
 */

import { runMemoryEngine } from '../agent/memory/index'
import { chatEngine } from '../chat/chatEngine'
import { loadMyTrips, type BookingRecord } from '../booking'
import type { ChatConversation } from '../chat/chatTypes'
import type { MemoryEngineResult, TravelHistorySummary } from '../agent/memory/index'

export interface ProductionHomeData {
  displayName: string | null
  greeting: string
  recentConversations: Array<{ id: string; title: string; updatedAt: string }>
  recentTrips: Array<{ id: string; title: string; status: string; totalLabel: string }>
  upcomingTrips: Array<{ id: string; title: string; status: string; totalLabel: string }>
  suggestedDestinations: string[]
  memoryInsights: string[]
  travelHistory: TravelHistorySummary | null
  continueConversation: { id: string; title: string } | null
  personalizedRecommendations: string[]
  loading: boolean
  error: string | null
  memory: MemoryEngineResult | null
}

function tripTitle(record: BookingRecord): string {
  if (record.flight) {
    return `${record.flight.origin} → ${record.flight.destination}`
  }
  return record.itemTitles[0] || record.bookingReference
}

async function safeListConversations(limit: number): Promise<ChatConversation[]> {
  try {
    return await Promise.race([
      chatEngine.listConversations(limit),
      new Promise<ChatConversation[]>((resolve) => {
        setTimeout(() => resolve([]), 1500)
      }),
    ])
  } catch {
    return []
  }
}

export async function loadProductionHomeData(input: {
  userId: string | null
  displayName?: string | null
}): Promise<ProductionHomeData> {
  const displayName = input.displayName ?? null
  const greeting = displayName
    ? `مرحباً ${displayName}`
    : 'مرحباً بك في رحّال'

  if (!input.userId) {
    return {
      displayName,
      greeting,
      recentConversations: [],
      recentTrips: [],
      upcomingTrips: [],
      suggestedDestinations: [],
      memoryInsights: [],
      travelHistory: null,
      continueConversation: null,
      personalizedRecommendations: [],
      loading: false,
      error: null,
      memory: null,
    }
  }

  let error: string | null = null
  let conversations: ChatConversation[] = []
  let trips: Awaited<ReturnType<typeof loadMyTrips>> | null = null
  let memory: MemoryEngineResult | null = null

  try {
    conversations = await safeListConversations(12)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load conversations'
  }

  try {
    trips = await Promise.race([
      loadMyTrips(input.userId),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1500)
      }),
    ])
  } catch (err) {
    error = error || (err instanceof Error ? err.message : 'Failed to load trips')
  }

  try {
    memory = runMemoryEngine(
      {
        userId: input.userId,
        messages: [],
        persist: false,
      },
      { enabled: true },
    )
  } catch (err) {
    error = error || (err instanceof Error ? err.message : 'Failed to load memory')
  }

  const recentConversations = conversations.slice(0, 8).map((c) => ({
    id: c.id,
    title: c.title || 'محادثة',
    updatedAt: c.updatedAt,
  }))

  const recentTrips = (trips?.all ?? []).slice(0, 6).map((r) => ({
    id: r.sessionId,
    title: tripTitle(r),
    status: r.status,
    totalLabel: `${r.total} ${r.currency}`,
  }))

  const upcomingTrips = (trips?.upcoming ?? []).slice(0, 6).map((r) => ({
    id: r.sessionId,
    title: tripTitle(r),
    status: r.status,
    totalLabel: `${r.total} ${r.currency}`,
  }))

  const history = memory?.travelHistory ?? null
  const suggestedDestinations: string[] = []
  if (history?.favoriteCity) suggestedDestinations.push(history.favoriteCity)
  if (history?.mostVisitedCountry) suggestedDestinations.push(history.mostVisitedCountry)
  const dests = memory?.resolution?.effective?.destinations
  if (Array.isArray(dests)) {
    for (const v of dests.slice(0, 5)) {
      if (v && !suggestedDestinations.includes(v)) suggestedDestinations.push(v)
    }
  }
  for (const pref of memory?.profile?.preferredDestinations ?? []) {
    const v = pref.value
    if (typeof v === 'string' && v && !suggestedDestinations.includes(v)) {
      suggestedDestinations.push(v)
    }
  }

  const memoryInsights = [
    ...(memory?.conciergeHints ?? []),
    ...(memory?.responseComposerNotes ?? []),
  ].slice(0, 8)

  const personalizedRecommendations = (memory?.resolution?.matchedPreferences ?? [])
    .slice(0, 6)

  const continueConversation = recentConversations[0]
    ? { id: recentConversations[0].id, title: recentConversations[0].title }
    : null

  return {
    displayName,
    greeting,
    recentConversations,
    recentTrips,
    upcomingTrips,
    suggestedDestinations,
    memoryInsights,
    travelHistory: history,
    continueConversation,
    personalizedRecommendations,
    loading: false,
    error,
    memory,
  }
}
