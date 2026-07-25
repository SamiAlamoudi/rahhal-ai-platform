/**
 * Loyalty platform foundation contracts — pure builders, no calculations.
 */

import type {
  BadgesContract,
  CampaignDecisionContract,
  CampaignRegistryContract,
  CouponsContract,
  GamificationStrategyContract,
  LoyaltyAccountContract,
  LoyaltyAnalyticsContract,
  LoyaltyAuditTrailContract,
  LoyaltyInsightsContract,
  LoyaltyWalletContract,
  MembershipLevelsContract,
  MembershipStatusContract,
  MilestonesContract,
  OfferPersonalizationContract,
  PartnerRewardsContract,
  PointExpirationStrategyContract,
  PointLedgerContract,
  PromoRegistryContract,
  ReferralProgramContract,
  ReferralRewardsContract,
  RewardCatalogContract,
  RewardEligibilityContract,
  RewardHistoryContract,
  RewardPointsContract,
  RewardRecommendationContract,
  RewardRedemptionContract,
  RewardTimelineContract,
  TravelAchievementsContract,
  TravelCreditsContract,
  VoucherRegistryContract,
} from './types'
import { MEMBERSHIP_LEVELS } from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildLoyaltyAccount(
  accountId = 'loyalty-account-architecture',
): LoyaltyAccountContract {
  return {
    kind: 'loyalty_account',
    version: '7.2.0-loyalty-platform',
    accountId,
    execution: 'none',
  }
}

export function buildMembershipLevels(): MembershipLevelsContract {
  return {
    kind: 'membership_levels',
    levels: MEMBERSHIP_LEVELS,
    execution: 'none',
  }
}

export function buildMembershipStatus(): MembershipStatusContract {
  return {
    kind: 'membership_status',
    status: 'inactive',
    levelHint: 'explorer',
    execution: 'none',
  }
}

export function buildRewardPoints(): RewardPointsContract {
  return {
    kind: 'reward_points',
    balanceHint: 0,
    calculated: false,
    execution: 'none',
  }
}

export function buildPointLedger(): PointLedgerContract {
  return {
    kind: 'point_ledger',
    entries: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildPointExpirationStrategy(): PointExpirationStrategyContract {
  return {
    kind: 'point_expiration_strategy',
    policyHint: 'none_architecture',
    execution: 'none',
  }
}

export function buildRewardCatalog(): RewardCatalogContract {
  return {
    kind: 'reward_catalog',
    entries: [
      {
        id: 'rcat-placeholder',
        label: 'architecture_placeholder',
        categoryHint: 'general',
        availableHint: false,
      },
    ],
    execution: 'none',
  }
}

export function buildRewardRedemption(): RewardRedemptionContract {
  return {
    kind: 'reward_redemption',
    redemptionIds: [],
    executed: false,
    execution: 'none',
  }
}

export function buildTravelAchievements(): TravelAchievementsContract {
  return {
    kind: 'travel_achievements',
    achievementHints: [],
    execution: 'none',
  }
}

export function buildBadges(): BadgesContract {
  return {
    kind: 'badges',
    badgeHints: [],
    execution: 'none',
  }
}

export function buildMilestones(): MilestonesContract {
  return {
    kind: 'milestones',
    milestoneHints: [],
    execution: 'none',
  }
}

export function buildReferralProgram(): ReferralProgramContract {
  return {
    kind: 'referral_program',
    programId: 'referral-architecture',
    activeHint: false,
    execution: 'none',
  }
}

export function buildReferralRewards(): ReferralRewardsContract {
  return {
    kind: 'referral_rewards',
    rewardHints: [],
    execution: 'none',
  }
}

export function buildPartnerRewards(): PartnerRewardsContract {
  return {
    kind: 'partner_rewards',
    partnerHints: [],
    execution: 'none',
  }
}

export function buildTravelCredits(): TravelCreditsContract {
  return {
    kind: 'travel_credits',
    balanceHint: 0,
    currencyHint: 'SAR',
    calculated: false,
    execution: 'none',
  }
}

export function buildCoupons(): CouponsContract {
  return {
    kind: 'coupons',
    couponHints: [],
    logic: false,
    execution: 'none',
  }
}

export function buildPromoRegistry(): PromoRegistryContract {
  return {
    kind: 'promo_registry',
    entries: [
      {
        id: 'promo-architecture',
        promoKey: 'architecture_placeholder',
        enabledHint: false,
      },
    ],
    execution: 'none',
  }
}

export function buildVoucherRegistry(): VoucherRegistryContract {
  return {
    kind: 'voucher_registry',
    entries: [
      {
        id: 'voucher-architecture',
        voucherKey: 'architecture_placeholder',
        enabledHint: false,
      },
    ],
    execution: 'none',
  }
}

export function buildCampaignRegistry(): CampaignRegistryContract {
  return {
    kind: 'campaign_registry',
    entries: [
      {
        id: 'campaign-architecture',
        campaignKey: 'architecture_placeholder',
        enabledHint: false,
      },
    ],
    execution: 'none',
  }
}

export function buildLoyaltyWallet(): LoyaltyWalletContract {
  return {
    kind: 'loyalty_wallet',
    walletId: 'wallet-architecture',
    instruments: ['points_hint', 'credits_hint'],
    execution: 'none',
  }
}

export function buildRewardHistory(): RewardHistoryContract {
  return {
    kind: 'reward_history',
    historyHints: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildRewardTimeline(): RewardTimelineContract {
  return {
    kind: 'reward_timeline',
    events: [
      {
        eventId: 'ltl-opened',
        eventKind: 'account_opened',
        atIso: ISO,
        summary: 'architecture blueprint',
      },
    ],
    execution: 'none',
  }
}

export function buildLoyaltyAuditTrail(): LoyaltyAuditTrailContract {
  return {
    kind: 'loyalty_audit_trail',
    entries: [
      {
        id: 'laudit-open',
        atIso: ISO,
        action: 'account_opened',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}

export function buildLoyaltyAnalytics(
  sessionId: string,
  sectionCount: number,
): LoyaltyAnalyticsContract {
  return {
    kind: 'loyalty_analytics',
    sessionId,
    sectionCount,
    exported: false,
  }
}

export function buildLoyaltyInsights(): LoyaltyInsightsContract {
  return {
    kind: 'loyalty_insights',
    insightHints: [],
    execution: 'none',
  }
}

export function buildRewardRecommendation(): RewardRecommendationContract {
  return {
    kind: 'reward_recommendation_contract',
    recommendationKeys: [],
    execution: 'none',
  }
}

export function buildOfferPersonalization(): OfferPersonalizationContract {
  return {
    kind: 'offer_personalization_contract',
    offerKeys: [],
    execution: 'none',
  }
}

export function buildRewardEligibility(): RewardEligibilityContract {
  return {
    kind: 'reward_eligibility_contract',
    eligibilityRules: ['deny_by_default_architecture'],
    execution: 'none',
  }
}

export function buildCampaignDecision(): CampaignDecisionContract {
  return {
    kind: 'campaign_decision_contract',
    decisionHints: [],
    execution: 'none',
  }
}

export function buildGamificationStrategy(): GamificationStrategyContract {
  return {
    kind: 'gamification_strategy_contract',
    strategyHints: ['badges_hint', 'milestones_hint', 'achievements_hint'],
    execution: 'none',
  }
}
