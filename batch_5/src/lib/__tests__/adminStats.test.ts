import { describe, it, expect } from 'vitest'
import { getMockAdminStats, SYSTEM_HEALTH_LABELS } from '../admin/adminStats'

describe('Admin Stats: getMockAdminStats', () => {
  it('returns all required fields', () => {
    const stats = getMockAdminStats()
    expect(stats).toHaveProperty('userCount')
    expect(stats).toHaveProperty('searchCount')
    expect(stats).toHaveProperty('sessionCount')
    expect(stats).toHaveProperty('popularDestinations')
    expect(stats).toHaveProperty('systemHealth')
    expect(stats).toHaveProperty('activeUsersToday')
    expect(stats).toHaveProperty('totalSavedTrips')
    expect(stats).toHaveProperty('totalFavorites')
  })

  it('returns positive counts', () => {
    const stats = getMockAdminStats()
    expect(stats.userCount).toBeGreaterThan(0)
    expect(stats.searchCount).toBeGreaterThan(0)
    expect(stats.sessionCount).toBeGreaterThan(0)
  })

  it('returns popular destinations sorted by count descending', () => {
    const stats = getMockAdminStats()
    expect(stats.popularDestinations.length).toBeGreaterThan(0)
    for (let i = 1; i < stats.popularDestinations.length; i++) {
      expect(stats.popularDestinations[i - 1].count).toBeGreaterThanOrEqual(
        stats.popularDestinations[i].count
      )
    }
  })

  it('all system health services are operational', () => {
    const stats = getMockAdminStats()
    expect(stats.systemHealth.database).toBe('operational')
    expect(stats.systemHealth.auth).toBe('operational')
    expect(stats.systemHealth.storage).toBe('operational')
  })
})

describe('Admin Stats: SYSTEM_HEALTH_LABELS', () => {
  it('has labels for all statuses', () => {
    expect(SYSTEM_HEALTH_LABELS.operational).toBeDefined()
    expect(SYSTEM_HEALTH_LABELS.degraded).toBeDefined()
    expect(SYSTEM_HEALTH_LABELS.down).toBeDefined()
  })
})
