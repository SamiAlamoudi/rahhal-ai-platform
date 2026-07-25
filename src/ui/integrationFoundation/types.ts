/**
 * Phase 6 Stage 1 — Integration Foundation contracts.
 * Presentation architecture only. No AI, Runtime, APIs, or business logic.
 */

export type IntegrationLocale = 'ar' | 'en'
export type IntegrationTheme = 'light' | 'dark'

export type IntegrationModuleId =
  | 'application_shell'
  | 'conversation_center'
  | 'voice_center'
  | 'travel_workspace'
  | 'executive_dashboard'
  | 'command_palette'
  | 'journey_timeline'
  | 'decision_center'
  | 'insights_center'
  | 'traveler_profile'
  | 'memory_center'
  | 'booking_hub'
  | 'operations_center'

export type IntegrationScreenId =
  | 'developer_nav'
  | 'demo_nav'
  | 'module_preview'
  | 'feature_flags'
  | 'module_status'
  | 'dependency_graph'
  | 'architecture_overview'

export type IntegrationRouteId =
  | 'dev.home'
  | 'dev.modules'
  | 'dev.module_preview'
  | 'dev.flags'
  | 'dev.status'
  | 'dev.graph'
  | 'dev.architecture'
  | 'demo.home'

export interface IntegrationModuleDefinition {
  id: IntegrationModuleId
  featureId: string
  nameAr: string
  nameEn: string
  phase: string
  dependsOn: readonly string[]
  presentationOnly: true
  packagePath: string
}

export interface IntegrationNavItem {
  id: string
  routeId: IntegrationRouteId
  labelAr: string
  labelEn: string
  moduleId?: IntegrationModuleId
  screenId: IntegrationScreenId
}

export interface IntegrationRouteDefinition {
  id: IntegrationRouteId
  path: string
  screenId: IntegrationScreenId
  moduleId?: IntegrationModuleId
  titleAr: string
  titleEn: string
}

export interface IntegrationModuleStatus {
  id: IntegrationModuleId
  featureId: string
  registered: boolean
  flagEnabled: boolean
  presentationOnly: boolean
  dependsOn: readonly string[]
}

export interface IntegrationFoundationUiState {
  locale: IntegrationLocale
  theme: IntegrationTheme
  activeScreen: IntegrationScreenId
  activeRouteId: IntegrationRouteId
  previewModuleId: IntegrationModuleId | null
  localFlagOverrides: Partial<Record<string, boolean>>
  featureEnabled: boolean
}

export const INTEGRATION_FOUNDATION_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntime: false,
  wiredIntoRealtime: false,
  wiredIntoAuthentication: false,
  wiredIntoFirebase: false,
  wiredIntoDatabase: false,
  wiredIntoApis: false,
  wiredIntoBooking: false,
  wiredIntoPayments: false,
  wiredIntoMaps: false,
  wiredIntoNotifications: false,
  wiredIntoSearchBackend: false,
  businessLogic: false,
  serviceLayer: false,
  apiLayer: false,
} as const
