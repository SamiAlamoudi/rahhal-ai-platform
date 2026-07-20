/**
 * Sprint 38 — Airline loyalty numbers, miles tracking, best-airline recommendation.
 */

import type { AirlineLoyaltyAccount, LoyaltyCandidate } from './types'

export class AirlineLoyaltyStore {
  private readonly byUser = new Map<string, AirlineLoyaltyAccount[]>()

  list(userId: string): AirlineLoyaltyAccount[] {
    return (this.byUser.get(userId) ?? []).map((a) => ({ ...a }))
  }

  upsert(userId: string, account: AirlineLoyaltyAccount): AirlineLoyaltyAccount {
    const list = this.byUser.get(userId) ?? []
    const idx = list.findIndex((a) => a.airlineCode === account.airlineCode)
    if (idx >= 0) list[idx] = { ...account }
    else list.push({ ...account })
    this.byUser.set(userId, list)
    return { ...account }
  }

  addMiles(userId: string, airlineCode: string, miles: number): AirlineLoyaltyAccount | null {
    const list = this.byUser.get(userId) ?? []
    const account = list.find((a) => a.airlineCode.toLowerCase() === airlineCode.toLowerCase())
    if (!account) return null
    account.milesBalance += Math.max(0, Math.round(miles))
    return { ...account }
  }

  /**
   * Recommend the best airline among candidates using stored loyalty value.
   */
  recommendBestAirline(
    userId: string,
    candidates: LoyaltyCandidate[],
  ): { airlineCode: string; score: number; reason: string } | null {
    const accounts = this.list(userId)
    const flightCandidates = candidates.filter((c) => c.serviceKind === 'flight')
    if (!flightCandidates.length) return null

    let best: { airlineCode: string; score: number; reason: string } | null = null
    for (const candidate of flightCandidates) {
      const code = (candidate.brandOrAirline ?? candidate.providerId).toUpperCase()
      const account = accounts.find((a) => a.airlineCode.toUpperCase() === code)
      const loyaltyBoost = account
        ? 0.35 + Math.min(0.35, account.milesBalance / 100000)
        : 0.1
      const earnBoost = Math.min(0.3, candidate.estimatedPartnerMilesOrPoints / 5000)
      const priceScore = 1 - Math.min(1, candidate.price / 5000)
      const score = clamp01(loyaltyBoost * 0.45 + earnBoost * 0.3 + priceScore * 0.25)
      const reason = account
        ? `Matches your ${account.programName} account (${account.milesBalance} miles)`
        : `Strong earn potential (${candidate.estimatedPartnerMilesOrPoints} miles)`
      if (!best || score > best.score) {
        best = { airlineCode: code, score, reason }
      }
    }
    return best
  }
}

export function createAirlineLoyaltyStore(): AirlineLoyaltyStore {
  return new AirlineLoyaltyStore()
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
