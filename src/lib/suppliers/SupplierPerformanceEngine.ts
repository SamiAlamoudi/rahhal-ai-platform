/**
 * Sprint 40 — Supplier performance scoring.
 */

import type { SupplierPerformanceSnapshot } from './types'

export interface PerformanceInput {
  supplierId: string
  confirmationSpeedSeconds?: number
  cancellationRate?: number
  refundSpeedHours?: number
  complaintRate?: number
  customerSatisfaction?: number
  responseSlaHours?: number
  completedBookings?: number
  failedConfirmations?: number
}

export class SupplierPerformanceEngine {
  private readonly bySupplier = new Map<string, SupplierPerformanceSnapshot>()

  record(input: PerformanceInput): SupplierPerformanceSnapshot {
    const confirmationSpeedSeconds = input.confirmationSpeedSeconds ?? 120
    const cancellationRate = clamp01(input.cancellationRate ?? 0.05)
    const refundSpeedHours = Math.max(1, input.refundSpeedHours ?? 48)
    const complaintRate = clamp01(input.complaintRate ?? 0.02)
    const customerSatisfaction = clamp01(input.customerSatisfaction ?? 0.85)
    const responseSlaHours = Math.max(0.25, input.responseSlaHours ?? 4)
    const completed = Math.max(0, input.completedBookings ?? 10)
    const failed = Math.max(0, input.failedConfirmations ?? 0)
    const reliabilityScore = clamp01(
      completed / Math.max(1, completed + failed) * 0.7
        + (1 - cancellationRate) * 0.3,
    )
    const qualityScore = clamp01(
      reliabilityScore * 0.25
        + customerSatisfaction * 0.25
        + (1 - complaintRate) * 0.15
        + Math.max(0, 1 - confirmationSpeedSeconds / 600) * 0.15
        + Math.max(0, 1 - refundSpeedHours / 168) * 0.1
        + Math.max(0, 1 - responseSlaHours / 24) * 0.1,
    )

    const snapshot: SupplierPerformanceSnapshot = {
      supplierId: input.supplierId,
      reliabilityScore: round2(reliabilityScore),
      confirmationSpeedSeconds,
      cancellationRate: round2(cancellationRate),
      refundSpeedHours,
      complaintRate: round2(complaintRate),
      customerSatisfaction: round2(customerSatisfaction),
      responseSlaHours,
      qualityScore: round2(qualityScore),
      updatedAt: new Date().toISOString(),
    }
    this.bySupplier.set(input.supplierId, snapshot)
    return { ...snapshot }
  }

  get(supplierId: string): SupplierPerformanceSnapshot {
    return (
      this.bySupplier.get(supplierId)
      ?? this.record({ supplierId })
    )
  }

  list(): SupplierPerformanceSnapshot[] {
    return [...this.bySupplier.values()].map((s) => ({ ...s }))
  }

  hasPoorRefundHistory(supplierId: string): boolean {
    const snap = this.get(supplierId)
    return snap.refundSpeedHours > 96 || snap.complaintRate > 0.08
  }

  isFastConfirmation(supplierId: string): boolean {
    return this.get(supplierId).confirmationSpeedSeconds <= 90
  }
}

export function createSupplierPerformanceEngine(): SupplierPerformanceEngine {
  return new SupplierPerformanceEngine()
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
