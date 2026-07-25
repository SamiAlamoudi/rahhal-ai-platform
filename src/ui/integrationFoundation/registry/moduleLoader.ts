/**
 * Module loader — presentation-only force-render helpers.
 * Uses each package's tryRender* with enabled override for previews.
 */

import type { ReactElement } from 'react'
import { tryRenderApplicationShell } from '../../applicationShell'
import { tryRenderBookingHub } from '../../bookingHub'
import { tryRenderCommandPalette } from '../../commandPalette'
import { tryRenderConversationCenter } from '../../conversationCenter'
import { tryRenderDecisionCenter } from '../../decisionCenter'
import { tryRenderExecutiveDashboard } from '../../executiveDashboard'
import { tryRenderInsightsCenter } from '../../insightsCenter'
import { tryRenderJourneyTimeline } from '../../journeyTimeline'
import { tryRenderMemoryCenter } from '../../memoryCenter'
import { tryRenderOperationsCenter } from '../../operationsCenter'
import { tryRenderTravelerProfileCenter } from '../../travelerProfile'
import { tryRenderTravelWorkspace } from '../../travelWorkspace'
import { tryRenderVoiceCenter } from '../../voiceCenter'
import type {
  IntegrationLocale,
  IntegrationModuleId,
  IntegrationTheme,
} from '../types'

export interface ModuleLoadOptions {
  locale?: IntegrationLocale
  theme?: IntegrationTheme
  /** Force presentation preview ON regardless of registry. */
  forceEnabled?: boolean
}

export function loadIntegrationModule(
  id: IntegrationModuleId,
  options: ModuleLoadOptions = {},
): ReactElement | null {
  const enabled = options.forceEnabled ?? false
  const locale = options.locale ?? 'ar'
  const theme = options.theme ?? 'light'

  switch (id) {
    case 'application_shell':
      return tryRenderApplicationShell({
        enabled,
        initialState: {
          locale,
          themeMode: theme,
        },
      })
    case 'conversation_center':
      return tryRenderConversationCenter({ enabled, locale })
    case 'voice_center':
      return tryRenderVoiceCenter({ enabled, locale })
    case 'travel_workspace':
      return tryRenderTravelWorkspace({ enabled, locale, theme })
    case 'executive_dashboard':
      return tryRenderExecutiveDashboard({ enabled, locale, theme })
    case 'command_palette':
      return tryRenderCommandPalette({
        enabled,
        locale,
        theme,
        initialState: { open: true },
      })
    case 'journey_timeline':
      return tryRenderJourneyTimeline({ enabled, locale, theme })
    case 'decision_center':
      return tryRenderDecisionCenter({ enabled, locale, theme })
    case 'insights_center':
      return tryRenderInsightsCenter({ enabled, locale, theme })
    case 'traveler_profile':
      return tryRenderTravelerProfileCenter({ enabled, locale, theme })
    case 'memory_center':
      return tryRenderMemoryCenter({ enabled, locale, theme })
    case 'booking_hub':
      return tryRenderBookingHub({ enabled, locale, theme })
    case 'operations_center':
      return tryRenderOperationsCenter({ enabled, locale, theme })
    default:
      return null
  }
}

export const ModuleLoader = {
  load: loadIntegrationModule,
}
