/**
 * Sprint 38 — Universal Loyalty, Rewards & Membership domain types.
 */

export type LoyaltyServiceKind =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'insurance'
  | 'visa'
  | 'future'

export type MembershipTier = 'explorer' | 'silver' | 'gold' | 'platinum' | 'diamond'

export type BenefitKind =
  | 'priority_support'
  | 'free_upgrades'
  | 'airport_lounge_credits'
  | 'extra_discounts'
  | 'late_checkout'
  | 'free_cancellation_credits'
  | 'bonus_points'
  | 'priority_ai_processing'
  | 'exclusive_offers'

export type WalletLedgerKind =
  | 'earn'
  | 'redeem'
  | 'expire'
  | 'reverse'
  | 'bonus'
  | 'promotion'
  | 'campaign'
  | 'transfer'
  | 'adjustment'

export type HotelLoyaltyBrand =
  | 'hilton'
  | 'marriott'
  | 'ihg'
  | 'accor'
  | 'hyatt'
  | 'best_western'
  | 'generic'

export interface MembershipBenefit {
  kind: BenefitKind
  title: string
  description: string
  value: number
  unit: 'percent' | 'points' | 'credits' | 'boolean'
  enabled: boolean
}

export interface MembershipDefinition {
  tier: MembershipTier
  rank: number
  minLifetimePoints: number
  earnMultiplier: number
  benefits: MembershipBenefit[]
}

export interface PointsLedgerEntry {
  entryId: string
  userId: string
  kind: WalletLedgerKind
  points: number
  balanceAfter: number
  serviceKind?: LoyaltyServiceKind
  providerId?: string
  bookingRef?: string
  campaignId?: string
  promotionId?: string
  expiresAt?: string | null
  note: string
  createdAt: string
  metadata: Record<string, unknown>
}

export interface PointsWalletSnapshot {
  userId: string
  balance: number
  pendingPoints: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  membershipTier: MembershipTier
  history: PointsLedgerEntry[]
  expirations: Array<{ entryId: string; points: number; expiresAt: string }>
  campaignBonuses: Array<{ campaignId: string; points: number; note: string }>
}

export interface AirlineLoyaltyAccount {
  airlineCode: string
  programName: string
  memberNumber: string
  milesBalance: number
  tierName?: string | null
}

export interface HotelLoyaltyAccount {
  brand: HotelLoyaltyBrand
  programName: string
  memberNumber: string
  pointsBalance: number
  tierName?: string | null
}

export interface LoyaltyCandidate {
  candidateId: string
  serviceKind: LoyaltyServiceKind
  providerId: string
  title: string
  price: number
  currency: string
  brandOrAirline?: string | null
  hotelBrand?: HotelLoyaltyBrand | null
  estimatedRahhalPoints: number
  estimatedPartnerMilesOrPoints: number
  statusUpgradeEligible?: boolean
  metadata?: Record<string, unknown>
}

export interface LoyaltyRecommendationContext {
  userId: string
  conversationId?: string | null
  preferredAirlines?: string[]
  preferredHotels?: string[]
  travelerPreferences?: string[]
  previousHistory?: string[]
  conversationNotes?: string[]
  wantToRedeemPoints?: boolean
  redeemPointsAmount?: number
}

export interface ScoredLoyaltyRecommendation {
  candidate: LoyaltyCandidate
  rank: number
  score: number
  factors: Record<string, number>
  reasons: string[]
  explanation: string
  netCashCost: number
  pointsEarned: number
  pointsRedeemed: number
  membershipBenefitsApplied: BenefitKind[]
}

export interface LoyaltyEarnInput {
  userId: string
  amountPaid: number
  currency: string
  serviceKind: LoyaltyServiceKind
  providerId: string
  bookingRef?: string
  campaignId?: string
  promotionId?: string
  bonusPoints?: number
}

export interface LoyaltyRedeemInput {
  userId: string
  points: number
  serviceKind?: LoyaltyServiceKind
  providerId?: string
  bookingRef?: string
  note?: string
}

export interface LoyaltyPlatformResult {
  ok: true
  wallet: PointsWalletSnapshot
  membershipTier: MembershipTier
  benefits: MembershipBenefit[]
  explanation: string
  recommendation?: ScoredLoyaltyRecommendation | null
  recommendations?: ScoredLoyaltyRecommendation[]
}

export interface LoyaltyDisabledResult {
  ok: false
  code: 'FEATURE_DISABLED' | 'INSUFFICIENT_POINTS' | 'NOT_FOUND' | 'INVALID'
  message: string
}
