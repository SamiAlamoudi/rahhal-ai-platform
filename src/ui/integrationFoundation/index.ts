/**
 * Phase 6 Stage 1 — Integration Foundation barrel.
 *
 * Unifies presentation modules via registries, loaders, and shared chrome.
 * Not wired into production main.tsx. No AI/Runtime/APIs/business logic.
 * Gated by `ui.integration_foundation` (default OFF).
 */

import { INTEGRATION_FOUNDATION_ISOLATION as IF_ISOLATION } from './types'

export {
  INTEGRATION_FOUNDATION_FEATURE_ID,
  isIntegrationFoundationEnabled,
  IntegrationFoundationRegistry,
} from './integrationFoundationRegistry'

export type {
  IntegrationLocale,
  IntegrationTheme,
  IntegrationModuleId,
  IntegrationScreenId,
  IntegrationRouteId,
  IntegrationModuleDefinition,
  IntegrationNavItem,
  IntegrationRouteDefinition,
  IntegrationModuleStatus,
  IntegrationFoundationUiState,
} from './types'

export { INTEGRATION_FOUNDATION_ISOLATION } from './types'

export {
  INTEGRATION_MODULES,
  getIntegrationModule,
  listIntegrationModules,
  ModuleRegistry,
} from './registry/moduleRegistry'

export {
  DEVELOPER_NAV_ITEMS,
  DEMO_NAV_ITEMS,
  listDeveloperNav,
  listDemoNav,
  NavigationRegistry,
} from './registry/navigationRegistry'

export {
  INTEGRATION_ROUTES,
  getIntegrationRoute,
  listIntegrationRoutes,
  RouteRegistry,
} from './registry/routeRegistry'

export {
  FeatureFlagManager,
  listModuleFeatureIds,
  listModuleStatuses,
  readModuleFlagEnabled,
  applyLocalFlagOverride,
} from './registry/featureFlagManager'

export {
  ModuleLoader,
  loadIntegrationModule,
} from './registry/moduleLoader'
export type { ModuleLoadOptions } from './registry/moduleLoader'

export {
  LayoutManager,
  resolveLayoutChrome,
} from './layout/layoutManager'

export {
  SHARED_SPACING,
  SHARED_TYPOGRAPHY,
  SHARED_MOTION,
  SHARED_ICONS,
  ThemeRegistry,
  IconRegistry,
  integrationTokenCssVariables,
} from './design/sharedTokens'

export {
  createDemoIntegrationFoundationState,
  assertIntegrationFoundationIsolation,
} from './state/integrationFoundationState'

export {
  IntegrationFoundation,
  tryRenderIntegrationFoundation,
} from './components/IntegrationFoundation'
export type { IntegrationFoundationProps } from './components/IntegrationFoundation'

export {
  SharedEmptyState,
  SharedLoadingState,
  SharedErrorState,
} from './components/sharedStates'

export { ModulePreviewPage } from './components/ModulePreviewPage'

export {
  DeveloperNavigationScreen,
  DemoNavigationScreen,
  ModuleStatusScreen,
  FeatureFlagToggleScreen,
  DependencyGraphScreen,
  ArchitectureOverviewScreen,
} from './components/DeveloperScreens'

export const INTEGRATION_FOUNDATION_ARCHITECTURE = {
  version: '6.1.0-integration-foundation',
  featureId: 'ui.integration_foundation' as const,
  presentationOnly: true,
  regions: [
    'module_registry',
    'navigation_registry',
    'route_registry',
    'layout_manager',
    'module_loader',
    'feature_flag_manager',
    'shared_states',
    'shared_tokens',
    'developer_nav',
    'demo_nav',
    'module_preview',
    'flag_toggle',
    'module_status',
    'dependency_graph',
    'architecture_overview',
  ] as const,
  integratedModules: [
    'application_shell',
    'conversation_center',
    'voice_center',
    'travel_workspace',
    'executive_dashboard',
    'command_palette',
    'journey_timeline',
    'decision_center',
    'insights_center',
    'traveler_profile',
    'memory_center',
    'booking_hub',
    'operations_center',
  ] as const,
  ...IF_ISOLATION,
} as const
