/**
 * Sprint 38 — Natural-language loyalty explanations.
 */

import type {
  PointsWalletSnapshot,
  ScoredLoyaltyRecommendation,
  MembershipTier,
} from './types'

export class LoyaltyExplainer {
  explainWallet(wallet: PointsWalletSnapshot, locale: 'en' | 'ar' = 'en'): string {
    if (locale === 'ar') {
      return [
        `رصيد نقاط رحّال: ${wallet.balance}.`,
        `النقاط المعلّقة: ${wallet.pendingPoints}.`,
        `مستوى العضوية: ${wallet.membershipTier}.`,
      ].join('\n')
    }
    return [
      `Your Rahhal Points balance is ${wallet.balance}.`,
      `Pending points: ${wallet.pendingPoints}.`,
      `Membership tier: ${capitalize(wallet.membershipTier)}.`,
      wallet.expirations[0]
        ? `Next expiration: ${wallet.expirations[0].points} pts on ${wallet.expirations[0].expiresAt.slice(0, 10)}.`
        : null,
    ]
      .filter(Boolean)
      .join('\n')
  }

  explainEarn(points: number, serviceKind: string, tier: MembershipTier, locale: 'en' | 'ar' = 'en'): string {
    if (locale === 'ar') {
      return `ستكسب حوالي ${points} نقطة رحّال على هذا الـ ${serviceKind} (مستوى ${tier}).`
    }
    return `You will earn about ${points} Rahhal Points on this ${serviceKind} booking as a ${capitalize(tier)} member.`
  }

  explainRedeem(points: number, balanceAfter: number, locale: 'en' | 'ar' = 'en'): string {
    if (locale === 'ar') {
      return `تم استخدام ${points} نقطة. الرصيد المتبقي: ${balanceAfter}.`
    }
    return `I will use ${points} Rahhal Points. Remaining balance: ${balanceAfter}.`
  }

  explainRecommendation(
    top: ScoredLoyaltyRecommendation,
    locale: 'en' | 'ar' = 'en',
  ): string {
    if (locale === 'ar') {
      return [
        `الأفضل للمكافآت: ${top.candidate.title}.`,
        `التكلفة الصافية: ${top.netCashCost} ${top.candidate.currency}.`,
        `النقاط المتوقعة: ${top.pointsEarned}.`,
      ].join('\n')
    }
    return [
      `Best rewards pick: ${top.candidate.title}.`,
      `Net cost ${top.netCashCost} ${top.candidate.currency}.`,
      `Estimated Rahhal Points: ${top.pointsEarned}.`,
      top.pointsRedeemed > 0 ? `Points applied: ${top.pointsRedeemed}.` : null,
      ...top.reasons.slice(0, 2),
    ]
      .filter(Boolean)
      .join('\n')
  }

  explainUpgrade(tier: MembershipTier, eligible: boolean, locale: 'en' | 'ar' = 'en'): string {
    if (locale === 'ar') {
      return eligible
        ? `نعم، مستوى ${tier} يتيح محاولة ترقية باستخدام النقاط/المزايا.`
        : `الترقية بالنقاط غير متاحة لمستوى ${tier} حالياً.`
    }
    return eligible
      ? `Yes — as ${capitalize(tier)}, you can request an upgrade using points and membership benefits.`
      : `Upgrades with points are not available at the ${capitalize(tier)} tier yet. Keep earning to unlock free upgrades.`
  }
}

export function createLoyaltyExplainer(): LoyaltyExplainer {
  return new LoyaltyExplainer()
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
