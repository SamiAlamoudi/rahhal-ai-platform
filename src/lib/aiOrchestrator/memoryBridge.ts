/**
 * Sprint 43 — conversation memory bridge.
 * Reuses Sprint 28 MemoryContextEngine before asking clarifying questions.
 */

import {
  MemoryContextEngine,
  type MemoryContextEngineHandle,
} from '../brain/memory/memoryContextEngine'
import { ensureEnriched } from '../brain/memory/enrichedMemory'
import type { OrchestratorMemorySnapshot } from './types'

export type MemoryBridgeHandle = {
  load: (input: {
    conversationId: string
    userText: string
    locale?: 'ar' | 'en'
    userId?: string | null
  }) => OrchestratorMemorySnapshot
  /** Apply utterance extraction into short-term memory (no new questions when slots exist). */
  absorbTurn: (input: {
    conversationId: string
    userText: string
    locale?: 'ar' | 'en'
    userId?: string | null
  }) => OrchestratorMemorySnapshot
}

export function createMemoryBridge(options?: {
  engine?: MemoryContextEngineHandle
  enabled?: boolean
}): MemoryBridgeHandle {
  const engine =
    options?.engine
    ?? MemoryContextEngine({
      enabled: options?.enabled ?? true,
    })

  function toSnapshot(input: {
    conversationId: string
    userText: string
    locale?: 'ar' | 'en'
    userId?: string | null
    persist?: boolean
  }): OrchestratorMemorySnapshot {
    if (!engine.isEnabled()) {
      return emptySnapshot()
    }

    const turn = engine.runTurn({
      conversationId: input.conversationId,
      userText: input.userText,
      locale: input.locale ?? 'en',
      userId: input.userId,
      persistLongTerm: input.persist === true,
    })

    const working = turn.context?.workingMemory
      ? ensureEnriched(turn.context.workingMemory)
      : null
    const short = turn.shortTerm ?? engine.getShortTerm(input.conversationId)
    const memory = working ?? (short?.memory ? ensureEnriched(short.memory) : null)
    const longTerm = turn.longTerm ?? engine.getLongTerm(input.userId)

    const preferredAirlines = unique([
      ...(memory?.airlinePreferences ?? []),
      ...(longTerm?.preferredAirlines ?? []),
    ])
    const hotelPreferences = unique([
      ...(memory?.hotelPreferences ?? []),
      ...(longTerm?.preferredHotelBrands ?? []),
    ])
    const seatPreferences = unique([
      ...(memory?.seatPreferences ?? []),
      ...(longTerm?.seatPreferences ?? []),
    ]).map(String)
    const loyaltyMemberships = unique([
      ...(memory?.loyaltyPrograms ?? []).map((p) => p.program),
      ...(longTerm?.loyaltyPrograms ?? []),
    ])

    const nationality =
      memory?.passportNationality?.nationality
      ?? longTerm?.nationality
      ?? null

    return {
      budget: {
        amount: memory?.budget?.amount ?? longTerm?.budgetRange?.max ?? null,
        currency:
          memory?.budget?.currency
          ?? longTerm?.budgetRange?.currency
          ?? memory?.currency
          ?? null,
      },
      travellers: {
        adults:
          memory?.travelers?.adults
          ?? memory?.travelers?.count
          ?? longTerm?.typicalTravelerCount
          ?? null,
        children: memory?.travelers?.children ?? null,
      },
      passport: {
        nationality: memory?.passportNationality?.nationality ?? nationality,
        passportCountry: memory?.passportNationality?.passportCountry ?? null,
      },
      nationality,
      preferredAirlines,
      hotelPreferences,
      seatPreferences,
      loyaltyMemberships,
      destination: memory?.destination ?? null,
      origin: memory?.origin ?? null,
      raw: memory,
    }
  }

  return {
    load: (input) => toSnapshot({ ...input, persist: false }),
    absorbTurn: (input) => toSnapshot({ ...input, persist: true }),
  }
}

export function emptySnapshot(): OrchestratorMemorySnapshot {
  return {
    budget: { amount: null, currency: null },
    travellers: { adults: null, children: null },
    passport: { nationality: null, passportCountry: null },
    nationality: null,
    preferredAirlines: [],
    hotelPreferences: [],
    seatPreferences: [],
    loyaltyMemberships: [],
    destination: null,
    origin: null,
    raw: null,
  }
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const t = String(v ?? '').trim()
    if (!t) continue
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}
