/**
 * Phase 5 Stage 5 — AI Memory & Knowledge Center contracts.
 * Presentation only. No AI, database, runtime, sync, or search backend.
 */

export type MemoryCenterLocale = 'ar' | 'en'
export type MemoryCenterTheme = 'light' | 'dark'

export type MemoryFilterId =
  | 'all'
  | 'destinations'
  | 'preferences'
  | 'documents'
  | 'conversations'
  | 'rules'

export interface MemoryStatCard {
  id: string
  label: string
  value: string
}

export interface MemoryTimelineItem {
  id: string
  whenLabel: string
  title: string
  category: string
  confidence: number
}

export interface MemoryPlaceItem {
  id: string
  name: string
  meta: string
}

export interface MemoryPreferenceChip {
  id: string
  label: string
  active: boolean
}

export interface MemoryPersonCard {
  id: string
  name: string
  relation: string
}

export interface MemoryDocumentCard {
  id: string
  title: string
  statusLabel: string
}

export interface MemoryConversationItem {
  id: string
  title: string
  snippet: string
}

export interface MemoryRuleItem {
  id: string
  text: string
}

export interface MemorySourceBadge {
  id: string
  label: string
  kind: string
}

export interface MemoryCategoryChip {
  id: string
  label: string
  count: number
}

export interface MemoryGraphNode {
  id: string
  label: string
  weight: number
}

export interface MemoryCenterUiState {
  locale: MemoryCenterLocale
  theme: MemoryCenterTheme
  activeFilter: MemoryFilterId
  searchQuery: string
  overview: string
  stats: MemoryStatCard[]
  timeline: MemoryTimelineItem[]
  knownDestinations: MemoryPlaceItem[]
  favoriteCountries: MemoryPlaceItem[]
  favoriteCities: MemoryPlaceItem[]
  favoriteHotels: MemoryPlaceItem[]
  favoriteAirlines: MemoryPlaceItem[]
  travelPreferences: MemoryPreferenceChip[]
  seatPreferences: MemoryPreferenceChip[]
  mealPreferences: MemoryPreferenceChip[]
  budgetHistory: MemoryStatCard[]
  familyMembers: MemoryPersonCard[]
  emergencyContacts: MemoryPersonCard[]
  passports: MemoryDocumentCard[]
  visaHistory: MemoryDocumentCard[]
  savedPlaces: MemoryPlaceItem[]
  savedTrips: MemoryPlaceItem[]
  conversationMemories: MemoryConversationItem[]
  customRules: MemoryRuleItem[]
  alwaysDo: MemoryRuleItem[]
  neverDo: MemoryRuleItem[]
  knowledgeSources: MemorySourceBadge[]
  confidenceAverage: number
  memoryCategories: MemoryCategoryChip[]
  bookmarks: MemoryPlaceItem[]
  memoryGraph: MemoryGraphNode[]
  editPlaceholder: string
  deletePlaceholder: string
  featureEnabled: boolean
}

export const MEMORY_FILTERS: readonly MemoryFilterId[] = [
  'all',
  'destinations',
  'preferences',
  'documents',
  'conversations',
  'rules',
] as const

export const MEMORY_CENTER_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntime: false,
  wiredIntoDatabase: false,
  wiredIntoFirebase: false,
  wiredIntoChat: false,
  authentication: false,
  backend: false,
  realtime: false,
  sync: false,
  storage: false,
  searchBackend: false,
} as const
