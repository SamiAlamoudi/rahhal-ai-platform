export interface SessionRow {
  id: string
  user_id: string
  destination: string
  departure_city: string
  session_data: Record<string, unknown>
  completion_percentage: number
  decision_confirmed: boolean
  created_at: string
  updated_at: string
}

export interface SearchHistoryRow {
  id: string
  user_id: string
  session_id: string | null
  destination: string
  search_request: Record<string, unknown>
  result_count: number
  ranked_top_option: string | null
  created_at: string
}

export interface SavedTripRow {
  id: string
  user_id: string
  session_id: string | null
  title: string
  destination: string
  trip_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FavoriteRow {
  id: string
  user_id: string
  destination: string
  notes: string
  created_at: string
}

export interface PreferenceRow {
  id: string
  user_id: string
  preferred_currency: string
  preferred_language: string
  theme: string
  notification_enabled: boolean
  notify_email: boolean
  notify_trip_updates: boolean
  notify_marketing: boolean
  privacy_analytics: boolean
  privacy_personalization: boolean
  privacy_share_activity: boolean
  created_at: string
  updated_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  is_archived: boolean
  created_at: string
  read_at: string | null
}

export interface AuditLogRow {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface BookingSessionRow {
  id: string
  user_id: string
  travel_session_id: string | null
  status: string
  items: Record<string, unknown>
  subtotal: number
  fees: number
  total: number
  currency: string
  selected_booking_mode: string
  provider_references: Record<string, unknown>
  created_at: string
  updated_at: string
  expires_at: string
  redirected_at: string | null
  confirmed_at: string | null
}

export interface BookingItemRow {
  id: string
  booking_session_id: string
  user_id: string
  type: string
  provider_id: string
  provider_name: string
  provider_offer_id: string
  title: string
  price: number
  currency: string
  booking_url: string
  booking_mode: string
  expires_at: string | null
  traveler_summary: string
  selected_at: string
  metadata: Record<string, unknown>
}

export interface BookingEventRow {
  id: string
  booking_session_id: string
  user_id: string
  event_type: string
  from_status: string | null
  to_status: string
  details: Record<string, unknown>
  created_at: string
}

export type ChatModality = 'text' | 'audio'
export type ChatMessageRole = 'user' | 'assistant' | 'system'
export type ChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled'

export interface ConversationRow {
  id: string
  user_id: string
  title: string
  modality_default: ChatModality | string
  travel_session_id: string | null
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  user_id: string
  role: ChatMessageRole | string
  modality: ChatModality | string
  content: string
  audio_url: string | null
  status: ChatMessageStatus | string
  error: string | null
  provider_meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface CreateNotificationInput {
  type: NotificationType
  title: string
  body: string
}

export interface CreateAuditLogInput {
  action: string
  entity_type?: string
  entity_id?: string
  metadata?: Record<string, unknown>
}
