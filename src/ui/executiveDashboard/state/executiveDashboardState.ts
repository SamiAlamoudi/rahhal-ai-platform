import { isExecutiveDashboardEnabled } from '../executiveDashboardRegistry'
import type {
  ExecutiveDashboardUiState,
  ExecutiveLocale,
  ExecutiveTheme,
  NotificationItem,
} from '../types'
import { EXECUTIVE_DASHBOARD_ISOLATION } from '../types'

export function createDemoExecutiveDashboardState(options?: {
  locale?: ExecutiveLocale
  theme?: ExecutiveTheme
  enabled?: boolean
  notifications?: NotificationItem[]
}): ExecutiveDashboardUiState {
  return {
    locale: options?.locale ?? 'ar',
    theme: options?.theme ?? 'light',
    activeFilter: 'today',
    calendarView: 'weekly',
    search: {
      query: '',
      category: 'all',
      showRecent: false,
      showFavorites: false,
    },
    metrics: [
      { id: 'm1', labelKey: 'total_trips', value: 12 },
      { id: 'm2', labelKey: 'upcoming_flights', value: 3 },
      { id: 'm3', labelKey: 'travelers', value: 8 },
      { id: 'm4', labelKey: 'hotels', value: 5 },
      { id: 'm5', labelKey: 'documents', value: 24 },
      { id: 'm6', labelKey: 'pending_tasks', value: 6 },
      { id: 'm7', labelKey: 'completed_tasks', value: 41 },
    ],
    upcomingTrips: [
      {
        id: 't1',
        destination: 'باريس',
        datesLabel: '10–16 Aug',
        statusLabel: 'Confirmed',
      },
      {
        id: 't2',
        destination: 'دبي',
        datesLabel: '22–24 Aug',
        statusLabel: 'Planning',
      },
    ],
    todaySchedule: [
      {
        id: 's1',
        timeLabel: '09:00',
        title: 'Board briefing',
        kind: 'meeting',
      },
      {
        id: 's2',
        timeLabel: '13:40',
        title: 'RUH → CDG',
        kind: 'flight',
      },
      {
        id: 's3',
        timeLabel: '18:00',
        title: 'Hotel check-in',
        kind: 'hotel',
      },
    ],
    boardMeetings: [
      {
        id: 'b1',
        title: 'Q3 Travel Review',
        timeLabel: 'Tue 10:00',
        location: 'HQ · Boardroom A',
      },
    ],
    travelerStatuses: [
      { id: 'tr1', name: 'سامي', statusLabel: 'Ready' },
      { id: 'tr2', name: 'نورة', statusLabel: 'Pending docs' },
    ],
    pendingActions: [
      { id: 'p1', title: 'Approve hotel upgrade', dueLabel: 'Today' },
      { id: 'p2', title: 'Confirm ground transfer', dueLabel: 'Tomorrow' },
    ],
    recentActivity: [
      { id: 'a1', summary: 'Flight SV123 confirmed', atLabel: '2h ago' },
      { id: 'a2', summary: 'Visa packet uploaded', atLabel: 'Yesterday' },
    ],
    notifications:
      options?.notifications ??
      ([
        {
          id: 'n1',
          title: 'Gate change',
          body: 'SV123 now boards at Gate B12',
          createdAt: '2026-07-24T09:00:00.000Z',
          readState: 'unread',
          priority: 'critical',
          category: 'flight_changes',
        },
        {
          id: 'n2',
          title: 'Meeting moved',
          body: 'Board briefing → 09:30',
          createdAt: '2026-07-24T08:00:00.000Z',
          readState: 'unread',
          priority: 'priority',
          category: 'meeting_updates',
        },
        {
          id: 'n3',
          title: 'Hotel confirmed',
          body: 'Le Meurice · Deluxe',
          createdAt: '2026-07-23T18:00:00.000Z',
          readState: 'read',
          priority: 'normal',
          category: 'hotel_changes',
        },
        {
          id: 'n4',
          title: 'Weather watch',
          body: 'Light rain in Paris tomorrow',
          createdAt: '2026-07-23T16:00:00.000Z',
          readState: 'read',
          priority: 'reminder',
          category: 'weather',
        },
        {
          id: 'n5',
          title: 'Visa reminder',
          body: 'Schengen copy expires in 90 days',
          createdAt: '2026-07-22T12:00:00.000Z',
          readState: 'unread',
          priority: 'reminder',
          category: 'visa',
        },
      ] satisfies NotificationItem[]),
    travelProgressPercent: 42,
    featureEnabled: isExecutiveDashboardEnabled({ enabled: options?.enabled }),
  }
}

export function filterNotifications(
  items: NotificationItem[],
  options?: {
    readState?: 'unread' | 'read' | 'all'
    priority?: NotificationItem['priority'] | 'all'
    category?: NotificationItem['category'] | 'all'
    query?: string
  },
): NotificationItem[] {
  const q = options?.query?.trim().toLowerCase() ?? ''
  return items.filter((n) => {
    if (options?.readState && options.readState !== 'all' && n.readState !== options.readState) {
      return false
    }
    if (options?.priority && options.priority !== 'all' && n.priority !== options.priority) {
      return false
    }
    if (options?.category && options.category !== 'all' && n.category !== options.category) {
      return false
    }
    if (!q) return true
    return (
      n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    )
  })
}

export function assertExecutiveDashboardIsolation(): typeof EXECUTIVE_DASHBOARD_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...EXECUTIVE_DASHBOARD_ISOLATION,
    presentationOnly: true,
  }
}
