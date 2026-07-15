/**
 * TravelerProfile store — mock, ownership-scoped, masked PII only.
 */

import { maskEmail, maskPassport, maskPhone } from './privacy'
import type { TravelerProfile } from './types'

export interface UpsertTravelerProfileInput {
  userId: string
  firstName: string
  lastName: string
  type?: TravelerProfile['type']
  nationality?: string | null
  passportNumber?: string | null
  email?: string | null
  phone?: string | null
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `trav_${crypto.randomUUID()}`
  }
  return `trav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class TravelerProfileStore {
  private readonly profiles = new Map<string, TravelerProfile>()

  upsert(input: UpsertTravelerProfileInput, existingId?: string): TravelerProfile {
    const now = new Date().toISOString()
    if (existingId) {
      const existing = this.profiles.get(existingId)
      if (!existing || existing.userId !== input.userId) {
        throw new Error('Traveler profile not found or ownership denied')
      }
      const updated: TravelerProfile = {
        ...existing,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        type: input.type ?? existing.type,
        nationality: input.nationality ?? existing.nationality,
        passportMasked: input.passportNumber !== undefined
          ? maskPassport(input.passportNumber)
          : existing.passportMasked,
        emailMasked: input.email !== undefined ? maskEmail(input.email) : existing.emailMasked,
        phoneMasked: input.phone !== undefined ? maskPhone(input.phone) : existing.phoneMasked,
        updatedAt: now,
      }
      this.profiles.set(existingId, updated)
      return structuredClone(updated)
    }

    const created: TravelerProfile = {
      id: generateId(),
      userId: input.userId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      type: input.type ?? 'adult',
      nationality: input.nationality ?? null,
      passportMasked: maskPassport(input.passportNumber),
      emailMasked: maskEmail(input.email),
      phoneMasked: maskPhone(input.phone),
      createdAt: now,
      updatedAt: now,
    }
    this.profiles.set(created.id, created)
    return structuredClone(created)
  }

  getByIdForUser(id: string, userId: string): TravelerProfile | null {
    const profile = this.profiles.get(id)
    if (!profile || profile.userId !== userId) return null
    return structuredClone(profile)
  }

  listByUser(userId: string): TravelerProfile[] {
    return [...this.profiles.values()]
      .filter((p) => p.userId === userId)
      .map((p) => structuredClone(p))
  }

  delete(id: string, userId: string): boolean {
    const existing = this.profiles.get(id)
    if (!existing || existing.userId !== userId) return false
    this.profiles.delete(id)
    return true
  }

  clear(): void {
    this.profiles.clear()
  }
}

let defaultStore: TravelerProfileStore | null = null

export function getTravelerProfileStore(): TravelerProfileStore {
  if (!defaultStore) defaultStore = new TravelerProfileStore()
  return defaultStore
}

export function resetTravelerProfileStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
