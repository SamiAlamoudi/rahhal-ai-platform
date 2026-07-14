export interface AdminStats {
  userCount: number
  searchCount: number
  sessionCount: number
  popularDestinations: { destination: string; count: number }[]
  systemHealth: {
    database: 'operational' | 'degraded' | 'down'
    auth: 'operational' | 'degraded' | 'down'
    storage: 'operational' | 'degraded' | 'down'
  }
  activeUsersToday: number
  totalSavedTrips: number
  totalFavorites: number
}

export function getMockAdminStats(): AdminStats {
  return {
    userCount: 1248,
    searchCount: 8532,
    sessionCount: 3210,
    popularDestinations: [
      { destination: 'Japan', count: 842 },
      { destination: 'Dubai', count: 671 },
      { destination: 'Turkey', count: 523 },
      { destination: 'France', count: 389 },
      { destination: 'Thailand', count: 312 },
    ],
    systemHealth: {
      database: 'operational',
      auth: 'operational',
      storage: 'operational',
    },
    activeUsersToday: 342,
    totalSavedTrips: 1567,
    totalFavorites: 2890,
  }
}

export const SYSTEM_HEALTH_LABELS: Record<string, string> = {
  operational: 'يعمل',
  degraded: 'متأثر',
  down: 'متوقف',
}
