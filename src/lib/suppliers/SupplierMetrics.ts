/**
 * Sprint 40 — Supplier marketplace metrics.
 */

export interface SupplierMetricsSnapshot {
  registered: number
  approved: number
  contracts: number
  inventorySyncs: number
  rankings: number
  averageRankScore: number
  bySupplierType: Record<string, number>
}

export class SupplierMetrics {
  private registered = 0
  private approved = 0
  private contracts = 0
  private inventorySyncs = 0
  private rankings = 0
  private rankScoreTotal = 0
  private readonly bySupplierType: Record<string, number> = {}

  recordRegistered(supplierType: string): void {
    this.registered += 1
    this.bySupplierType[supplierType] = (this.bySupplierType[supplierType] ?? 0) + 1
  }

  recordApproved(): void {
    this.approved += 1
  }

  recordContract(): void {
    this.contracts += 1
  }

  recordInventorySync(): void {
    this.inventorySyncs += 1
  }

  recordRanking(topScore: number): void {
    this.rankings += 1
    this.rankScoreTotal += clamp01(topScore)
  }

  snapshot(): SupplierMetricsSnapshot {
    return {
      registered: this.registered,
      approved: this.approved,
      contracts: this.contracts,
      inventorySyncs: this.inventorySyncs,
      rankings: this.rankings,
      averageRankScore:
        this.rankings > 0 ? round2(this.rankScoreTotal / this.rankings) : 0,
      bySupplierType: { ...this.bySupplierType },
    }
  }

  reset(): void {
    this.registered = 0
    this.approved = 0
    this.contracts = 0
    this.inventorySyncs = 0
    this.rankings = 0
    this.rankScoreTotal = 0
    for (const key of Object.keys(this.bySupplierType)) delete this.bySupplierType[key]
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
