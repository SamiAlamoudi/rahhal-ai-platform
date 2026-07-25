import { isCommandPaletteEnabled } from '../commandPaletteRegistry'
import type {
  CommandDestination,
  CommandPaletteLocale,
  CommandPaletteTheme,
  CommandPaletteUiState,
  PaletteFilterId,
  PaletteItem,
  SearchDomain,
} from '../types'
import {
  COMMAND_DESTINATIONS,
  COMMAND_PALETTE_ISOLATION,
  SEARCH_DOMAINS,
} from '../types'

const COMMAND_LABELS: Record<CommandDestination, { ar: string; en: string }> = {
  dashboard: { ar: 'الذهاب للوحة', en: 'Go to Dashboard' },
  workspace: { ar: 'الذهاب لمساحة السفر', en: 'Go to Workspace' },
  chat: { ar: 'الذهاب للمحادثة', en: 'Go to Chat' },
  voice: { ar: 'الذهاب للصوت', en: 'Go to Voice' },
  knowledge: { ar: 'الذهاب للمعرفة', en: 'Go to Knowledge' },
  books: { ar: 'الذهاب للكتب', en: 'Go to Books' },
  trips: { ar: 'الذهاب للرحلات', en: 'Go to Trips' },
  hotels: { ar: 'الذهاب للفنادق', en: 'Go to Hotels' },
  flights: { ar: 'الذهاب للطيران', en: 'Go to Flights' },
  documents: { ar: 'الذهاب للمستندات', en: 'Go to Documents' },
  settings: { ar: 'الذهاب للإعدادات', en: 'Go to Settings' },
  notifications: { ar: 'الذهاب للإشعارات', en: 'Go to Notifications' },
}

const DOMAIN_LABELS: Record<SearchDomain, { ar: string; en: string }> = {
  trips: { ar: 'رحلة', en: 'Trip' },
  travelers: { ar: 'مسافر', en: 'Traveler' },
  flights: { ar: 'رحلة طيران', en: 'Flight' },
  hotels: { ar: 'فندق', en: 'Hotel' },
  documents: { ar: 'مستند', en: 'Document' },
  notifications: { ar: 'إشعار', en: 'Notification' },
  history: { ar: 'سجل', en: 'History' },
  bookmarks: { ar: 'إشارة', en: 'Bookmark' },
  favorites: { ar: 'مفضلة', en: 'Favorite' },
  destinations: { ar: 'وجهة', en: 'Destination' },
}

export function createDemoPaletteItems(
  locale: CommandPaletteLocale = 'ar',
): PaletteItem[] {
  const commands: PaletteItem[] = COMMAND_DESTINATIONS.map((destination) => ({
    id: `cmd-${destination}`,
    kind: 'command',
    title:
      locale === 'en'
        ? COMMAND_LABELS[destination].en
        : COMMAND_LABELS[destination].ar,
    subtitle: destination,
    destination,
    collection: 'suggested',
    filter: mapDestinationToFilter(destination),
  }))

  const results: PaletteItem[] = [
    {
      id: 'res-trip-paris',
      kind: 'search_result',
      title: locale === 'en' ? 'Paris executive trip' : 'رحلة باريس التنفيذية',
      subtitle: '10–16 Aug',
      domain: 'trips',
      filter: 'trips',
      collection: 'recent',
      highlight: 'Paris',
      favorite: true,
    },
    {
      id: 'res-flight-sv123',
      kind: 'search_result',
      title: 'SV123 RUH → CDG',
      subtitle: locale === 'en' ? 'Flight' : 'طيران',
      domain: 'flights',
      filter: 'flights',
      collection: 'frequently_used',
      pinned: true,
    },
    {
      id: 'res-hotel',
      kind: 'search_result',
      title: 'Le Meurice',
      subtitle: locale === 'en' ? 'Hotel' : 'فندق',
      domain: 'hotels',
      filter: 'hotels',
      collection: 'favorites',
      favorite: true,
    },
    {
      id: 'res-doc',
      kind: 'search_result',
      title: locale === 'en' ? 'Visa packet' : 'ملف التأشيرة',
      subtitle: locale === 'en' ? 'Document' : 'مستند',
      domain: 'documents',
      filter: 'documents',
      collection: 'pinned',
      pinned: true,
    },
    {
      id: 'res-traveler',
      kind: 'search_result',
      title: 'سامي',
      subtitle: locale === 'en' ? 'Traveler' : 'مسافر',
      domain: 'travelers',
      filter: 'travelers',
      collection: 'recent',
    },
    {
      id: 'res-dest',
      kind: 'search_result',
      title: locale === 'en' ? 'Dubai' : 'دبي',
      subtitle: DOMAIN_LABELS.destinations[locale === 'en' ? 'en' : 'ar'],
      domain: 'destinations',
      filter: 'trips',
      collection: 'suggested',
    },
  ]

  const recent: PaletteItem[] = [
    {
      id: 'recent-1',
      kind: 'recent',
      title: locale === 'en' ? 'Recent: Paris' : 'الأخيرة: باريس',
      subtitle: 'history',
      domain: 'history',
      collection: 'recent',
    },
  ]

  return [...commands, ...results, ...recent]
}

function mapDestinationToFilter(
  destination: CommandDestination,
): PaletteFilterId | undefined {
  switch (destination) {
    case 'chat':
      return 'messages'
    case 'voice':
      return 'voice'
    case 'knowledge':
      return 'knowledge'
    case 'books':
      return 'books'
    case 'settings':
      return 'settings'
    case 'trips':
    case 'workspace':
    case 'dashboard':
      return 'trips'
    case 'hotels':
      return 'hotels'
    case 'flights':
      return 'flights'
    case 'documents':
      return 'documents'
    case 'notifications':
      return 'messages'
    default:
      return undefined
  }
}

export function createInitialCommandPaletteState(options?: {
  locale?: CommandPaletteLocale
  theme?: CommandPaletteTheme
  enabled?: boolean
  open?: boolean
}): CommandPaletteUiState {
  const locale = options?.locale ?? 'ar'
  return {
    locale,
    theme: options?.theme ?? 'light',
    open: options?.open ?? true,
    query: '',
    activeFilter: 'all',
    layout: 'list',
    emptyState: 'suggested_commands',
    items: createDemoPaletteItems(locale),
    recentQueries: ['Paris', 'SV123', 'Visa'],
    featureEnabled: isCommandPaletteEnabled({ enabled: options?.enabled }),
  }
}

export function filterPaletteItems(
  items: PaletteItem[],
  query: string,
  filter: PaletteFilterId | 'all',
): PaletteItem[] {
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    if (filter !== 'all') {
      if (item.filter && item.filter !== filter) return false
      if (!item.filter && item.domain && item.domain !== (filter as string)) {
        // allow domain match for search results without explicit filter
        if (item.domain !== filter) return false
      }
    }
    if (!q) return true
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      (item.highlight?.toLowerCase().includes(q) ?? false) ||
      (item.destination?.includes(q) ?? false) ||
      (item.domain?.includes(q) ?? false)
    )
  })
}

export function resolveEmptyState(
  query: string,
  visibleCount: number,
): CommandPaletteUiState['emptyState'] {
  if (query.trim() && visibleCount === 0) return 'no_results'
  if (!query.trim() && visibleCount === 0) return 'recent_searches'
  if (!query.trim()) return 'suggested_commands'
  return 'suggested_commands'
}

export function assertCommandPaletteIsolation(): typeof COMMAND_PALETTE_ISOLATION & {
  presentationOnly: boolean
  navigationLabelsOnly: boolean
} {
  return {
    ...COMMAND_PALETTE_ISOLATION,
    presentationOnly: true,
    navigationLabelsOnly: true,
  }
}

export { SEARCH_DOMAINS, COMMAND_DESTINATIONS }
