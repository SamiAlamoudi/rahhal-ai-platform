/**
 * Sprint 40 — AI supplier ranking across commercial + performance + conversation factors.
 */

import type { ContractManagement } from './ContractManagement'
import type { InventoryEngine } from './InventoryEngine'
import type { SupplierOnboarding } from './SupplierOnboarding'
import type { SupplierPerformanceEngine } from './SupplierPerformanceEngine'
import type {
  RankedSupplier,
  SupplierRankingContext,
  SupplierRecord,
} from './types'

export class SupplierRankingEngine {
  private readonly onboarding: SupplierOnboarding
  private readonly contracts: ContractManagement
  private readonly performance: SupplierPerformanceEngine
  private readonly inventory: InventoryEngine

  constructor(input: {
    onboarding: SupplierOnboarding
    contracts: ContractManagement
    performance: SupplierPerformanceEngine
    inventory: InventoryEngine
  }) {
    this.onboarding = input.onboarding
    this.contracts = input.contracts
    this.performance = input.performance
    this.inventory = input.inventory
  }

  rank(context: SupplierRankingContext = {}): RankedSupplier[] {
    let suppliers = this.onboarding.listApproved()
    if (context.requireTrusted) suppliers = suppliers.filter((s) => s.trusted)
    if (context.preferPremium) {
      const premium = suppliers.filter((s) => s.premium)
      if (premium.length) suppliers = premium
    }
    if (context.preferredTypes?.length) {
      suppliers = suppliers.filter((s) =>
        context.preferredTypes!.includes(s.registration.supplierType),
      )
    }
    if (context.avoidPoorRefundHistory) {
      suppliers = suppliers.filter((s) => !this.performance.hasPoorRefundHistory(s.supplierId))
    }

    const scored = suppliers.map((supplier) => this.score(supplier, context))
    scored.sort((a, b) => b.score - a.score)
    return scored.map((row, index) => ({
      ...row,
      rank: index + 1,
      explanation: explain(row, index + 1),
    }))
  }

  private score(supplier: SupplierRecord, context: SupplierRankingContext): RankedSupplier {
    const performance = this.performance.get(supplier.supplierId)
    const contract = this.contracts.getActiveContract(supplier.supplierId)
    const inventory = this.inventory.listForSupplier(supplier.supplierId)
    const lowestRate = inventory
      .flatMap((i) => i.ratePlans.map((p) => p.baseRate))
      .sort((a, b) => a - b)[0] ?? 9999

    const priceFactor =
      context.maxPriceHint != null
        ? 1 - Math.min(1, lowestRate / Math.max(1, context.maxPriceHint))
        : 1 - Math.min(1, lowestRate / 5000)
    const qualityFactor = performance.qualityScore
    const historicalFactor = performance.reliabilityScore
    const reliabilityFactor = performance.reliabilityScore
    const refundFactor = clamp01(1 - performance.refundSpeedHours / 168) * (1 - performance.complaintRate)
    const preferenceFactor = preferenceScore(supplier, context)
    const conversationFactor = context.conversationNotes?.length ? 0.9 : 0.7
    const loyaltyFactor = clamp01(context.loyaltyValueWeight ?? 0.7)
    const businessRulesFactor =
      (supplier.trusted ? 0.2 : 0)
      + (supplier.premium ? 0.15 : 0)
      + (contract?.corporateEligible ? 0.1 : 0)
      + (context.preferFastConfirmation && this.performance.isFastConfirmation(supplier.supplierId)
        ? 0.25
        : 0.1)
    const speedFactor = clamp01(1 - performance.confirmationSpeedSeconds / 600)

    const factors = {
      price: clamp01(priceFactor),
      quality: qualityFactor,
      historical_performance: historicalFactor,
      reliability: reliabilityFactor,
      refund_performance: clamp01(refundFactor),
      traveler_preferences: preferenceFactor,
      conversation_context: conversationFactor,
      loyalty_value: loyaltyFactor,
      business_rules: clamp01(businessRulesFactor + speedFactor * 0.3),
    }

    const score = clamp01(
      factors.price * 0.14
        + factors.quality * 0.14
        + factors.historical_performance * 0.12
        + factors.reliability * 0.12
        + factors.refund_performance * 0.12
        + factors.traveler_preferences * 0.1
        + factors.conversation_context * 0.08
        + factors.loyalty_value * 0.08
        + factors.business_rules * 0.1,
    )

    const reasons = [
      supplier.trusted ? 'Trusted supplier' : null,
      supplier.premium ? 'Premium provider' : null,
      performance.qualityScore >= 0.8 ? 'High quality score' : null,
      this.performance.isFastConfirmation(supplier.supplierId)
        ? 'Fast confirmation SLA'
        : null,
      !this.performance.hasPoorRefundHistory(supplier.supplierId)
        ? 'Solid refund history'
        : 'Refund performance needs review',
      preferenceFactor > 0.75 ? 'Matches traveler preferences' : null,
    ].filter(Boolean) as string[]

    return {
      supplier,
      contract,
      performance,
      rank: 0,
      score,
      factors,
      reasons,
      explanation: '',
    }
  }
}

export function createSupplierRankingEngine(input: {
  onboarding: SupplierOnboarding
  contracts: ContractManagement
  performance: SupplierPerformanceEngine
  inventory: InventoryEngine
}): SupplierRankingEngine {
  return new SupplierRankingEngine(input)
}

function preferenceScore(supplier: SupplierRecord, context: SupplierRankingContext): number {
  const prefs = context.travelerPreferences ?? []
  if (!prefs.length) return 0.7
  const hay = `${supplier.registration.tradeName ?? ''} ${supplier.registration.legalName} ${supplier.registration.supplierType}`.toLowerCase()
  return prefs.some((p) => hay.includes(p.toLowerCase())) ? 0.95 : 0.45
}

function explain(row: RankedSupplier, rank: number): string {
  return [
    `Rank #${rank}: ${row.supplier.registration.tradeName ?? row.supplier.registration.legalName}`,
    `Score ${(row.score * 100).toFixed(0)}%`,
    `Quality ${(row.performance.qualityScore * 100).toFixed(0)}%`,
    ...row.reasons.slice(0, 3),
  ].join('. ')
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
