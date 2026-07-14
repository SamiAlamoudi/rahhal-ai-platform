export type LockStatus = 'active' | 'released' | 'expired'

export interface BookingLock {
  id: string
  orderId: string
  userId: string
  status: LockStatus
  lockToken: string
  createdAt: string
  expiresAt: string
  releasedAt: string | null
}

const LOCK_TTL_MS = 5 * 60 * 1000

const locks: Map<string, BookingLock> = new Map()
const orderLocks: Map<string, string> = new Map()

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `lock_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function acquireLock(orderId: string, userId: string): BookingLock | null {
  const existingLockId = orderLocks.get(orderId)
  if (existingLockId) {
    const existing = locks.get(existingLockId)
    if (existing && existing.status === 'active' && !isLockExpired(existing)) {
      return null
    }
    if (existing) {
      existing.status = 'expired'
    }
    orderLocks.delete(orderId)
  }

  const now = Date.now()
  const lock: BookingLock = {
    id: generateId(),
    orderId,
    userId,
    status: 'active',
    lockToken: generateToken(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LOCK_TTL_MS).toISOString(),
    releasedAt: null,
  }
  locks.set(lock.id, lock)
  orderLocks.set(orderId, lock.id)
  return { ...lock }
}

export function releaseLock(orderId: string, lockToken: string): boolean {
  const lockId = orderLocks.get(orderId)
  if (!lockId) return false
  const lock = locks.get(lockId)
  if (!lock || lock.lockToken !== lockToken) return false
  lock.status = 'released'
  lock.releasedAt = new Date().toISOString()
  orderLocks.delete(orderId)
  return true
}

export function verifyLock(orderId: string, lockToken: string): boolean {
  const lockId = orderLocks.get(orderId)
  if (!lockId) return false
  const lock = locks.get(lockId)
  if (!lock || lock.lockToken !== lockToken) return false
  if (lock.status !== 'active' || isLockExpired(lock)) {
    lock.status = 'expired'
    orderLocks.delete(orderId)
    return false
  }
  return true
}

export function getLock(orderId: string): BookingLock | null {
  const lockId = orderLocks.get(orderId)
  if (!lockId) return null
  const lock = locks.get(lockId)
  if (!lock) return null
  if (lock.status === 'active' && isLockExpired(lock)) {
    lock.status = 'expired'
    orderLocks.delete(orderId)
    return { ...lock }
  }
  return { ...lock }
}

export function clearAllLocks(): void {
  locks.clear()
  orderLocks.clear()
}

function isLockExpired(lock: BookingLock): boolean {
  return new Date(lock.expiresAt).getTime() < Date.now()
}
