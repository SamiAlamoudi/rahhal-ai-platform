/**
 * Sprint 41 — Revenue breakdown across commissions, markups, promos, wallets, taxes.
 */

import type { CommissionEngine } from './CommissionEngine'
import type { CorporatePricing } from './CorporatePricing'
import type { MarkupEngine } from './MarkupEngine'
import type { ProfitCalculator } from './ProfitCalculator'
import type { PromotionEngine } from './PromotionEngine'
import type { TaxEngine } from './TaxEngine'
import type { RevenueBreakdown, RevenueLineInput } from './types'

export class RevenueEngine {
  private readonly commission: CommissionEngine
  private readonly markup: MarkupEngine
  private readonly promotion: PromotionEngine
  private readonly tax: TaxEngine
  private readonly corporate: CorporatePricing
  private readonly profit: ProfitCalculator
  private readonly history: RevenueBreakdown[] = []

  constructor(input: {
    commission: CommissionEngine
    markup: MarkupEngine
    promotion: PromotionEngine
    tax: TaxEngine
    corporate: CorporatePricing
    profit: ProfitCalculator
  }) {
    this.commission = input.commission
    this.markup = input.markup
    this.promotion = input.promotion
    this.tax = input.tax
    this.corporate = input.corporate
    this.profit = input.profit
  }

  recognize(input: RevenueLineInput): RevenueBreakdown {
    const channelDiscount = this.corporate.discountPercent(input.channel)
    const corporateDiscount = round2(
      input.baseFare * ((input.corporateDiscountPercent ?? channelDiscount) / 100),
    )
    const pricedBase = round2(
      input.baseFare * this.corporate.countryMultiplier(input.country) - corporateDiscount,
    )

    const supplierCommission = this.commission.supplierCommission(
      pricedBase,
      input.supplierCommissionPercent ?? 10,
    )
    const rahhalMarkup = this.markup.rahhalMarkup(
      pricedBase,
      input.rahhalMarkupPercent ?? 8,
      input.channel,
    )
    const couponDiscount = this.promotion.couponDiscount(pricedBase + rahhalMarkup, input.couponDiscount ?? 0)
    const promoDiscount = this.promotion.promoPercentDiscount(
      pricedBase + rahhalMarkup,
      input.promoDiscountPercent ?? 0,
    )
    const cashback = this.promotion.cashback(pricedBase, input.cashbackAmount ?? 0)
    const rewardRedemptionValue = this.promotion.rewardPointsValue(input.rewardPointsRedeemed ?? 0)
    const walletUsed = round2(Math.max(0, input.walletAmountUsed ?? 0))
    const serviceFee = round2(input.serviceFee ?? 25)
    const otherFees = round2(input.otherFees ?? 0)

    const taxableBase = Math.max(
      0,
      pricedBase + rahhalMarkup + serviceFee + otherFees - couponDiscount - promoDiscount - rewardRedemptionValue,
    )
    const taxResult = this.tax.calculate(taxableBase, input.taxCountry ?? input.country)
    const customerTotalBeforeWallet = round2(taxableBase + taxResult.tax)
    const walletApplied = Math.min(walletUsed, customerTotalBeforeWallet)
    const customerTotal = round2(customerTotalBeforeWallet - walletApplied)
    const partialPayment = round2(Math.min(customerTotal, input.partialPaymentAmount ?? customerTotal))

    const agencyCommission = this.commission.agencyCommission(
      customerTotal,
      input.agencyCommissionPercent ?? 0,
    )
    const rahhalRevenue = round2(rahhalMarkup + serviceFee + otherFees)
    const affiliateCommission = this.commission.affiliateCommission(
      rahhalRevenue,
      input.affiliateCommissionPercent ?? 0,
    )
    const rahhalProfit = this.profit.profit({
      rahhalMarkup,
      serviceFee,
      otherFees,
      agencyCommission,
      affiliateCommission,
      cashback,
    })
    const marginPercent = this.profit.marginPercent(rahhalProfit, Math.max(1, rahhalRevenue))

    const breakdown: RevenueBreakdown = {
      bookingId: input.bookingId,
      supplierId: input.supplierId,
      serviceKind: input.serviceKind,
      channel: input.channel,
      destination: input.destination ?? null,
      country: input.country ?? null,
      customerId: input.customerId ?? null,
      currency: input.currency,
      recognizedAt: new Date().toISOString(),
      baseFare: round2(input.baseFare),
      supplierCommission,
      rahhalMarkup,
      agencyCommission,
      affiliateCommission,
      corporateDiscount,
      couponDiscount,
      promoDiscount,
      cashback,
      rewardRedemptionValue,
      walletUsed: walletApplied,
      partialPayment,
      serviceFee,
      otherFees,
      tax: taxResult.tax,
      taxKind: taxResult.kind,
      customerTotal,
      rahhalRevenue,
      rahhalProfit,
      marginPercent,
    }
    this.history.push(breakdown)
    return { ...breakdown }
  }

  list(): RevenueBreakdown[] {
    return this.history.map((h) => ({ ...h }))
  }

  /** Alias used by analytics/reports. */
  historyRows(): RevenueBreakdown[] {
    return this.list()
  }

  totalRevenue(currency = 'SAR'): number {
    return round2(
      this.history.filter((h) => h.currency === currency).reduce((s, h) => s + h.rahhalRevenue, 0),
    )
  }

  totalProfit(currency = 'SAR'): number {
    return round2(
      this.history.filter((h) => h.currency === currency).reduce((s, h) => s + h.rahhalProfit, 0),
    )
  }
}

export function createRevenueEngine(input: {
  commission: CommissionEngine
  markup: MarkupEngine
  promotion: PromotionEngine
  tax: TaxEngine
  corporate: CorporatePricing
  profit: ProfitCalculator
}): RevenueEngine {
  return new RevenueEngine(input)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
