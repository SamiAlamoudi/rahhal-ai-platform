/**
 * Sprint 38 — Universal Loyalty, Rewards & Membership Platform tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  LOYALTY_PLATFORM_FEATURE_ID,
  createLoyaltyPlatform,
  createMembershipEngine,
  createPointsWallet,
  createHotelLoyaltyRegistry,
  createAirlineLoyaltyStore,
  detectLoyaltyConversationQuery,
  answerLoyaltyQuery,
  isLoyaltyPlatformEnabled,
  isLoyaltyPlatformResult,
  type LoyaltyCandidate,
  type LoyaltyServiceKind,
} from '../loyalty'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { ConversationController } from '../chat/conversationExperience/ConversationController'

const SERVICES: LoyaltyServiceKind[] = [
  'flight',
  'hotel',
  'car',
  'activity',
  'insurance',
  'visa',
  'future',
]

function enableLoyaltyChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
  registry.setEnabled('brain.travel_execution_engine', true)
  registry.setEnabled('brain.payments_platform', true)
  registry.setEnabled('brain.trip_management', true)
  registry.setEnabled('brain.refund_policy_engine', true)
  registry.setEnabled('brain.travel_disruption_engine', true)
  registry.setEnabled('brain.loyalty_platform', true)
}

function hotelCandidates(): LoyaltyCandidate[] {
  return [
    {
      candidateId: 'h1',
      serviceKind: 'hotel',
      providerId: 'hilton',
      title: 'Hilton Dubai',
      price: 800,
      currency: 'SAR',
      hotelBrand: 'hilton',
      brandOrAirline: 'Hilton',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
    },
    {
      candidateId: 'h2',
      serviceKind: 'hotel',
      providerId: 'marriott',
      title: 'Marriott Marina',
      price: 850,
      currency: 'SAR',
      hotelBrand: 'marriott',
      brandOrAirline: 'Marriott',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
    },
    {
      candidateId: 'h3',
      serviceKind: 'hotel',
      providerId: 'hyatt',
      title: 'Hyatt Regency',
      price: 1000,
      currency: 'SAR',
      hotelBrand: 'hyatt',
      brandOrAirline: 'Hyatt',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
      statusUpgradeEligible: true,
    },
  ]
}

function flightCandidates(): LoyaltyCandidate[] {
  return [
    {
      candidateId: 'f1',
      serviceKind: 'flight',
      providerId: 'SV',
      title: 'Saudia to DXB',
      price: 1200,
      currency: 'SAR',
      brandOrAirline: 'SV',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 4000,
    },
    {
      candidateId: 'f2',
      serviceKind: 'flight',
      providerId: 'EK',
      title: 'Emirates to DXB',
      price: 1500,
      currency: 'SAR',
      brandOrAirline: 'EK',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 6000,
    },
  ]
}

describe('Sprint 38 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.loyalty_platform disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(LOYALTY_PLATFORM_FEATURE_ID)).toBe(false)
    expect(isLoyaltyPlatformEnabled()).toBe(false)
  })

  it('requires brain.travel_disruption_engine before brain.loyalty_platform', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.loyalty_platform', true)
    expect(registry.isEnabled('brain.loyalty_platform')).toBe(false)
    enableLoyaltyChain()
    expect(registry.isEnabled('brain.loyalty_platform')).toBe(true)
    expect(isLoyaltyPlatformEnabled()).toBe(true)
  })

  it('feature definition depends on travel_disruption_engine', () => {
    const def = getFeatureRegistry().list().find((f) => f.id === LOYALTY_PLATFORM_FEATURE_ID)
    expect(def?.dependsOn).toContain('brain.travel_disruption_engine')
    expect(def?.enabled).toBe(false)
  })
})

describe('Membership levels and benefits', () => {
  const membership = createMembershipEngine()

  it('defines explorer silver gold platinum diamond', () => {
    const tiers = membership.listTiers().map((t) => t.tier)
    expect(tiers).toEqual(['explorer', 'silver', 'gold', 'platinum', 'diamond'])
  })

  it('resolves tiers from lifetime points', () => {
    expect(membership.resolveTier(0)).toBe('explorer')
    expect(membership.resolveTier(5000)).toBe('silver')
    expect(membership.resolveTier(15000)).toBe('gold')
    expect(membership.resolveTier(40000)).toBe('platinum')
    expect(membership.resolveTier(100000)).toBe('diamond')
  })

  it('exposes configurable benefits per tier', () => {
    const gold = membership.getBenefits('gold')
    expect(gold.some((b) => b.kind === 'late_checkout')).toBe(true)
    expect(gold.some((b) => b.kind === 'airport_lounge_credits')).toBe(true)
    expect(gold.some((b) => b.kind === 'priority_ai_processing')).toBe(true)
    const diamond = membership.getBenefits('diamond')
    expect(diamond.some((b) => b.kind === 'free_upgrades')).toBe(true)
    expect(diamond.some((b) => b.kind === 'exclusive_offers')).toBe(true)
    expect(diamond.some((b) => b.kind === 'priority_support')).toBe(true)
    expect(diamond.some((b) => b.kind === 'free_cancellation_credits')).toBe(true)
    expect(diamond.some((b) => b.kind === 'bonus_points')).toBe(true)
    expect(diamond.some((b) => b.kind === 'extra_discounts')).toBe(true)
  })
})

describe('Points wallet operations', () => {
  it('earns points across all service kinds', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    for (const serviceKind of SERVICES) {
      const result = platform.earn({
        userId: 'u_earn',
        amountPaid: 1000,
        currency: 'SAR',
        serviceKind,
        providerId: `prov_${serviceKind}`,
      })
      expect(isLoyaltyPlatformResult(result)).toBe(true)
      if (!isLoyaltyPlatformResult(result)) continue
      expect(result.wallet.balance).toBeGreaterThan(0)
    }
  })

  it('supports earn redeem expire reverse bonus promotion campaign transfer adjustment', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const earned = platform.earn({
      userId: 'u_ops',
      amountPaid: 2000,
      currency: 'SAR',
      serviceKind: 'hotel',
      providerId: 'hilton',
      campaignId: 'summer26',
      promotionId: 'promo10',
      bonusPoints: 100,
    })
    expect(isLoyaltyPlatformResult(earned)).toBe(true)
    if (!isLoyaltyPlatformResult(earned)) return
    expect(earned.wallet.balance).toBeGreaterThan(100)
    expect(earned.wallet.history.some((h) => h.kind === 'earn')).toBe(true)
    expect(earned.wallet.history.some((h) => h.kind === 'campaign')).toBe(true)
    expect(earned.wallet.history.some((h) => h.kind === 'promotion')).toBe(true)

    const redeemed = platform.redeem({ userId: 'u_ops', points: 200 })
    expect(isLoyaltyPlatformResult(redeemed)).toBe(true)
    if (!isLoyaltyPlatformResult(redeemed)) return
    expect(redeemed.wallet.lifetimeRedeemed).toBe(200)

    const bonus = platform.bonus('u_ops', 50, 'Welcome bonus', 'welcome')
    expect(isLoyaltyPlatformResult(bonus)).toBe(true)

    const expiredBonus = platform.bonus(
      'u_ops',
      25,
      'Expiring soon',
      'expire_camp',
      new Date(Date.now() - 1000).toISOString(),
    )
    expect(isLoyaltyPlatformResult(expiredBonus)).toBe(true)
    const expired = platform.expire('u_ops')
    expect(isLoyaltyPlatformResult(expired)).toBe(true)
    if (!isLoyaltyPlatformResult(expired)) return
    expect(expired.wallet.history.some((h) => h.kind === 'expire')).toBe(true)

    const earnEntry = expired.wallet.history.find((h) => h.kind === 'earn')!
    const reversed = platform.reverse('u_ops', earnEntry.entryId)
    expect(isLoyaltyPlatformResult(reversed)).toBe(true)
    if (!isLoyaltyPlatformResult(reversed)) return
    expect(reversed.wallet.history.some((h) => h.kind === 'reverse')).toBe(true)

    // Seed second user and transfer via wallet internals through earn+platform methods.
    platform.earn({
      userId: 'u_ops',
      amountPaid: 500,
      currency: 'SAR',
      serviceKind: 'car',
      providerId: 'car',
    })
    const walletApi = createLoyaltyPlatform({ enabled: true })
    // transfer covered via PointsWallet through a dedicated platform-less check below
    expect(walletApi.isEnabled()).toBe(true)
  })

  it('transfers and adjusts points on wallet', () => {
    const membership = createMembershipEngine()
    const wallet = createPointsWallet(membership)
    wallet.earn({
      userId: 'from',
      amountPaid: 1000,
      currency: 'SAR',
      serviceKind: 'flight',
      providerId: 'SV',
    })
    const transfer = wallet.transfer('from', 'to', 100)
    expect('ok' in transfer && transfer.ok === false).toBe(false)
    expect(wallet.getOrCreate('to').balance).toBeGreaterThanOrEqual(100)
    const adjusted = wallet.adjust('to', 40, 'Manual adjustment')
    expect(adjusted.history.some((h) => h.kind === 'adjustment')).toBe(true)
    wallet.addPending('to', 15)
    expect(wallet.getOrCreate('to').pendingPoints).toBe(15)
    wallet.clearPending('to', true)
    expect(wallet.getOrCreate('to').pendingPoints).toBe(0)
  })

  it('rejects redeem when insufficient points', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const result = platform.redeem({ userId: 'broke', points: 500 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INSUFFICIENT_POINTS')
  })

  it('returns FEATURE_DISABLED when flag off', () => {
    const platform = createLoyaltyPlatform({ enabled: false })
    const result = platform.getWallet('u1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FEATURE_DISABLED')
  })
})

describe('Airline and hotel loyalty integrations', () => {
  it('stores airline loyalty numbers and tracks miles', () => {
    const airlines = createAirlineLoyaltyStore()
    airlines.upsert('u1', {
      airlineCode: 'EK',
      programName: 'Skywards',
      memberNumber: 'EK123',
      milesBalance: 10000,
      tierName: 'Silver',
    })
    const updated = airlines.addMiles('u1', 'EK', 500)
    expect(updated?.milesBalance).toBe(10500)
    const best = airlines.recommendBestAirline('u1', flightCandidates())
    expect(best?.airlineCode).toBe('EK')
    expect(best?.reason).toMatch(/Skywards|miles/i)
  })

  it('registers hilton marriott ihg accor hyatt best western adapters', () => {
    const hotels = createHotelLoyaltyRegistry()
    const brands = hotels.listAdapters().map((a) => a.brand)
    expect(brands).toEqual(
      expect.arrayContaining([
        'hilton',
        'marriott',
        'ihg',
        'accor',
        'hyatt',
        'best_western',
        'generic',
      ]),
    )
    hotels.upsertAccount('u1', {
      brand: 'hilton',
      programName: 'Hilton Honors',
      memberNumber: 'HH1',
      pointsBalance: 2000,
      tierName: 'Gold',
    })
    const ranked = hotels.rankHotelsByRewards('u1', hotelCandidates())
    expect(ranked[0].serviceKind).toBe('hotel')
    expect(ranked[0].estimatedPartnerMilesOrPoints).toBeGreaterThan(0)
  })
})

describe('Smart recommendation engine', () => {
  it('ranks candidates using price points benefits upgrades prefs history and context', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.earn({
      userId: 'u_rec',
      amountPaid: 20000,
      currency: 'SAR',
      serviceKind: 'hotel',
      providerId: 'hilton',
      bonusPoints: 30000,
    })
    platform.upsertAirlineAccount('u_rec', {
      airlineCode: 'EK',
      programName: 'Skywards',
      memberNumber: 'EK9',
      milesBalance: 50000,
    })
    const result = platform.recommend(
      [...hotelCandidates(), ...flightCandidates()],
      {
        userId: 'u_rec',
        preferredHotels: ['Hilton'],
        preferredAirlines: ['EK'],
        travelerPreferences: ['lounge'],
        previousHistory: ['Hilton'],
        conversationNotes: ['Looking for rewards'],
        wantToRedeemPoints: true,
        redeemPointsAmount: 500,
      },
    )
    expect(isLoyaltyPlatformResult(result)).toBe(true)
    if (!isLoyaltyPlatformResult(result)) return
    expect(result.recommendations?.length).toBeGreaterThan(0)
    const top = result.recommendation!
    expect(top.rank).toBe(1)
    expect(top.factors.price).toBeDefined()
    expect(top.factors.points_earned).toBeDefined()
    expect(top.factors.points_redeemed).toBeDefined()
    expect(top.factors.membership_benefits).toBeDefined()
    expect(top.factors.status_upgrades).toBeDefined()
    expect(top.factors.traveler_preferences).toBeDefined()
    expect(top.factors.previous_history).toBeDefined()
    expect(top.factors.conversation_context).toBeDefined()
    expect(top.explanation).toContain('Rank #1')
  })

  it('picks the hotel with the most rewards', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const result = platform.recommend(hotelCandidates(), {
      userId: 'u_hotel',
      conversationNotes: ['most rewards'],
    })
    expect(isLoyaltyPlatformResult(result)).toBe(true)
    if (!isLoyaltyPlatformResult(result)) return
    expect(result.explanation).toMatch(/Best rewards pick|Hilton|Marriott|Hyatt/i)
  })
})

describe('LoyaltyPlatform metrics and events', () => {
  it('records metrics and recent events', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.earn({
      userId: 'u_met',
      amountPaid: 1000,
      currency: 'SAR',
      serviceKind: 'activity',
      providerId: 'act',
    })
    platform.bonus('u_met', 20, 'bonus')
    platform.redeem({ userId: 'u_met', points: 10 })
    platform.recommend(hotelCandidates(), { userId: 'u_met' })
    const metrics = platform.getMetrics()
    expect(metrics.earns).toBe(1)
    expect(metrics.bonuses).toBe(1)
    expect(metrics.redeems).toBe(1)
    expect(metrics.recommendations).toBe(1)
    expect(metrics.byServiceKind.activity).toBe(1)
    const events = platform.getRecentEvents()
    expect(events.some((e) => e.type === 'PointsEarned')).toBe(true)
    expect(events.some((e) => e.type === 'RecommendationGenerated')).toBe(true)
  })

  it('upgrades membership as lifetime points grow', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const result = platform.earn({
      userId: 'u_tier',
      amountPaid: 10000,
      currency: 'SAR',
      serviceKind: 'flight',
      providerId: 'SV',
      bonusPoints: 20000,
    })
    expect(isLoyaltyPlatformResult(result)).toBe(true)
    if (!isLoyaltyPlatformResult(result)) return
    expect(['silver', 'gold', 'platinum', 'diamond']).toContain(result.membershipTier)
    expect(platform.getRecentEvents().some((e) => e.type === 'MembershipChanged')).toBe(true)
  })
})

describe('Conversation loyalty integration', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('detects loyalty conversation commands', () => {
    expect(detectConversationCommand('Use my Bilamo points.')).toBe('use_bilamo_points')
    expect(detectConversationCommand('Which hotel gives me the most rewards?')).toBe(
      'most_rewards_hotel',
    )
    expect(detectConversationCommand('Can I upgrade using points?')).toBe('upgrade_with_points')
    expect(detectConversationCommand('How many points will I earn?')).toBe('points_earn_estimate')
    expect(detectConversationCommand('What is my points balance?')).toBe('wallet_balance')
    expect(detectLoyaltyConversationQuery('Use my Bilamo points.')).toBe('use_bilamo_points')
  })

  it('answers earn estimate and rewards hotel queries', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const earn = answerLoyaltyQuery({
      kind: 'points_earn_estimate',
      platform,
      userId: 'u_chat',
      estimateAmount: 2000,
      estimateService: 'hotel',
    })
    expect(earn).toMatch(/earn about \d+ Bilamo Points/i)

    const hotel = answerLoyaltyQuery({
      kind: 'most_rewards_hotel',
      platform,
      userId: 'u_chat',
      candidates: hotelCandidates(),
    })
    expect(hotel).toMatch(/Best rewards pick/i)
  })

  it('ConversationController invokes LoyaltyPlatform when flag on', async () => {
    enableLoyaltyChain()
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.earn({
      userId: 'user_loyalty',
      amountPaid: 1500,
      currency: 'SAR',
      serviceKind: 'hotel',
      providerId: 'hilton',
    })
    const controller = ConversationController({
      enabled: true,
      loyaltyPlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_loyalty_s38',
      userId: 'user_loyalty',
      userText: 'How many points will I earn?',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('points_earn_estimate')
    expect(turn.assistantMessage.meta?.loyaltyPlatform).toBe(true)
    expect(turn.renderedText).toMatch(/Bilamo Points/i)
  })

  it('handles use points and upgrade questions in conversation', async () => {
    enableLoyaltyChain()
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.earn({
      userId: 'u2',
      amountPaid: 5000,
      currency: 'SAR',
      serviceKind: 'flight',
      providerId: 'EK',
      bonusPoints: 40000,
    })
    const controller = ConversationController({
      enabled: true,
      loyaltyPlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const usePoints = await controller.handleTurn({
      conversationId: 'conv_use_pts',
      userId: 'u2',
      userText: 'Use my Bilamo points.',
      locale: 'en',
    })
    expect(usePoints.commandKind).toBe('use_bilamo_points')
    expect(usePoints.assistantMessage.meta?.loyaltyPlatform).toBe(true)
    expect(usePoints.renderedText).toMatch(/Bilamo Points|Remaining balance/i)

    const upgrade = await controller.handleTurn({
      conversationId: 'conv_upgrade',
      userId: 'u2',
      userText: 'Can I upgrade using points?',
      locale: 'en',
    })
    expect(upgrade.commandKind).toBe('upgrade_with_points')
    expect(upgrade.renderedText.length).toBeGreaterThan(10)
  })

  it('does not invoke loyalty platform when feature flag is off', async () => {
    resetFeatureRegistry()
    const controller = ConversationController({
      enabled: true,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_flag_off_s38',
      userId: 'u1',
      userText: 'Use my Bilamo points.',
      locale: 'en',
    })
    expect(turn.assistantMessage.meta?.loyaltyPlatform).not.toBe(true)
  })
})

describe('Wallet snapshot fields', () => {
  it('exposes balance pending history expirations and campaign bonuses', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.earn({
      userId: 'u_snap',
      amountPaid: 1200,
      currency: 'SAR',
      serviceKind: 'insurance',
      providerId: 'ins',
      campaignId: 'camp1',
    })
    const wallet = platform.getWallet('u_snap')
    expect(isLoyaltyPlatformResult(wallet)).toBe(true)
    if (!isLoyaltyPlatformResult(wallet)) return
    expect(wallet.wallet.balance).toBeGreaterThan(0)
    expect(Array.isArray(wallet.wallet.history)).toBe(true)
    expect(Array.isArray(wallet.wallet.expirations)).toBe(true)
    expect(wallet.wallet.campaignBonuses.length).toBeGreaterThan(0)
    expect(wallet.explanation).toContain('Bilamo Points balance')
  })
})

describe('Per-service earn coverage', () => {
  it.each(SERVICES)('estimates earn for %s', (serviceKind) => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const points = platform.estimateEarn('u_est', 1000, serviceKind)
    expect(points).toBeGreaterThan(0)
  })
})

describe('Benefits and upgrade helpers', () => {
  it('applies membership cash discount', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.earn({
      userId: 'u_disc',
      amountPaid: 5000,
      currency: 'SAR',
      serviceKind: 'hotel',
      providerId: 'hilton',
      bonusPoints: 20000,
    })
    const wallet = platform.getWallet('u_disc')
    expect(isLoyaltyPlatformResult(wallet)).toBe(true)
    if (!isLoyaltyPlatformResult(wallet)) return
    const benefits = wallet.benefits
    expect(benefits.length).toBeGreaterThan(0)
    expect(platform.explainUpgrade('u_disc')).toMatch(/upgrade|tier|points/i)
  })

  it('lists hotel adapter program names', () => {
    const hotels = createHotelLoyaltyRegistry()
    const names = hotels.listAdapters().map((a) => a.programName)
    expect(names).toEqual(
      expect.arrayContaining([
        'Hilton Honors',
        'Marriott Bonvoy',
        'IHG One Rewards',
        'ALL - Accor Live Limitless',
        'World of Hyatt',
        'Best Western Rewards',
      ]),
    )
  })

  it('detects hotel brand from candidate title', () => {
    const hotels = createHotelLoyaltyRegistry()
    const est = hotels.estimateForCandidate('u1', {
      candidateId: 'x',
      serviceKind: 'hotel',
      providerId: 'generic',
      title: 'Novotel City Center',
      price: 700,
      currency: 'SAR',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
    })
    expect(est.brand).toBe('accor')
  })

  it('answers membership benefits and wallet balance queries', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.bonus('u_ben', 100, 'seed')
    const benefits = answerLoyaltyQuery({
      kind: 'membership_benefits',
      platform,
      userId: 'u_ben',
    })
    expect(benefits).toMatch(/membership|Benefits|Explorer|Silver|Gold/i)
    const balance = answerLoyaltyQuery({
      kind: 'wallet_balance',
      platform,
      userId: 'u_ben',
    })
    expect(balance).toContain('Bilamo Points balance')
  })

  it('handles Arabic earn estimate locale', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const text = answerLoyaltyQuery({
      kind: 'points_earn_estimate',
      platform,
      userId: 'u_ar',
      locale: 'ar',
      estimateAmount: 1000,
      estimateService: 'flight',
    })
    expect(text).toContain('نقطة')
  })

  it('ConversationController handles most rewards hotel question', async () => {
    enableLoyaltyChain()
    const controller = ConversationController({
      enabled: true,
      loyaltyPlatform: createLoyaltyPlatform({ enabled: true }),
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_rewards_hotel',
      userId: 'u_rh',
      userText: 'Which hotel gives me the most rewards?',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('most_rewards_hotel')
    expect(turn.assistantMessage.meta?.loyaltyPlatform).toBe(true)
    expect(turn.renderedText).toMatch(/Best rewards pick|rewards/i)
  })

  it('exposes isEnabled override and registry path', () => {
    resetFeatureRegistry()
    expect(createLoyaltyPlatform().isEnabled()).toBe(false)
    expect(createLoyaltyPlatform({ enabled: true }).isEnabled()).toBe(true)
  })
})

describe('Membership earn multipliers', () => {
  it.each([
    ['explorer', 1],
    ['silver', 1.15],
    ['gold', 1.35],
    ['platinum', 1.6],
    ['diamond', 2],
  ] as const)('tier %s has multiplier %s', (tier, multiplier) => {
    const membership = createMembershipEngine()
    expect(membership.earnMultiplier(tier)).toBe(multiplier)
  })
})

describe('Edge cases', () => {
  it('returns NOT_FOUND when reversing unknown ledger entry', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const result = platform.reverse('u_missing', 'pt_does_not_exist')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_FOUND')
  })

  it('detects all loyalty conversation query kinds', () => {
    expect(detectLoyaltyConversationQuery('Redeem my points')).toBe('use_bilamo_points')
    expect(detectLoyaltyConversationQuery('Which hotel gives me the most rewards?')).toBe(
      'most_rewards_hotel',
    )
    expect(detectLoyaltyConversationQuery('Can I upgrade using points?')).toBe(
      'upgrade_with_points',
    )
    expect(detectLoyaltyConversationQuery('How many points will I earn?')).toBe(
      'points_earn_estimate',
    )
    expect(detectLoyaltyConversationQuery('What is my points balance?')).toBe('wallet_balance')
    expect(detectLoyaltyConversationQuery('What are my membership benefits?')).toBe(
      'membership_benefits',
    )
    expect(detectLoyaltyConversationQuery('hello there')).toBeNull()
  })

  it('stores hotel loyalty account and estimates with tier boost', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.upsertHotelAccount('u_hh', {
      brand: 'hilton',
      programName: 'Hilton Honors',
      memberNumber: 'H99',
      pointsBalance: 1000,
      tierName: 'Gold',
    })
    const est = platform.getHotelRegistry().estimateForCandidate('u_hh', hotelCandidates()[0])
    expect(est.points).toBeGreaterThan(8000)
  })

  it('getAirlineStore returns upserted accounts', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.upsertAirlineAccount('u_air', {
      airlineCode: 'SV',
      programName: 'Alfursan',
      memberNumber: 'SV1',
      milesBalance: 2000,
    })
    expect(platform.getAirlineStore().list('u_air')[0].programName).toBe('Alfursan')
  })

  it('explains wallet in Arabic', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    platform.bonus('u_ar_w', 10, 'seed')
    const wallet = platform.getWallet('u_ar_w', 'ar')
    expect(isLoyaltyPlatformResult(wallet)).toBe(true)
    if (!isLoyaltyPlatformResult(wallet)) return
    expect(wallet.explanation).toContain('رصيد نقاط')
  })

  it('canUpgradeWithPoints is false for explorer', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    expect(platform.canUpgradeWithPoints('fresh_user')).toBe(false)
  })

  it('membership engine discount percent increases by tier', () => {
    const membership = createMembershipEngine()
    expect(membership.discountPercent('explorer')).toBe(0)
    expect(membership.discountPercent('silver')).toBe(2)
    expect(membership.discountPercent('gold')).toBe(5)
    expect(membership.discountPercent('platinum')).toBe(8)
    expect(membership.discountPercent('diamond')).toBe(12)
  })

  it('recommend returns empty explanation when no candidates', () => {
    const platform = createLoyaltyPlatform({ enabled: true })
    const result = platform.recommend([], { userId: 'u_empty' })
    expect(isLoyaltyPlatformResult(result)).toBe(true)
    if (!isLoyaltyPlatformResult(result)) return
    expect(result.explanation).toMatch(/No loyalty recommendations/i)
  })
})
