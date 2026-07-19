/**
 * Sprint 38 — Hotel loyalty adapters (Hilton, Marriott, IHG, Accor, Hyatt, Best Western).
 */

import type { HotelLoyaltyAccount, HotelLoyaltyBrand, LoyaltyCandidate } from '../types'
import { createHotelAdapter, type HotelLoyaltyAdapter } from './base'

const ADAPTERS: HotelLoyaltyAdapter[] = [
  createHotelAdapter('hilton', 'Hilton Honors', 10),
  createHotelAdapter('marriott', 'Marriott Bonvoy', 10),
  createHotelAdapter('ihg', 'IHG One Rewards', 9),
  createHotelAdapter('accor', 'ALL - Accor Live Limitless', 8),
  createHotelAdapter('hyatt', 'World of Hyatt', 5),
  createHotelAdapter('best_western', 'Best Western Rewards', 7),
  createHotelAdapter('generic', 'Partner Hotel Rewards', 6),
]

export class HotelLoyaltyRegistry {
  private readonly byUser = new Map<string, HotelLoyaltyAccount[]>()
  private readonly adapters = new Map<HotelLoyaltyBrand, HotelLoyaltyAdapter>()

  constructor(adapters: HotelLoyaltyAdapter[] = ADAPTERS) {
    for (const adapter of adapters) this.adapters.set(adapter.brand, adapter)
  }

  listAdapters(): HotelLoyaltyAdapter[] {
    return [...this.adapters.values()]
  }

  getAdapter(brand: HotelLoyaltyBrand): HotelLoyaltyAdapter {
    return this.adapters.get(brand) ?? this.adapters.get('generic')!
  }

  listAccounts(userId: string): HotelLoyaltyAccount[] {
    return (this.byUser.get(userId) ?? []).map((a) => ({ ...a }))
  }

  upsertAccount(userId: string, account: HotelLoyaltyAccount): HotelLoyaltyAccount {
    const list = this.byUser.get(userId) ?? []
    const idx = list.findIndex((a) => a.brand === account.brand)
    if (idx >= 0) list[idx] = { ...account }
    else list.push({ ...account })
    this.byUser.set(userId, list)
    return { ...account }
  }

  estimateForCandidate(
    userId: string,
    candidate: LoyaltyCandidate,
  ): { brand: HotelLoyaltyBrand; points: number; programName: string } {
    const brand = candidate.hotelBrand ?? detectBrand(candidate) ?? 'generic'
    const adapter = this.getAdapter(brand)
    const account = this.listAccounts(userId).find((a) => a.brand === brand) ?? null
    return {
      brand,
      points: adapter.estimatePoints(candidate, account),
      programName: adapter.programName,
    }
  }

  rankHotelsByRewards(userId: string, candidates: LoyaltyCandidate[]): LoyaltyCandidate[] {
    return [...candidates]
      .filter((c) => c.serviceKind === 'hotel')
      .map((c) => {
        const est = this.estimateForCandidate(userId, c)
        return {
          ...c,
          estimatedPartnerMilesOrPoints: est.points,
          hotelBrand: est.brand,
          metadata: { ...c.metadata, hotelProgram: est.programName },
        }
      })
      .sort(
        (a, b) =>
          b.estimatedPartnerMilesOrPoints - a.estimatedPartnerMilesOrPoints
          || a.price - b.price,
      )
  }
}

export function createHotelLoyaltyRegistry(
  adapters?: HotelLoyaltyAdapter[],
): HotelLoyaltyRegistry {
  return new HotelLoyaltyRegistry(adapters)
}

export type { HotelLoyaltyAdapter }
export { createHotelAdapter }

function detectBrand(candidate: LoyaltyCandidate): HotelLoyaltyBrand | null {
  const hay = `${candidate.title} ${candidate.brandOrAirline ?? ''} ${candidate.providerId}`.toLowerCase()
  if (/hilton/.test(hay)) return 'hilton'
  if (/marriott|bonvoy|westin|sheraton/.test(hay)) return 'marriott'
  if (/\bihg\b|holiday inn|crowne plaza/.test(hay)) return 'ihg'
  if (/accor|novotel|ibis|sofitel|mercure/.test(hay)) return 'accor'
  if (/hyatt/.test(hay)) return 'hyatt'
  if (/best western/.test(hay)) return 'best_western'
  return null
}
