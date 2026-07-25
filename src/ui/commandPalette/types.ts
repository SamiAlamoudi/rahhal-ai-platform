/**
 * Phase 4 Stage 8 — Universal Search & Command Palette contracts.
 * Presentation only. No backend, realtime search, AI search, indexing, or APIs.
 */

export type CommandPaletteLocale = 'ar' | 'en'
export type CommandPaletteTheme = 'light' | 'dark'

export type SearchDomain =
  | 'trips'
  | 'travelers'
  | 'flights'
  | 'hotels'
  | 'documents'
  | 'notifications'
  | 'history'
  | 'bookmarks'
  | 'favorites'
  | 'destinations'

export type CommandDestination =
  | 'dashboard'
  | 'workspace'
  | 'chat'
  | 'voice'
  | 'knowledge'
  | 'books'
  | 'trips'
  | 'hotels'
  | 'flights'
  | 'documents'
  | 'settings'
  | 'notifications'

export type ResultCollection =
  | 'pinned'
  | 'favorites'
  | 'recent'
  | 'suggested'
  | 'frequently_used'

export type PaletteFilterId =
  | 'trips'
  | 'travelers'
  | 'flights'
  | 'hotels'
  | 'documents'
  | 'messages'
  | 'voice'
  | 'knowledge'
  | 'books'
  | 'settings'

export type ResultLayout = 'card' | 'list' | 'grid' | 'grouped'

export type PaletteEmptyState =
  | 'no_results'
  | 'recent_searches'
  | 'suggested_commands'

export type PaletteItemKind = 'search_result' | 'command' | 'recent' | 'suggested'

export interface PaletteItem {
  id: string
  kind: PaletteItemKind
  title: string
  subtitle: string
  domain?: SearchDomain
  destination?: CommandDestination
  collection?: ResultCollection
  filter?: PaletteFilterId
  highlight?: string
  favorite?: boolean
  pinned?: boolean
}

export interface CommandPaletteUiState {
  locale: CommandPaletteLocale
  theme: CommandPaletteTheme
  open: boolean
  query: string
  activeFilter: PaletteFilterId | 'all'
  layout: ResultLayout
  emptyState: PaletteEmptyState
  items: PaletteItem[]
  recentQueries: string[]
  featureEnabled: boolean
}

export const SEARCH_DOMAINS: readonly SearchDomain[] = [
  'trips',
  'travelers',
  'flights',
  'hotels',
  'documents',
  'notifications',
  'history',
  'bookmarks',
  'favorites',
  'destinations',
] as const

export const COMMAND_DESTINATIONS: readonly CommandDestination[] = [
  'dashboard',
  'workspace',
  'chat',
  'voice',
  'knowledge',
  'books',
  'trips',
  'hotels',
  'flights',
  'documents',
  'settings',
  'notifications',
] as const

export const RESULT_COLLECTIONS: readonly ResultCollection[] = [
  'pinned',
  'favorites',
  'recent',
  'suggested',
  'frequently_used',
] as const

export const PALETTE_FILTERS: readonly PaletteFilterId[] = [
  'trips',
  'travelers',
  'flights',
  'hotels',
  'documents',
  'messages',
  'voice',
  'knowledge',
  'books',
  'settings',
] as const

export const RESULT_LAYOUTS: readonly ResultLayout[] = [
  'card',
  'list',
  'grid',
  'grouped',
] as const

/** Isolation: presentation-only command palette — navigation targets are labels only. */
export const COMMAND_PALETTE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoBooking: false,
  wiredIntoChat: false,
  wiredIntoVoice: false,
  wiredIntoKnowledge: false,
  backend: false,
  realtimeSearch: false,
  aiSearch: false,
  indexing: false,
  apiCalls: false,
} as const
