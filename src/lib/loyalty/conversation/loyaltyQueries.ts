/**
 * Sprint 38 — Conversation helpers for loyalty / rewards / membership.
 */

import { isLoyaltyPlatformEnabled } from '../LoyaltyFeatureFlags'
import type { LoyaltyPlatform } from '../LoyaltyPlatform'
import { isLoyaltyPlatformResult } from '../LoyaltyPlatform'
import type { LoyaltyCandidate, LoyaltyRecommendationContext } from '../types'

export type LoyaltyConversationQueryKind =
  | 'use_rahhal_points'
  | 'most_rewards_hotel'
  | 'upgrade_with_points'
  | 'points_earn_estimate'
  | 'wallet_balance'
  | 'membership_benefits'

export function detectLoyaltyConversationQuery(
  userText: string,
): LoyaltyConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (
    /use (my )?(rahhal )?points|redeem (my )?points|pay with points/.test(lower)
    || /استخدم نقاطي|استخدم نقاط رحّال/.test(lower)
  ) {
    return 'use_rahhal_points'
  }
  if (
    /which hotel (gives|has) (me )?the most rewards|most rewards|best (hotel )?rewards|most (hotel )?points/.test(
      lower,
    )
    || /أكثر مكافآت|أفضل فندق للمكافآت/.test(lower)
  ) {
    return 'most_rewards_hotel'
  }
  if (
    /upgrade using points|upgrade with points|can i upgrade/.test(lower)
    || /ترقية باستخدام النقاط|هل يمكنني الترقية/.test(lower)
  ) {
    return 'upgrade_with_points'
  }
  if (
    /how many points will i earn|points will i earn|earn (if i book|on this)/.test(lower)
    || /كم نقطة سأكسب|س أكسب من النقاط/.test(lower)
  ) {
    return 'points_earn_estimate'
  }
  if (
    /how many (rahhal )?points|my (points )?balance|wallet balance|points balance/.test(lower)
    || /رصيد نقاطي|كم نقطة لدي/.test(lower)
  ) {
    return 'wallet_balance'
  }
  if (
    /membership benefits|my (membership )?tier|what (are )?my benefits/.test(lower)
    || /مزايا العضوية|مستواي/.test(lower)
  ) {
    return 'membership_benefits'
  }
  return null
}

export function answerLoyaltyQuery(input: {
  kind: LoyaltyConversationQueryKind
  platform: LoyaltyPlatform
  userId: string
  locale?: 'en' | 'ar'
  candidates?: LoyaltyCandidate[]
  context?: Partial<LoyaltyRecommendationContext>
  estimateAmount?: number
  estimateService?: 'flight' | 'hotel' | 'car' | 'activity'
  redeemPoints?: number
}): string {
  const locale = input.locale ?? 'en'
  const ctx: LoyaltyRecommendationContext = {
    userId: input.userId,
    conversationNotes: input.context?.conversationNotes,
    preferredAirlines: input.context?.preferredAirlines,
    preferredHotels: input.context?.preferredHotels,
    travelerPreferences: input.context?.travelerPreferences,
    previousHistory: input.context?.previousHistory,
    wantToRedeemPoints: input.kind === 'use_rahhal_points',
    redeemPointsAmount: input.redeemPoints,
  }

  switch (input.kind) {
    case 'wallet_balance':
    case 'membership_benefits': {
      const result = input.platform.getWallet(input.userId, locale)
      if (!isLoyaltyPlatformResult(result)) return result.message
      if (input.kind === 'membership_benefits') {
        return [
          result.explanation,
          ...result.benefits.map((b) => `• ${b.title}: ${b.description}`),
        ].join('\n')
      }
      return result.explanation
    }
    case 'use_rahhal_points': {
      const wallet = input.platform.getWallet(input.userId, locale)
      if (!isLoyaltyPlatformResult(wallet)) return wallet.message
      const points = Math.min(
        wallet.wallet.balance,
        input.redeemPoints ?? Math.max(100, Math.floor(wallet.wallet.balance * 0.25)),
      )
      if (points <= 0) {
        return locale === 'ar'
          ? 'لا توجد نقاط كافية للاستخدام حالياً.'
          : 'You do not have enough Rahhal Points to redeem right now.'
      }
      const redeemed = input.platform.redeem(
        {
          userId: input.userId,
          points,
          note: 'Conversation redeem request',
        },
        locale,
      )
      if (!isLoyaltyPlatformResult(redeemed)) return redeemed.message
      return redeemed.explanation
    }
    case 'most_rewards_hotel': {
      const candidates =
        input.candidates?.filter((c) => c.serviceKind === 'hotel')
        ?? defaultHotelCandidates()
      const result = input.platform.recommend(candidates, ctx, locale)
      if (!isLoyaltyPlatformResult(result)) return result.message
      return result.explanation
    }
    case 'upgrade_with_points':
      return input.platform.explainUpgrade(input.userId, locale)
    case 'points_earn_estimate': {
      const amount = input.estimateAmount ?? 2000
      const service = input.estimateService ?? 'hotel'
      const points = input.platform.estimateEarn(input.userId, amount, service)
      const wallet = input.platform.getWallet(input.userId, locale)
      const tier = isLoyaltyPlatformResult(wallet) ? wallet.membershipTier : 'explorer'
      if (locale === 'ar') {
        return `ستكسب حوالي ${points} نقطة رحّال على حجز ${service} بقيمة ${amount} (مستوى ${tier}).`
      }
      return `You will earn about ${points} Rahhal Points on a ${service} booking of ${amount} as a ${tier} member.`
    }
  }
}

export function shouldHandleLoyaltyQueries(options?: {
  loyaltyPlatformEnabled?: boolean
}): boolean {
  return isLoyaltyPlatformEnabled(options)
}

function defaultHotelCandidates(): LoyaltyCandidate[] {
  return [
    {
      candidateId: 'h_hilton',
      serviceKind: 'hotel',
      providerId: 'hilton',
      title: 'Hilton Garden Inn',
      price: 900,
      currency: 'SAR',
      hotelBrand: 'hilton',
      brandOrAirline: 'Hilton',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
    },
    {
      candidateId: 'h_marriott',
      serviceKind: 'hotel',
      providerId: 'marriott',
      title: 'Marriott Downtown',
      price: 950,
      currency: 'SAR',
      hotelBrand: 'marriott',
      brandOrAirline: 'Marriott',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
    },
    {
      candidateId: 'h_hyatt',
      serviceKind: 'hotel',
      providerId: 'hyatt',
      title: 'Hyatt Regency',
      price: 1100,
      currency: 'SAR',
      hotelBrand: 'hyatt',
      brandOrAirline: 'Hyatt',
      estimatedRahhalPoints: 0,
      estimatedPartnerMilesOrPoints: 0,
    },
  ]
}
