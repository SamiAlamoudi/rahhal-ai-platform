/**
 * Sprint 40 — Supplier marketplace event bus.
 */

export type SupplierEventTypeName =
  | 'SupplierRegistered'
  | 'SupplierApproved'
  | 'ContractCreated'
  | 'InventorySynced'
  | 'PerformanceRecorded'
  | 'SuppliersRanked'
  | 'DashboardQueried'
  | 'SupplierHandled'

export interface SupplierEvent {
  type: SupplierEventTypeName
  at: string
  supplierId?: string
  data?: Record<string, unknown>
}

export type SupplierEventListener = (event: SupplierEvent) => void

export class SupplierEvents {
  private readonly listeners = new Map<SupplierEventTypeName | '*', Set<SupplierEventListener>>()

  on(type: SupplierEventTypeName | '*', listener: SupplierEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: SupplierEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createSupplierEvent(
  type: SupplierEventTypeName,
  supplierId?: string,
  data?: Record<string, unknown>,
): SupplierEvent {
  return { type, at: new Date().toISOString(), supplierId, data }
}
