/**
 * Integration Sprint 10 — future live alert provider abstraction (not enabled).
 * Airline / hotel / weather alerts — no live APIs yet.
 */

import type { LiveDisruptionAlert, LiveDisruptionAlertProvider } from './types'

/** Mock provider — always empty live feed; ready for future adapters. */
export class MockLiveDisruptionAlertProvider implements LiveDisruptionAlertProvider {
  readonly providerId = 'mock_disruption_alerts'
  readonly live = false

  async poll(): Promise<LiveDisruptionAlert[]> {
    return []
  }
}

export function createMockLiveDisruptionAlertProvider(): LiveDisruptionAlertProvider {
  return new MockLiveDisruptionAlertProvider()
}

export interface FutureLiveAlertCapabilities {
  airlineAlerts: false
  hotelAlerts: false
  weatherAlerts: false
}

export const FUTURE_LIVE_ALERT_CAPABILITIES: FutureLiveAlertCapabilities = {
  airlineAlerts: false,
  hotelAlerts: false,
  weatherAlerts: false,
}
