/**
 * Sprint 40 — Conversation helpers for supplier marketplace preferences.
 */

import { isSupplierMarketplaceEnabled } from '../SupplierFeatureFlags'
import type { SupplierMarketplace } from '../SupplierMarketplace'
import { isSupplierMarketplaceResult } from '../SupplierMarketplace'
import type { SupplierRankingContext, SupplierType } from '../types'
import { createSupplierExplainer } from '../SupplierExplainer'

export type SupplierConversationQueryKind =
  | 'trusted_suppliers_only'
  | 'premium_hotel_providers'
  | 'avoid_poor_refunds'
  | 'fastest_confirmation'
  | 'rank_suppliers'

export function detectSupplierConversationQuery(
  userText: string,
): SupplierConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (
    /trusted suppliers?|book only trusted|only trusted/.test(lower)
    || /موردين موثوقين|الموردين الموثوقين/.test(lower)
  ) {
    return 'trusted_suppliers_only'
  }
  if (
    /premium hotel|premium providers?|use premium/.test(lower)
    || /فنادق مميزة|مزودين مميزين/.test(lower)
  ) {
    return 'premium_hotel_providers'
  }
  if (
    /poor refund|avoid suppliers with poor refund|bad refund/.test(lower)
    || /استرداد ضعيف|تجنب.*استرداد/.test(lower)
  ) {
    return 'avoid_poor_refunds'
  }
  if (
    /fastest confirmation|fast confirmation|quick confirmation/.test(lower)
    || /أسرع تأكيد|تأكيد سريع/.test(lower)
  ) {
    return 'fastest_confirmation'
  }
  if (
    /rank suppliers|best suppliers|which supplier/.test(lower)
    || /أفضل مورد/.test(lower)
  ) {
    return 'rank_suppliers'
  }
  return null
}

export function answerSupplierQuery(input: {
  kind: SupplierConversationQueryKind
  marketplace: SupplierMarketplace
  locale?: 'en' | 'ar'
  preferredTypes?: SupplierType[]
}): string {
  const locale = input.locale ?? 'en'
  const explainer = createSupplierExplainer()
  ensureDemoCatalog(input.marketplace)

  const context: SupplierRankingContext = {
    conversationNotes: [`kind:${input.kind}`],
    travelerPreferences: [],
  }

  switch (input.kind) {
    case 'trusted_suppliers_only':
      context.requireTrusted = true
      break
    case 'premium_hotel_providers':
      context.preferPremium = true
      context.preferredTypes = input.preferredTypes ?? ['hotel']
      break
    case 'avoid_poor_refunds':
      context.avoidPoorRefundHistory = true
      break
    case 'fastest_confirmation':
      context.preferFastConfirmation = true
      break
    case 'rank_suppliers':
      break
  }

  const ranked = input.marketplace.rankSuppliers(context, locale)
  if (!isSupplierMarketplaceResult(ranked)) return ranked.message

  const preface =
    input.kind === 'trusted_suppliers_only'
      ? explainer.explainTrustedOnly(locale)
      : input.kind === 'premium_hotel_providers'
        ? explainer.explainPremiumHotels(locale)
        : input.kind === 'avoid_poor_refunds'
          ? explainer.explainAvoidPoorRefunds(locale)
          : input.kind === 'fastest_confirmation'
            ? explainer.explainFastConfirmation(locale)
            : 'Here are the best matching suppliers.'

  return `${preface}\n${ranked.explanation}`
}

export function shouldHandleSupplierQueries(options?: {
  supplierMarketplaceEnabled?: boolean
}): boolean {
  return isSupplierMarketplaceEnabled(options)
}

function ensureDemoCatalog(marketplace: SupplierMarketplace): void {
  if (marketplace.getOnboarding().listApproved().length === 0) {
    marketplace.seedDemoCatalog()
  }
}
