/**
 * Loyalty Platform Foundation facade — builds architecture blueprints only.
 * Never calculates rewards, processes payments, or calls LLMs.
 */

import { listLoyaltyRegistry } from './registry'
import { isBrainLoyaltyFoundationEnabled } from './registry'
import {
  buildBadges,
  buildCampaignDecision,
  buildCampaignRegistry,
  buildCoupons,
  buildGamificationStrategy,
  buildLoyaltyAccount,
  buildLoyaltyAnalytics,
  buildLoyaltyAuditTrail,
  buildLoyaltyInsights,
  buildLoyaltyWallet,
  buildMembershipLevels,
  buildMembershipStatus,
  buildMilestones,
  buildOfferPersonalization,
  buildPartnerRewards,
  buildPointExpirationStrategy,
  buildPointLedger,
  buildPromoRegistry,
  buildReferralProgram,
  buildReferralRewards,
  buildRewardCatalog,
  buildRewardEligibility,
  buildRewardHistory,
  buildRewardPoints,
  buildRewardRecommendation,
  buildRewardRedemption,
  buildRewardTimeline,
  buildTravelAchievements,
  buildTravelCredits,
  buildVoucherRegistry,
} from './pipelines'
import type { LoyaltyLocale, LoyaltyPlatformBlueprint } from './types'
import { LOYALTY_PLATFORM_ISOLATION, LOYALTY_SECTION_IDS } from './types'

export interface BuildLoyaltyBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: LoyaltyLocale
}

export function buildLoyaltyPlatformBlueprint(
  options: BuildLoyaltyBlueprintOptions = {},
): LoyaltyPlatformBlueprint {
  const sessionId = options.sessionId ?? 'loyalty-session-architecture'

  return {
    version: '7.2.0-loyalty-platform',
    featureId: 'brain.loyalty_foundation',
    architectureOnly: true,
    account: buildLoyaltyAccount(),
    membershipLevels: buildMembershipLevels(),
    membershipStatus: buildMembershipStatus(),
    rewardPoints: buildRewardPoints(),
    pointLedger: buildPointLedger(),
    pointExpiration: buildPointExpirationStrategy(),
    rewardCatalog: buildRewardCatalog(),
    rewardRedemption: buildRewardRedemption(),
    travelAchievements: buildTravelAchievements(),
    badges: buildBadges(),
    milestones: buildMilestones(),
    referralProgram: buildReferralProgram(),
    referralRewards: buildReferralRewards(),
    partnerRewards: buildPartnerRewards(),
    travelCredits: buildTravelCredits(),
    coupons: buildCoupons(),
    promoRegistry: buildPromoRegistry(),
    voucherRegistry: buildVoucherRegistry(),
    campaignRegistry: buildCampaignRegistry(),
    loyaltyWallet: buildLoyaltyWallet(),
    rewardHistory: buildRewardHistory(),
    rewardTimeline: buildRewardTimeline(),
    auditTrail: buildLoyaltyAuditTrail(),
    analytics: buildLoyaltyAnalytics(sessionId, LOYALTY_SECTION_IDS.length),
    insights: buildLoyaltyInsights(),
    rewardRecommendation: buildRewardRecommendation(),
    offerPersonalization: buildOfferPersonalization(),
    rewardEligibility: buildRewardEligibility(),
    campaignDecision: buildCampaignDecision(),
    gamificationStrategy: buildGamificationStrategy(),
    registry: listLoyaltyRegistry(),
  }
}

export function tryBuildLoyaltyPlatformBlueprint(
  options: BuildLoyaltyBlueprintOptions = {},
): LoyaltyPlatformBlueprint | null {
  if (!isBrainLoyaltyFoundationEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildLoyaltyPlatformBlueprint(options)
}

export function assertLoyaltyPlatformIsolation(): typeof LOYALTY_PLATFORM_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...LOYALTY_PLATFORM_ISOLATION,
    architectureOnly: true,
    registrySize: listLoyaltyRegistry().length,
  }
}

export const LoyaltyPlatformFoundation = {
  buildBlueprint: buildLoyaltyPlatformBlueprint,
  tryBuildBlueprint: tryBuildLoyaltyPlatformBlueprint,
  assertIsolation: assertLoyaltyPlatformIsolation,
}
