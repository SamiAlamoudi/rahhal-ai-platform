/**
 * Sprint 38 — Universal Rahhal Points wallet.
 * earn / redeem / expire / reverse / bonus / promotions / campaigns / transfer / adjustment
 */

import type { MembershipEngine } from './MembershipEngine'
import type {
  LoyaltyEarnInput,
  LoyaltyRedeemInput,
  LoyaltyServiceKind,
  MembershipTier,
  PointsLedgerEntry,
  PointsWalletSnapshot,
  WalletLedgerKind,
} from './types'

interface WalletState {
  userId: string
  balance: number
  pendingPoints: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  membershipTier: MembershipTier
  history: PointsLedgerEntry[]
}

const EARN_RATES: Record<LoyaltyServiceKind, number> = {
  flight: 8,
  hotel: 10,
  car: 5,
  activity: 4,
  insurance: 3,
  visa: 2,
  future: 1,
}

export class PointsWallet {
  private readonly membership: MembershipEngine
  private readonly byUser = new Map<string, WalletState>()

  constructor(membership: MembershipEngine) {
    this.membership = membership
  }

  getOrCreate(userId: string): PointsWalletSnapshot {
    return this.snapshot(this.ensure(userId))
  }

  earn(input: LoyaltyEarnInput): PointsWalletSnapshot {
    const state = this.ensure(input.userId)
    const base = Math.max(0, Math.round(input.amountPaid * (EARN_RATES[input.serviceKind] ?? 1)))
    const multiplied = Math.round(base * this.membership.earnMultiplier(state.membershipTier))
    const bonus = Math.max(0, Math.round(input.bonusPoints ?? 0))
    const campaignBonus = input.campaignId ? Math.round(multiplied * 0.1) : 0
    const promotionBonus = input.promotionId ? Math.round(multiplied * 0.05) : 0
    const total = multiplied + bonus + campaignBonus + promotionBonus

    this.post(state, {
      kind: 'earn',
      points: total,
      serviceKind: input.serviceKind,
      providerId: input.providerId,
      bookingRef: input.bookingRef,
      campaignId: input.campaignId,
      promotionId: input.promotionId,
      expiresAt: expireInDays(365),
      note: `Earned ${total} points on ${input.serviceKind}`,
      metadata: {
        base,
        multiplied,
        bonus,
        campaignBonus,
        promotionBonus,
        currency: input.currency,
        amountPaid: input.amountPaid,
      },
    })
    state.lifetimeEarned += total
    state.membershipTier = this.membership.resolveTier(state.lifetimeEarned)
    if (campaignBonus > 0) {
      this.post(state, {
        kind: 'campaign',
        points: 0,
        campaignId: input.campaignId,
        note: `Campaign ${input.campaignId} applied (+${campaignBonus} included)`,
        metadata: { campaignBonus },
      })
    }
    if (promotionBonus > 0) {
      this.post(state, {
        kind: 'promotion',
        points: 0,
        promotionId: input.promotionId,
        note: `Promotion ${input.promotionId} applied (+${promotionBonus} included)`,
        metadata: { promotionBonus },
      })
    }
    return this.snapshot(state)
  }

  redeem(input: LoyaltyRedeemInput): PointsWalletSnapshot | { ok: false; message: string } {
    const state = this.ensure(input.userId)
    const points = Math.max(0, Math.round(input.points))
    if (points <= 0) return { ok: false, message: 'Redeem amount must be positive.' }
    if (state.balance < points) {
      return { ok: false, message: `Insufficient points. Balance ${state.balance}, requested ${points}.` }
    }
    this.post(state, {
      kind: 'redeem',
      points: -points,
      serviceKind: input.serviceKind,
      providerId: input.providerId,
      bookingRef: input.bookingRef,
      note: input.note ?? `Redeemed ${points} Rahhal Points`,
      metadata: {},
    })
    state.lifetimeRedeemed += points
    return this.snapshot(state)
  }

  bonus(
    userId: string,
    points: number,
    note: string,
    campaignId?: string,
    expiresAt?: string | null,
  ): PointsWalletSnapshot {
    const state = this.ensure(userId)
    const amount = Math.max(0, Math.round(points))
    this.post(state, {
      kind: 'bonus',
      points: amount,
      campaignId,
      expiresAt: expiresAt === undefined ? expireInDays(180) : expiresAt,
      note,
      metadata: {},
    })
    state.lifetimeEarned += amount
    state.membershipTier = this.membership.resolveTier(state.lifetimeEarned)
    return this.snapshot(state)
  }

  expire(userId: string, entryId?: string): PointsWalletSnapshot {
    const state = this.ensure(userId)
    const now = Date.now()
    const targets = state.history.filter((e) => {
      if (e.points <= 0 || !e.expiresAt) return false
      if (entryId && e.entryId !== entryId) return false
      return new Date(e.expiresAt).getTime() <= now
    })
    for (const entry of targets) {
      const remaining = Math.min(state.balance, entry.points)
      if (remaining <= 0) continue
      this.post(state, {
        kind: 'expire',
        points: -remaining,
        note: `Expired points from ${entry.entryId}`,
        metadata: { sourceEntryId: entry.entryId },
      })
    }
    return this.snapshot(state)
  }

  reverse(userId: string, entryId: string, note?: string): PointsWalletSnapshot | { ok: false; message: string } {
    const state = this.ensure(userId)
    const original = state.history.find((e) => e.entryId === entryId)
    if (!original) return { ok: false, message: `Ledger entry ${entryId} not found.` }
    this.post(state, {
      kind: 'reverse',
      points: -original.points,
      serviceKind: original.serviceKind,
      providerId: original.providerId,
      bookingRef: original.bookingRef,
      note: note ?? `Reversed ${entryId}`,
      metadata: { reversedEntryId: entryId },
    })
    if (original.points > 0) {
      state.lifetimeEarned = Math.max(0, state.lifetimeEarned - original.points)
    } else {
      state.lifetimeRedeemed = Math.max(0, state.lifetimeRedeemed + original.points)
    }
    state.membershipTier = this.membership.resolveTier(state.lifetimeEarned)
    return this.snapshot(state)
  }

  transfer(fromUserId: string, toUserId: string, points: number): PointsWalletSnapshot | { ok: false; message: string } {
    const amount = Math.max(0, Math.round(points))
    const from = this.ensure(fromUserId)
    if (from.balance < amount) return { ok: false, message: 'Insufficient points to transfer.' }
    this.post(from, {
      kind: 'transfer',
      points: -amount,
      note: `Transfer to ${toUserId}`,
      metadata: { toUserId },
    })
    const to = this.ensure(toUserId)
    this.post(to, {
      kind: 'transfer',
      points: amount,
      note: `Transfer from ${fromUserId}`,
      metadata: { fromUserId },
      expiresAt: expireInDays(365),
    })
    to.lifetimeEarned += amount
    to.membershipTier = this.membership.resolveTier(to.lifetimeEarned)
    return this.snapshot(from)
  }

  adjust(userId: string, points: number, note: string): PointsWalletSnapshot {
    const state = this.ensure(userId)
    const amount = Math.round(points)
    this.post(state, {
      kind: 'adjustment',
      points: amount,
      note,
      metadata: {},
      expiresAt: amount > 0 ? expireInDays(365) : null,
    })
    if (amount > 0) {
      state.lifetimeEarned += amount
      state.membershipTier = this.membership.resolveTier(state.lifetimeEarned)
    }
    return this.snapshot(state)
  }

  addPending(userId: string, points: number): PointsWalletSnapshot {
    const state = this.ensure(userId)
    state.pendingPoints += Math.max(0, Math.round(points))
    return this.snapshot(state)
  }

  clearPending(userId: string, commit = true): PointsWalletSnapshot {
    const state = this.ensure(userId)
    if (commit && state.pendingPoints > 0) {
      this.bonus(userId, state.pendingPoints, 'Pending points released')
    }
    state.pendingPoints = 0
    return this.snapshot(state)
  }

  private ensure(userId: string): WalletState {
    let state = this.byUser.get(userId)
    if (!state) {
      state = {
        userId,
        balance: 0,
        pendingPoints: 0,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
        membershipTier: 'explorer',
        history: [],
      }
      this.byUser.set(userId, state)
    }
    return state
  }

  private post(
    state: WalletState,
    input: {
      kind: WalletLedgerKind
      points: number
      serviceKind?: LoyaltyServiceKind
      providerId?: string
      bookingRef?: string
      campaignId?: string
      promotionId?: string
      expiresAt?: string | null
      note: string
      metadata: Record<string, unknown>
    },
  ): void {
    state.balance = Math.max(0, state.balance + input.points)
    const entry: PointsLedgerEntry = {
      entryId: `pt_${Math.random().toString(36).slice(2, 10)}`,
      userId: state.userId,
      kind: input.kind,
      points: input.points,
      balanceAfter: state.balance,
      serviceKind: input.serviceKind,
      providerId: input.providerId,
      bookingRef: input.bookingRef,
      campaignId: input.campaignId,
      promotionId: input.promotionId,
      expiresAt: input.expiresAt ?? null,
      note: input.note,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
    }
    state.history.push(entry)
  }

  private snapshot(state: WalletState): PointsWalletSnapshot {
    const history = state.history.map((e) => ({ ...e, metadata: { ...e.metadata } }))
    return {
      userId: state.userId,
      balance: state.balance,
      pendingPoints: state.pendingPoints,
      lifetimeEarned: state.lifetimeEarned,
      lifetimeRedeemed: state.lifetimeRedeemed,
      membershipTier: state.membershipTier,
      history,
      expirations: history
        .filter((e) => e.points > 0 && e.expiresAt)
        .map((e) => ({ entryId: e.entryId, points: e.points, expiresAt: e.expiresAt! })),
      campaignBonuses: history
        .filter((e) => e.kind === 'campaign' || e.kind === 'bonus')
        .filter((e) => e.campaignId || e.kind === 'bonus')
        .map((e) => ({
          campaignId: e.campaignId ?? 'bonus',
          points: Math.max(0, e.points),
          note: e.note,
        })),
    }
  }
}

export function createPointsWallet(membership: MembershipEngine): PointsWallet {
  return new PointsWallet(membership)
}

function expireInDays(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}
