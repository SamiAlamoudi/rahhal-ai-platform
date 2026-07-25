/**
 * Phase 4 Stage 8 — Universal Search & Command Palette barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime Coordinator, Booking, Chat, Voice, or Knowledge.
 * Gated by `ui.command_palette` (default OFF).
 */

import { COMMAND_PALETTE_ISOLATION as CP_ISOLATION } from './types'

export {
  COMMAND_PALETTE_FEATURE_ID,
  isCommandPaletteEnabled,
  CommandPaletteRegistry,
} from './commandPaletteRegistry'

export type {
  CommandPaletteLocale,
  CommandPaletteTheme,
  SearchDomain,
  CommandDestination,
  ResultCollection,
  PaletteFilterId,
  ResultLayout,
  PaletteEmptyState,
  PaletteItemKind,
  PaletteItem,
  CommandPaletteUiState,
} from './types'

export {
  SEARCH_DOMAINS,
  COMMAND_DESTINATIONS,
  RESULT_COLLECTIONS,
  PALETTE_FILTERS,
  RESULT_LAYOUTS,
  COMMAND_PALETTE_ISOLATION,
} from './types'

export {
  PALETTE_TOKENS,
  paletteTokenCssVariables,
} from './design/paletteTokens'

export {
  createDemoPaletteItems,
  createInitialCommandPaletteState,
  filterPaletteItems,
  resolveEmptyState,
  assertCommandPaletteIsolation,
} from './state/commandPaletteState'

export {
  CommandPalette,
  tryRenderCommandPalette,
} from './components/CommandPalette'
export type { CommandPaletteProps } from './components/CommandPalette'
export { PaletteFilters } from './components/PaletteFilters'
export { PaletteResults } from './components/PaletteResults'
export { PaletteEmpty } from './components/PaletteEmpty'

export const COMMAND_PALETTE_ARCHITECTURE = {
  version: '4.8.0-command-palette',
  featureId: 'ui.command_palette' as const,
  presentationOnly: true,
  regions: [
    'global_search',
    'command_list',
    'filters',
    'recent_collections',
    'result_layouts',
    'empty_states',
    'shortcut_placeholders',
  ] as const,
  ...CP_ISOLATION,
} as const
