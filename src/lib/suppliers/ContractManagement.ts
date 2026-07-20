/**
 * Sprint 40 — Supplier contract & commercial terms management.
 */

import type {
  ContractPricingModel,
  SettlementCadence,
  SupplierContract,
} from './types'

export interface CreateContractInput {
  supplierId: string
  pricingModel: ContractPricingModel
  commissionPercent?: number | null
  markupPercent?: number | null
  netRateDiscountPercent?: number | null
  seasonalAdjustments?: Array<{ season: string; percent: number }>
  promotionalDiscountPercent?: number | null
  cancellationAgreement?: string
  refundAgreement?: string
  settlementSchedule?: SettlementCadence
  revenueSharePercent?: number | null
  corporateEligible?: boolean
  agencyEligible?: boolean
  effectiveFrom?: string
  effectiveTo?: string | null
}

export class ContractManagement {
  private readonly byId = new Map<string, SupplierContract>()

  create(input: CreateContractInput): SupplierContract {
    const contract: SupplierContract = {
      contractId: `ctr_${Math.random().toString(36).slice(2, 10)}`,
      supplierId: input.supplierId,
      pricingModel: input.pricingModel,
      commissionPercent: input.commissionPercent ?? null,
      markupPercent: input.markupPercent ?? null,
      netRateDiscountPercent: input.netRateDiscountPercent ?? null,
      seasonalAdjustments: input.seasonalAdjustments?.map((s) => ({ ...s })) ?? [],
      promotionalDiscountPercent: input.promotionalDiscountPercent ?? null,
      cancellationAgreement: input.cancellationAgreement ?? 'Standard free cancel until 24h',
      refundAgreement: input.refundAgreement ?? 'Refunds within 7–14 business days',
      settlementSchedule: input.settlementSchedule ?? 'weekly',
      revenueSharePercent: input.revenueSharePercent ?? null,
      corporateEligible: input.corporateEligible ?? false,
      agencyEligible: input.agencyEligible ?? true,
      active: true,
      effectiveFrom: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effectiveTo: input.effectiveTo ?? null,
    }
    this.byId.set(contract.contractId, contract)
    return clone(contract)
  }

  get(contractId: string): SupplierContract | null {
    const row = this.byId.get(contractId)
    return row ? clone(row) : null
  }

  listForSupplier(supplierId: string): SupplierContract[] {
    return [...this.byId.values()]
      .filter((c) => c.supplierId === supplierId)
      .map(clone)
  }

  getActiveContract(supplierId: string): SupplierContract | null {
    const active = this.listForSupplier(supplierId).find((c) => c.active)
    return active ?? null
  }

  deactivate(contractId: string): SupplierContract | null {
    const row = this.byId.get(contractId)
    if (!row) return null
    row.active = false
    return clone(row)
  }

  updatePricing(
    contractId: string,
    patch: Partial<
      Pick<
        SupplierContract,
        | 'commissionPercent'
        | 'markupPercent'
        | 'netRateDiscountPercent'
        | 'promotionalDiscountPercent'
        | 'revenueSharePercent'
        | 'settlementSchedule'
      >
    >,
  ): SupplierContract | null {
    const row = this.byId.get(contractId)
    if (!row) return null
    Object.assign(row, patch)
    return clone(row)
  }
}

export function createContractManagement(): ContractManagement {
  return new ContractManagement()
}

function clone(contract: SupplierContract): SupplierContract {
  return {
    ...contract,
    seasonalAdjustments: (contract.seasonalAdjustments ?? []).map((s) => ({ ...s })),
  }
}
