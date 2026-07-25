/**
 * Phase 7 Stage 2 — Loyalty Platform Foundation contracts.
 * Architecture / interfaces / types / blueprints only.
 * No database, auth, payments, reward calculation, Runtime, HTTP, or APIs.
 */

export type LoyaltyLocale = 'ar' | 'en'

export type MembershipLevelId =
  | 'explorer'
  | 'voyager'
  | 'navigator'
  | 'ambassador'
  | 'legacy_placeholder'

export type MembershipStatusId =
  | 'inactive'
  | 'pending'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'closed'

export type LoyaltyTimelineEventKind =
  | 'account_opened'
  | 'points_hinted'
  | 'reward_catalogued'
  | 'achievement_hinted'
  | 'referral_registered'
  | 'campaign_registered'
  | 'redemption_hinted'
  | 'audit_appended'
  | 'status_changed'

export type LoyaltySectionId =
  | 'loyalty_account'
  | 'membership_levels'
  | 'membership_status'
  | 'reward_points'
  | 'point_ledger'
  | 'point_expiration'
  | 'reward_catalog'
  | 'reward_redemption'
  | 'travel_achievements'
  | 'badges'
  | 'milestones'
  | 'referral_program'
  | 'referral_rewards'
  | 'partner_rewards'
  | 'travel_credits'
  | 'coupons'
  | 'promo_registry'
  | 'voucher_registry'
  | 'campaign_registry'
  | 'loyalty_wallet'
  | 'reward_history'
  | 'reward_timeline'
  | 'loyalty_audit'
  | 'loyalty_analytics'
  | 'loyalty_insights'
  | 'ai_reward_recommendation'
  | 'ai_offer_personalization'
  | 'ai_reward_eligibility'
  | 'ai_campaign_decision'
  | 'ai_gamification_strategy'

export interface LoyaltyAccountContract {
  kind: 'loyalty_account'
  version: '7.2.0-loyalty-platform'
  accountId: string
  execution: 'none'
}

export interface MembershipLevelsContract {
  kind: 'membership_levels'
  levels: readonly MembershipLevelId[]
  execution: 'none'
}

export interface MembershipStatusContract {
  kind: 'membership_status'
  status: MembershipStatusId
  levelHint: MembershipLevelId
  execution: 'none'
}

export interface RewardPointsContract {
  kind: 'reward_points'
  balanceHint: number
  calculated: false
  execution: 'none'
}

export interface PointLedgerEntry {
  id: string
  direction: 'credit_hint' | 'debit_hint'
  amountHint: number
  reasonHint: string
}

export interface PointLedgerContract {
  kind: 'point_ledger'
  entries: readonly PointLedgerEntry[]
  persisted: false
  execution: 'none'
}

export interface PointExpirationStrategyContract {
  kind: 'point_expiration_strategy'
  policyHint: string
  execution: 'none'
}

export interface RewardCatalogEntry {
  id: string
  label: string
  categoryHint: string
  availableHint: false
}

export interface RewardCatalogContract {
  kind: 'reward_catalog'
  entries: readonly RewardCatalogEntry[]
  execution: 'none'
}

export interface RewardRedemptionContract {
  kind: 'reward_redemption'
  redemptionIds: readonly string[]
  executed: false
  execution: 'none'
}

export interface TravelAchievementsContract {
  kind: 'travel_achievements'
  achievementHints: readonly string[]
  execution: 'none'
}

export interface BadgesContract {
  kind: 'badges'
  badgeHints: readonly string[]
  execution: 'none'
}

export interface MilestonesContract {
  kind: 'milestones'
  milestoneHints: readonly string[]
  execution: 'none'
}

export interface ReferralProgramContract {
  kind: 'referral_program'
  programId: string
  activeHint: false
  execution: 'none'
}

export interface ReferralRewardsContract {
  kind: 'referral_rewards'
  rewardHints: readonly string[]
  execution: 'none'
}

export interface PartnerRewardsContract {
  kind: 'partner_rewards'
  partnerHints: readonly string[]
  execution: 'none'
}

export interface TravelCreditsContract {
  kind: 'travel_credits'
  balanceHint: number
  currencyHint: string
  calculated: false
  execution: 'none'
}

export interface CouponsContract {
  kind: 'coupons'
  couponHints: readonly string[]
  logic: false
  execution: 'none'
}

export interface PromoRegistryEntry {
  id: string
  promoKey: string
  enabledHint: false
}

export interface PromoRegistryContract {
  kind: 'promo_registry'
  entries: readonly PromoRegistryEntry[]
  execution: 'none'
}

export interface VoucherRegistryEntry {
  id: string
  voucherKey: string
  enabledHint: false
}

export interface VoucherRegistryContract {
  kind: 'voucher_registry'
  entries: readonly VoucherRegistryEntry[]
  execution: 'none'
}

export interface CampaignRegistryEntry {
  id: string
  campaignKey: string
  enabledHint: false
}

export interface CampaignRegistryContract {
  kind: 'campaign_registry'
  entries: readonly CampaignRegistryEntry[]
  execution: 'none'
}

export interface LoyaltyWalletContract {
  kind: 'loyalty_wallet'
  walletId: string
  instruments: readonly string[]
  execution: 'none'
}

export interface RewardHistoryContract {
  kind: 'reward_history'
  historyHints: readonly string[]
  persisted: false
  execution: 'none'
}

export interface RewardTimelineEvent {
  eventId: string
  eventKind: LoyaltyTimelineEventKind
  atIso: string
  summary: string
}

export interface RewardTimelineContract {
  kind: 'reward_timeline'
  events: readonly RewardTimelineEvent[]
  execution: 'none'
}

export interface LoyaltyAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface LoyaltyAuditTrailContract {
  kind: 'loyalty_audit_trail'
  entries: readonly LoyaltyAuditEntry[]
  persisted: false
}

export interface LoyaltyAnalyticsContract {
  kind: 'loyalty_analytics'
  sessionId: string
  sectionCount: number
  exported: false
}

export interface LoyaltyInsightsContract {
  kind: 'loyalty_insights'
  insightHints: readonly string[]
  execution: 'none'
}

/** AI loyalty capability contracts — blueprints only. */
export interface RewardRecommendationContract {
  kind: 'reward_recommendation_contract'
  recommendationKeys: readonly string[]
  execution: 'none'
}

export interface OfferPersonalizationContract {
  kind: 'offer_personalization_contract'
  offerKeys: readonly string[]
  execution: 'none'
}

export interface RewardEligibilityContract {
  kind: 'reward_eligibility_contract'
  eligibilityRules: readonly string[]
  execution: 'none'
}

export interface CampaignDecisionContract {
  kind: 'campaign_decision_contract'
  decisionHints: readonly string[]
  execution: 'none'
}

export interface GamificationStrategyContract {
  kind: 'gamification_strategy_contract'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface LoyaltyRegistryEntry {
  id: string
  sectionId: LoyaltySectionId
  label: string
  enabledHint: false
}

export interface LoyaltyPlatformBlueprint {
  version: '7.2.0-loyalty-platform'
  featureId: 'brain.loyalty_foundation'
  architectureOnly: true
  account: LoyaltyAccountContract
  membershipLevels: MembershipLevelsContract
  membershipStatus: MembershipStatusContract
  rewardPoints: RewardPointsContract
  pointLedger: PointLedgerContract
  pointExpiration: PointExpirationStrategyContract
  rewardCatalog: RewardCatalogContract
  rewardRedemption: RewardRedemptionContract
  travelAchievements: TravelAchievementsContract
  badges: BadgesContract
  milestones: MilestonesContract
  referralProgram: ReferralProgramContract
  referralRewards: ReferralRewardsContract
  partnerRewards: PartnerRewardsContract
  travelCredits: TravelCreditsContract
  coupons: CouponsContract
  promoRegistry: PromoRegistryContract
  voucherRegistry: VoucherRegistryContract
  campaignRegistry: CampaignRegistryContract
  loyaltyWallet: LoyaltyWalletContract
  rewardHistory: RewardHistoryContract
  rewardTimeline: RewardTimelineContract
  auditTrail: LoyaltyAuditTrailContract
  analytics: LoyaltyAnalyticsContract
  insights: LoyaltyInsightsContract
  rewardRecommendation: RewardRecommendationContract
  offerPersonalization: OfferPersonalizationContract
  rewardEligibility: RewardEligibilityContract
  campaignDecision: CampaignDecisionContract
  gamificationStrategy: GamificationStrategyContract
  registry: readonly LoyaltyRegistryEntry[]
}

export const LOYALTY_PLATFORM_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoDatabase: false,
  wiredIntoAuthentication: false,
  wiredIntoPayments: false,
  couponsLogic: false,
  rewardCalculation: false,
  httpRequests: false,
  streamingImplemented: false,
  wiredIntoRuntime: false,
  wiredIntoApis: false,
  wiredIntoLlms: false,
  businessLogic: false,
  distinctFromSprint38LoyaltyPlatform: true,
} as const

export const MEMBERSHIP_LEVELS: readonly MembershipLevelId[] = [
  'explorer',
  'voyager',
  'navigator',
  'ambassador',
  'legacy_placeholder',
] as const

export const MEMBERSHIP_STATUS_IDS: readonly MembershipStatusId[] = [
  'inactive',
  'pending',
  'active',
  'suspended',
  'expired',
  'closed',
] as const

export const LOYALTY_SECTION_IDS: readonly LoyaltySectionId[] = [
  'loyalty_account',
  'membership_levels',
  'membership_status',
  'reward_points',
  'point_ledger',
  'point_expiration',
  'reward_catalog',
  'reward_redemption',
  'travel_achievements',
  'badges',
  'milestones',
  'referral_program',
  'referral_rewards',
  'partner_rewards',
  'travel_credits',
  'coupons',
  'promo_registry',
  'voucher_registry',
  'campaign_registry',
  'loyalty_wallet',
  'reward_history',
  'reward_timeline',
  'loyalty_audit',
  'loyalty_analytics',
  'loyalty_insights',
  'ai_reward_recommendation',
  'ai_offer_personalization',
  'ai_reward_eligibility',
  'ai_campaign_decision',
  'ai_gamification_strategy',
] as const
