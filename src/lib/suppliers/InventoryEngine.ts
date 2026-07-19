/**
 * Sprint 40 — Supplier inventory, rate plans, blackouts, promotions, sync.
 */

import type { InventoryRatePlan, SupplierInventoryItem } from './types'

export interface UpsertInventoryInput {
  supplierId: string
  sku: string
  title: string
  availableUnits: number
  ratePlans: Array<Omit<InventoryRatePlan, 'planId'> & { planId?: string }>
  blackoutDates?: string[]
  promotions?: Array<{ code: string; percentOff: number; expiresAt: string }>
  realtime?: boolean
}

export class InventoryEngine {
  private readonly byId = new Map<string, SupplierInventoryItem>()

  upsert(input: UpsertInventoryInput): SupplierInventoryItem {
    const existing = [...this.byId.values()].find(
      (i) => i.supplierId === input.supplierId && i.sku === input.sku,
    )
    const now = new Date().toISOString()
    if (existing) {
      existing.title = input.title
      existing.availableUnits = Math.max(0, input.availableUnits)
      existing.ratePlans = input.ratePlans.map((p) => ({
        planId: p.planId ?? `rp_${Math.random().toString(36).slice(2, 8)}`,
        name: p.name,
        baseRate: p.baseRate,
        currency: p.currency,
        dynamicPricingEnabled: p.dynamicPricingEnabled,
      }))
      existing.blackoutDates = [...(input.blackoutDates ?? existing.blackoutDates)]
      existing.promotions = (input.promotions ?? existing.promotions).map((p) => ({ ...p }))
      existing.lastSyncedAt = now
      existing.realtime = input.realtime ?? existing.realtime
      return clone(existing)
    }

    const item: SupplierInventoryItem = {
      inventoryId: `inv_${Math.random().toString(36).slice(2, 10)}`,
      supplierId: input.supplierId,
      sku: input.sku,
      title: input.title,
      availableUnits: Math.max(0, input.availableUnits),
      ratePlans: input.ratePlans.map((p) => ({
        planId: p.planId ?? `rp_${Math.random().toString(36).slice(2, 8)}`,
        name: p.name,
        baseRate: p.baseRate,
        currency: p.currency,
        dynamicPricingEnabled: p.dynamicPricingEnabled,
      })),
      blackoutDates: [...(input.blackoutDates ?? [])],
      promotions: (input.promotions ?? []).map((p) => ({ ...p })),
      lastSyncedAt: now,
      realtime: input.realtime ?? true,
    }
    this.byId.set(item.inventoryId, item)
    return clone(item)
  }

  sync(supplierId: string): SupplierInventoryItem[] {
    const now = new Date().toISOString()
    const items = [...this.byId.values()].filter((i) => i.supplierId === supplierId)
    for (const item of items) {
      item.lastSyncedAt = now
      item.realtime = true
    }
    return items.map(clone)
  }

  applyDynamicPrice(inventoryId: string, demandFactor: number): SupplierInventoryItem | null {
    const item = this.byId.get(inventoryId)
    if (!item) return null
    for (const plan of item.ratePlans) {
      if (!plan.dynamicPricingEnabled) continue
      plan.baseRate = round2(plan.baseRate * Math.max(0.5, demandFactor))
    }
    item.lastSyncedAt = new Date().toISOString()
    return clone(item)
  }

  isAvailable(inventoryId: string, date: string): boolean {
    const item = this.byId.get(inventoryId)
    if (!item) return false
    if (item.availableUnits <= 0) return false
    return !item.blackoutDates.includes(date.slice(0, 10))
  }

  listForSupplier(supplierId: string): SupplierInventoryItem[] {
    return [...this.byId.values()]
      .filter((i) => i.supplierId === supplierId)
      .map(clone)
  }

  get(inventoryId: string): SupplierInventoryItem | null {
    const item = this.byId.get(inventoryId)
    return item ? clone(item) : null
  }
}

export function createInventoryEngine(): InventoryEngine {
  return new InventoryEngine()
}

function clone(item: SupplierInventoryItem): SupplierInventoryItem {
  return {
    ...item,
    ratePlans: item.ratePlans.map((p) => ({ ...p })),
    blackoutDates: [...item.blackoutDates],
    promotions: item.promotions.map((p) => ({ ...p })),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
