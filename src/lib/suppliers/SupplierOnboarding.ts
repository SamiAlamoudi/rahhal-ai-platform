/**
 * Sprint 40 — Supplier onboarding, KYC, and approval workflow.
 */

import type {
  SupplierApprovalStatus,
  SupplierRecord,
  SupplierRegistration,
} from './types'

export class SupplierOnboarding {
  private readonly byId = new Map<string, SupplierRecord>()

  register(registration: SupplierRegistration): SupplierRecord {
    validateRegistration(registration)
    const now = new Date().toISOString()
    const record: SupplierRecord = {
      supplierId: `sup_${Math.random().toString(36).slice(2, 10)}`,
      registration: cloneRegistration(registration),
      status: 'draft',
      kycVerified: false,
      trusted: false,
      premium: false,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      rejectionReason: null,
    }
    this.byId.set(record.supplierId, record)
    return clone(record)
  }

  submit(supplierId: string): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record) return null
    if (record.status !== 'draft' && record.status !== 'rejected') {
      return clone(record)
    }
    record.status = 'submitted'
    record.updatedAt = new Date().toISOString()
    return clone(record)
  }

  startKyc(supplierId: string): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record) return null
    record.status = 'kyc_pending'
    record.updatedAt = new Date().toISOString()
    return clone(record)
  }

  verifyKyc(supplierId: string, verified = true): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record) return null
    record.kycVerified = verified
    record.updatedAt = new Date().toISOString()
    if (!verified) {
      record.status = 'rejected'
      record.rejectionReason = 'KYC verification failed'
    }
    return clone(record)
  }

  approve(supplierId: string, options?: { trusted?: boolean; premium?: boolean }): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record) return null
    if (!record.kycVerified) {
      record.status = 'kyc_pending'
      record.updatedAt = new Date().toISOString()
      return clone(record)
    }
    if (!record.registration.businessLicenseId || !record.registration.taxId) {
      record.status = 'rejected'
      record.rejectionReason = 'Missing business license or tax information'
      record.updatedAt = new Date().toISOString()
      return clone(record)
    }
    if (!record.registration.bankAccountIban) {
      record.status = 'rejected'
      record.rejectionReason = 'Missing bank account for settlements'
      record.updatedAt = new Date().toISOString()
      return clone(record)
    }
    record.status = 'approved'
    record.trusted = options?.trusted ?? record.trusted
    record.premium = options?.premium ?? record.premium
    record.approvedAt = new Date().toISOString()
    record.updatedAt = record.approvedAt
    record.rejectionReason = null
    return clone(record)
  }

  reject(supplierId: string, reason: string): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record) return null
    record.status = 'rejected'
    record.rejectionReason = reason
    record.updatedAt = new Date().toISOString()
    return clone(record)
  }

  suspend(supplierId: string, reason: string): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record) return null
    record.status = 'suspended'
    record.rejectionReason = reason
    record.trusted = false
    record.updatedAt = new Date().toISOString()
    return clone(record)
  }

  markTrusted(supplierId: string, trusted = true): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record || record.status !== 'approved') return null
    record.trusted = trusted
    record.updatedAt = new Date().toISOString()
    return clone(record)
  }

  markPremium(supplierId: string, premium = true): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    if (!record || record.status !== 'approved') return null
    record.premium = premium
    record.updatedAt = new Date().toISOString()
    return clone(record)
  }

  get(supplierId: string): SupplierRecord | null {
    const record = this.byId.get(supplierId)
    return record ? clone(record) : null
  }

  list(status?: SupplierApprovalStatus): SupplierRecord[] {
    return [...this.byId.values()]
      .filter((r) => (status ? r.status === status : true))
      .map(clone)
  }

  listApproved(): SupplierRecord[] {
    return this.list('approved')
  }
}

export function createSupplierOnboarding(): SupplierOnboarding {
  return new SupplierOnboarding()
}

function validateRegistration(registration: SupplierRegistration): void {
  if (!registration.legalName.trim()) throw new Error('legalName is required')
  if (!registration.countriesServed.length) throw new Error('countriesServed required')
  if (!registration.currencies.length) throw new Error('currencies required')
  if (!registration.supportContacts.length) throw new Error('supportContacts required')
}

function cloneRegistration(registration: SupplierRegistration): SupplierRegistration {
  return {
    ...registration,
    countriesServed: [...registration.countriesServed],
    languages: [...registration.languages],
    currencies: [...registration.currencies],
    supportContacts: registration.supportContacts.map((c) => ({ ...c })),
    operatingHours: { ...registration.operatingHours },
  }
}

function clone(record: SupplierRecord): SupplierRecord {
  return {
    ...record,
    registration: cloneRegistration(record.registration),
  }
}
