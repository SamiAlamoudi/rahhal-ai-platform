import { describe, it, expect } from 'vitest'
import type {
  SessionRow,
  SearchHistoryRow,
  SavedTripRow,
  FavoriteRow,
  PreferenceRow,
  NotificationRow,
  AuditLogRow,
  NotificationType,
  CreateNotificationInput,
  CreateAuditLogInput,
} from '../types'

describe('Types: database row shapes', () => {
  it('SessionRow has all required fields', () => {
    const row: SessionRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      destination: 'Japan',
      departure_city: 'Riyadh',
      session_data: {},
      completion_percentage: 50,
      decision_confirmed: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(row.id).toBe('uuid-1')
    expect(row.destination).toBe('Japan')
  })

  it('SearchHistoryRow has all required fields', () => {
    const row: SearchHistoryRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      session_id: null,
      destination: 'Japan',
      search_request: {},
      result_count: 5,
      ranked_top_option: 'JAL 462',
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.result_count).toBe(5)
  })

  it('SavedTripRow has all required fields', () => {
    const row: SavedTripRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      session_id: null,
      title: 'Tokyo Trip',
      destination: 'Japan',
      trip_data: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(row.title).toBe('Tokyo Trip')
  })

  it('FavoriteRow has all required fields', () => {
    const row: FavoriteRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      destination: 'Dubai',
      notes: 'love it',
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.destination).toBe('Dubai')
  })

  it('PreferenceRow has all required fields', () => {
    const row: PreferenceRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      preferred_currency: 'SAR',
      preferred_language: 'ar',
      theme: 'light',
      notification_enabled: true,
      notify_email: true,
      notify_trip_updates: true,
      notify_marketing: false,
      privacy_analytics: true,
      privacy_personalization: true,
      privacy_share_activity: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(row.preferred_currency).toBe('SAR')
    expect(row.privacy_share_activity).toBe(false)
  })

  it('NotificationRow has all required fields', () => {
    const row: NotificationRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      type: 'info',
      title: 'Welcome',
      body: 'Hello',
      is_read: false,
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      read_at: null,
    }
    expect(row.is_read).toBe(false)
  })

  it('AuditLogRow has all required fields', () => {
    const row: AuditLogRow = {
      id: 'uuid-1',
      user_id: 'uuid-user',
      action: 'sign_in',
      entity_type: 'auth',
      entity_id: '',
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.action).toBe('sign_in')
  })
})

describe('Types: notification and audit input shapes', () => {
  it('CreateNotificationInput has required fields', () => {
    const input: CreateNotificationInput = {
      type: 'success' as NotificationType,
      title: 'Trip saved',
      body: 'Your trip was saved successfully',
    }
    expect(input.type).toBe('success')
  })

  it('CreateAuditLogInput with optional fields', () => {
    const input: CreateAuditLogInput = {
      action: 'create_session',
      entity_type: 'session',
      entity_id: 'uuid-1',
      metadata: { destination: 'Japan' },
    }
    expect(input.action).toBe('create_session')
  })

  it('CreateAuditLogInput with only required fields', () => {
    const input: CreateAuditLogInput = {
      action: 'sign_out',
    }
    expect(input.action).toBe('sign_out')
    expect(input.entity_type).toBeUndefined()
  })
})
