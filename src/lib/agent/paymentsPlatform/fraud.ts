/**
 * Fraud Protection — Sprint 58.
 * Duplicate detection, velocity limits, risk score, suspicious behavior, provider verification.
 */

import type { FraudAssessment, PaymentMethod } from './types'

export type FraudCheckInput = {
  userId: string
  amount: number
  currency: string
  method: PaymentMethod
  idempotencyKey: string
  providerVerified?: boolean
  now?: () => number
}

type VelocityBucket = { entries: Array<{ at: number; amount: number }> }

export class FraudGuard {
  private readonly seenKeys = new Map<string, string>()
  private readonly velocity = new Map<string, VelocityBucket>()
  private readonly windowMs: number
  private readonly maxPayments: number
  private readonly maxAmount: number

  constructor(options?: {
    windowMs?: number
    maxPayments?: number
    maxAmount?: number
  }) {
    this.windowMs = options?.windowMs ?? 60_000
    this.maxPayments = options?.maxPayments ?? 5
    this.maxAmount = options?.maxAmount ?? 50_000
  }

  assess(input: FraudCheckInput): FraudAssessment {
    const now = input.now ?? (() => Date.now())
    const at = now()
    const reasons: string[] = []
    const duplicateDetected = this.seenKeys.has(input.idempotencyKey)
    if (duplicateDetected) reasons.push('duplicate_payment_key')

    const key = `${input.userId}:${input.method}`
    const bucket = this.velocity.get(key) ?? { entries: [] }
    bucket.entries = bucket.entries.filter((e) => e.at > at - this.windowMs)

    const velocityExceeded =
      bucket.entries.length >= this.maxPayments
      || bucket.entries.reduce((s, e) => s + e.amount, 0) + input.amount > this.maxAmount
    if (velocityExceeded) reasons.push('velocity_limit')

    const suspicious =
      input.amount <= 0
      || input.amount > this.maxAmount
      || (input.method === 'bank_transfer' && input.amount > 20_000)
    if (suspicious) reasons.push('suspicious_behavior')

    const providerVerified = input.providerVerified ?? true
    if (!providerVerified) reasons.push('provider_unverified')

    let riskScore = 0.05
    if (duplicateDetected) riskScore += 0.45
    if (velocityExceeded) riskScore += 0.35
    if (suspicious) riskScore += 0.25
    if (!providerVerified) riskScore += 0.2
    riskScore = Math.min(1, riskScore)

    const allowed = !duplicateDetected && !velocityExceeded && riskScore < 0.85 && providerVerified

    if (allowed && !duplicateDetected) {
      this.seenKeys.set(input.idempotencyKey, input.userId)
      bucket.entries.push({ at, amount: input.amount })
      this.velocity.set(key, bucket)
    }

    return {
      allowed,
      riskScore,
      reasons,
      duplicateDetected,
      velocityExceeded,
      suspicious,
      providerVerified,
    }
  }

  clear(): void {
    this.seenKeys.clear()
    this.velocity.clear()
  }
}
