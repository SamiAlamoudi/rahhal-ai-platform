/**
 * Sprint 40 — Natural-language supplier marketplace explanations.
 */

import type { RankedSupplier, SupplierDashboardSnapshot, SupplierRecord } from './types'

export class SupplierExplainer {
  explainRanking(ranked: RankedSupplier[], locale: 'en' | 'ar' = 'en'): string {
    if (!ranked.length) {
      return locale === 'ar'
        ? 'لا يوجد موردون مطابقون لمعاييرك.'
        : 'No suppliers matched your filters.'
    }
    const top = ranked[0]
    if (locale === 'ar') {
      return [
        `أفضل مورد: ${top.supplier.registration.tradeName ?? top.supplier.registration.legalName}.`,
        `درجة الجودة: ${(top.performance.qualityScore * 100).toFixed(0)}%.`,
        ...top.reasons.slice(0, 2),
      ].join('\n')
    }
    return [
      `Best supplier: ${top.supplier.registration.tradeName ?? top.supplier.registration.legalName}.`,
      `Quality ${(top.performance.qualityScore * 100).toFixed(0)}% · reliability ${(top.performance.reliabilityScore * 100).toFixed(0)}%.`,
      ...top.reasons.slice(0, 3),
      ranked.length > 1
        ? `Also considered ${ranked.length - 1} other approved supplier(s).`
        : null,
    ]
      .filter(Boolean)
      .join('\n')
  }

  explainTrustedOnly(locale: 'en' | 'ar' = 'en'): string {
    return locale === 'ar'
      ? 'سأحجز فقط من الموردين الموثوقين.'
      : 'I will book only from trusted, approved suppliers.'
  }

  explainPremiumHotels(locale: 'en' | 'ar' = 'en'): string {
    return locale === 'ar'
      ? 'سأستخدم مزودي الفنادق المميزين فقط.'
      : 'I will prefer premium hotel providers with strong quality scores.'
  }

  explainAvoidPoorRefunds(locale: 'en' | 'ar' = 'en'): string {
    return locale === 'ar'
      ? 'سأتجنب الموردين ذوي سجل الاسترداد الضعيف.'
      : 'I will avoid suppliers with poor refund history or slow refund SLAs.'
  }

  explainFastConfirmation(locale: 'en' | 'ar' = 'en'): string {
    return locale === 'ar'
      ? 'سأختار الموردين الأسرع في تأكيد الحجز.'
      : 'I will choose suppliers with the fastest confirmation times.'
  }

  explainDashboard(dashboard: SupplierDashboardSnapshot, locale: 'en' | 'ar' = 'en'): string {
    if (locale === 'ar') {
      return `الحجوزات: ${dashboard.kpis.bookings}. الإيرادات: ${dashboard.kpis.revenue} ${dashboard.kpis.currency}.`
    }
    return [
      `Bookings: ${dashboard.kpis.bookings}.`,
      `Revenue: ${dashboard.kpis.revenue} ${dashboard.kpis.currency}.`,
      `Pending settlements: ${dashboard.kpis.pendingSettlements}.`,
      `Refunds: ${dashboard.kpis.refunds}. Disputes: ${dashboard.kpis.disputes}.`,
      `Avg quality: ${(dashboard.kpis.averageQualityScore * 100).toFixed(0)}%.`,
    ].join(' ')
  }

  explainSupplier(supplier: SupplierRecord, locale: 'en' | 'ar' = 'en'): string {
    const name = supplier.registration.tradeName ?? supplier.registration.legalName
    if (locale === 'ar') {
      return `المورد ${name} بحالة ${supplier.status}.`
    }
    return `Supplier ${name} is ${supplier.status}${supplier.trusted ? ' (trusted)' : ''}${supplier.premium ? ' (premium)' : ''}.`
  }
}

export function createSupplierExplainer(): SupplierExplainer {
  return new SupplierExplainer()
}
