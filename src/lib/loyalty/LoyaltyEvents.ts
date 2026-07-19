/**
 * Sprint 38 — Loyalty event bus.
 */

export type LoyaltyEventTypeName =
  | 'PointsEarned'
  | 'PointsRedeemed'
  | 'PointsExpired'
  | 'PointsReversed'
  | 'MembershipChanged'
  | 'RecommendationGenerated'
  | 'WalletQueried'
  | 'LoyaltyHandled'

export interface LoyaltyEvent {
  type: LoyaltyEventTypeName
  at: string
  userId: string
  data?: Record<string, unknown>
}

export type LoyaltyEventListener = (event: LoyaltyEvent) => void

export class LoyaltyEvents {
  private readonly listeners = new Map<LoyaltyEventTypeName | '*', Set<LoyaltyEventListener>>()

  on(type: LoyaltyEventTypeName | '*', listener: LoyaltyEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: LoyaltyEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createLoyaltyEvent(
  type: LoyaltyEventTypeName,
  userId: string,
  data?: Record<string, unknown>,
): LoyaltyEvent {
  return { type, at: new Date().toISOString(), userId, data }
}
