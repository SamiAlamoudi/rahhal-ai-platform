/**
 * Sprint 38 — Universal Loyalty, Rewards & Membership Platform.
 * Orchestrates wallet, membership, benefits, airline/hotel loyalty, and recommendations.
 */

import { AirlineLoyaltyStore, createAirlineLoyaltyStore } from './AirlineLoyaltyStore'
import { BenefitsEngine, createBenefitsEngine } from './BenefitsEngine'
import {
  LoyaltyEvents,
  createLoyaltyEvent,
  type LoyaltyEvent,
} from './LoyaltyEvents'
import { LoyaltyExplainer, createLoyaltyExplainer } from './LoyaltyExplainer'
import { isLoyaltyPlatformEnabled } from './LoyaltyFeatureFlags'
import { LoyaltyMetrics } from './LoyaltyMetrics'
import {
  LoyaltyRecommendationEngine,
  createLoyaltyRecommendationEngine,
} from './LoyaltyRecommendationEngine'
import { MembershipEngine, createMembershipEngine } from './MembershipEngine'
import { PointsWallet, createPointsWallet } from './PointsWallet'
import {
  HotelLoyaltyRegistry,
  createHotelLoyaltyRegistry,
} from './hotelAdapters'
import type {
  AirlineLoyaltyAccount,
  HotelLoyaltyAccount,
  LoyaltyCandidate,
  LoyaltyDisabledResult,
  LoyaltyEarnInput,
  LoyaltyPlatformResult,
  LoyaltyRecommendationContext,
  LoyaltyRedeemInput,
  LoyaltyServiceKind,
  PointsWalletSnapshot,
} from './types'

export interface LoyaltyPlatformOptions {
  enabled?: boolean
  membership?: MembershipEngine
  wallet?: PointsWallet
  benefits?: BenefitsEngine
  airlines?: AirlineLoyaltyStore
  hotels?: HotelLoyaltyRegistry
  recommender?: LoyaltyRecommendationEngine
  explainer?: LoyaltyExplainer
  events?: LoyaltyEvents
  metrics?: LoyaltyMetrics
  onEvent?: (event: LoyaltyEvent) => void
}

export class LoyaltyPlatform {
  private readonly enabledOverride: boolean | undefined
  private readonly membership: MembershipEngine
  private readonly wallet: PointsWallet
  private readonly benefits: BenefitsEngine
  private readonly airlines: AirlineLoyaltyStore
  private readonly hotels: HotelLoyaltyRegistry
  private readonly recommender: LoyaltyRecommendationEngine
  private readonly explainer: LoyaltyExplainer
  private readonly events: LoyaltyEvents
  private readonly metrics: LoyaltyMetrics
  private readonly onEvent: ((event: LoyaltyEvent) => void) | undefined
  private readonly recent: LoyaltyEvent[] = []

  constructor(options: LoyaltyPlatformOptions = {}) {
    this.enabledOverride = options.enabled
    this.membership = options.membership ?? createMembershipEngine()
    this.wallet = options.wallet ?? createPointsWallet(this.membership)
    this.benefits = options.benefits ?? createBenefitsEngine(this.membership)
    this.airlines = options.airlines ?? createAirlineLoyaltyStore()
    this.hotels = options.hotels ?? createHotelLoyaltyRegistry()
    this.recommender =
      options.recommender
      ?? createLoyaltyRecommendationEngine({
        wallet: this.wallet,
        membership: this.membership,
        benefits: this.benefits,
        airlines: this.airlines,
        hotels: this.hotels,
      })
    this.explainer = options.explainer ?? createLoyaltyExplainer()
    this.events = options.events ?? new LoyaltyEvents()
    this.metrics = options.metrics ?? new LoyaltyMetrics()
    this.onEvent = options.onEvent
  }

  isEnabled(): boolean {
    if (typeof this.enabledOverride === 'boolean') return this.enabledOverride
    return isLoyaltyPlatformEnabled()
  }

  getWallet(userId: string, locale: 'en' | 'ar' = 'en'): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const wallet = this.wallet.getOrCreate(userId)
    this.emit(createLoyaltyEvent('WalletQueried', userId, { balance: wallet.balance }))
    return {
      ok: true,
      wallet,
      membershipTier: wallet.membershipTier,
      benefits: this.benefits.listBenefits(wallet.membershipTier),
      explanation: this.explainer.explainWallet(wallet, locale),
    }
  }

  earn(input: LoyaltyEarnInput, locale: 'en' | 'ar' = 'en'): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const before = this.wallet.getOrCreate(input.userId).membershipTier
    const wallet = this.wallet.earn(input)
    const earned =
      wallet.history.filter((h) => h.kind === 'earn').at(-1)?.points ?? 0
    this.metrics.recordEarn(earned, input.serviceKind)
    this.emit(
      createLoyaltyEvent('PointsEarned', input.userId, {
        points: earned,
        serviceKind: input.serviceKind,
        providerId: input.providerId,
      }),
    )
    if (wallet.membershipTier !== before) {
      this.emit(
        createLoyaltyEvent('MembershipChanged', input.userId, {
          from: before,
          to: wallet.membershipTier,
        }),
      )
    }
    return {
      ok: true,
      wallet,
      membershipTier: wallet.membershipTier,
      benefits: this.benefits.listBenefits(wallet.membershipTier),
      explanation: this.explainer.explainEarn(earned, input.serviceKind, wallet.membershipTier, locale),
    }
  }

  redeem(input: LoyaltyRedeemInput, locale: 'en' | 'ar' = 'en'): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const result = this.wallet.redeem(input)
    if (!isWalletSnapshot(result)) {
      return { ok: false, code: 'INSUFFICIENT_POINTS', message: result.message }
    }
    this.metrics.recordRedeem(input.points)
    this.emit(
      createLoyaltyEvent('PointsRedeemed', input.userId, {
        points: input.points,
        balance: result.balance,
      }),
    )
    return {
      ok: true,
      wallet: result,
      membershipTier: result.membershipTier,
      benefits: this.benefits.listBenefits(result.membershipTier),
      explanation: this.explainer.explainRedeem(input.points, result.balance, locale),
    }
  }

  bonus(
    userId: string,
    points: number,
    note: string,
    campaignId?: string,
    expiresAt?: string | null,
  ): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const wallet = this.wallet.bonus(userId, points, note, campaignId, expiresAt)
    this.metrics.recordBonus(points)
    return {
      ok: true,
      wallet,
      membershipTier: wallet.membershipTier,
      benefits: this.benefits.listBenefits(wallet.membershipTier),
      explanation: this.explainer.explainWallet(wallet),
    }
  }

  expire(userId: string, entryId?: string): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const wallet = this.wallet.expire(userId, entryId)
    this.emit(createLoyaltyEvent('PointsExpired', userId, { entryId }))
    return {
      ok: true,
      wallet,
      membershipTier: wallet.membershipTier,
      benefits: this.benefits.listBenefits(wallet.membershipTier),
      explanation: this.explainer.explainWallet(wallet),
    }
  }

  reverse(userId: string, entryId: string): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const result = this.wallet.reverse(userId, entryId)
    if (!isWalletSnapshot(result)) {
      return { ok: false, code: 'NOT_FOUND', message: result.message }
    }
    this.emit(createLoyaltyEvent('PointsReversed', userId, { entryId }))
    return {
      ok: true,
      wallet: result,
      membershipTier: result.membershipTier,
      benefits: this.benefits.listBenefits(result.membershipTier),
      explanation: this.explainer.explainWallet(result),
    }
  }

  recommend(
    candidates: LoyaltyCandidate[],
    context: LoyaltyRecommendationContext,
    locale: 'en' | 'ar' = 'en',
  ): LoyaltyPlatformResult | LoyaltyDisabledResult {
    if (!this.isEnabled()) return disabled()
    const recommendations = this.recommender.recommend(candidates, context)
    const top = recommendations[0] ?? null
    if (top) this.metrics.recordRecommendation(top.score)
    this.emit(
      createLoyaltyEvent('RecommendationGenerated', context.userId, {
        count: recommendations.length,
        topId: top?.candidate.candidateId,
      }),
    )
    const wallet = this.wallet.getOrCreate(context.userId)
    return {
      ok: true,
      wallet,
      membershipTier: wallet.membershipTier,
      benefits: this.benefits.listBenefits(wallet.membershipTier),
      recommendation: top,
      recommendations,
      explanation: top
        ? this.explainer.explainRecommendation(top, locale)
        : 'No loyalty recommendations available.',
    }
  }

  estimateEarn(
    userId: string,
    amountPaid: number,
    serviceKind: LoyaltyServiceKind,
  ): number {
    const wallet = this.wallet.getOrCreate(userId)
    const rates: Record<LoyaltyServiceKind, number> = {
      flight: 8,
      hotel: 10,
      car: 5,
      activity: 4,
      insurance: 3,
      visa: 2,
      future: 1,
    }
    return Math.round(
      amountPaid * (rates[serviceKind] ?? 1) * this.membership.earnMultiplier(wallet.membershipTier),
    )
  }

  canUpgradeWithPoints(userId: string): boolean {
    const wallet = this.wallet.getOrCreate(userId)
    return this.benefits.hasBenefit(wallet.membershipTier, 'free_upgrades')
  }

  explainUpgrade(userId: string, locale: 'en' | 'ar' = 'en'): string {
    const wallet = this.wallet.getOrCreate(userId)
    return this.explainer.explainUpgrade(
      wallet.membershipTier,
      this.canUpgradeWithPoints(userId),
      locale,
    )
  }

  upsertAirlineAccount(userId: string, account: AirlineLoyaltyAccount): AirlineLoyaltyAccount {
    return this.airlines.upsert(userId, account)
  }

  upsertHotelAccount(userId: string, account: HotelLoyaltyAccount): HotelLoyaltyAccount {
    return this.hotels.upsertAccount(userId, account)
  }

  getAirlineStore(): AirlineLoyaltyStore {
    return this.airlines
  }

  getHotelRegistry(): HotelLoyaltyRegistry {
    return this.hotels
  }

  getMembershipEngine(): MembershipEngine {
    return this.membership
  }

  getMetrics() {
    return this.metrics.snapshot()
  }

  getRecentEvents(limit = 50): LoyaltyEvent[] {
    return this.recent.slice(-limit)
  }

  private emit(event: LoyaltyEvent): void {
    this.recent.push(event)
    this.events.emit(event)
    this.onEvent?.(event)
  }
}

export function createLoyaltyPlatform(options?: LoyaltyPlatformOptions): LoyaltyPlatform {
  return new LoyaltyPlatform(options)
}

export function isLoyaltyPlatformResult(
  value: LoyaltyPlatformResult | LoyaltyDisabledResult,
): value is LoyaltyPlatformResult {
  return value.ok === true
}

function disabled(): LoyaltyDisabledResult {
  return {
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Loyalty platform is disabled (brain.loyalty_platform).',
  }
}

function isWalletSnapshot(
  value: PointsWalletSnapshot | { ok: false; message: string },
): value is PointsWalletSnapshot {
  return !('ok' in value)
}
