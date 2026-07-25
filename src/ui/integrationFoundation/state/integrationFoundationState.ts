import { isIntegrationFoundationEnabled } from '../integrationFoundationRegistry'
import type {
  IntegrationFoundationUiState,
  IntegrationLocale,
  IntegrationTheme,
} from '../types'
import { INTEGRATION_FOUNDATION_ISOLATION } from '../types'

export function createDemoIntegrationFoundationState(options?: {
  locale?: IntegrationLocale
  theme?: IntegrationTheme
  enabled?: boolean
}): IntegrationFoundationUiState {
  return {
    locale: options?.locale ?? 'ar',
    theme: options?.theme ?? 'light',
    activeScreen: 'developer_nav',
    activeRouteId: 'dev.home',
    previewModuleId: null,
    localFlagOverrides: {},
    featureEnabled: isIntegrationFoundationEnabled({
      enabled: options?.enabled,
    }),
  }
}

export function assertIntegrationFoundationIsolation(): typeof INTEGRATION_FOUNDATION_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...INTEGRATION_FOUNDATION_ISOLATION,
    presentationOnly: true,
  }
}
