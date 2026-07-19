/**
 * Sprint 35 — FlightStatusMonitor with provider abstraction (sandbox).
 */

import type { FlightStatusKind, FlightStatusSnapshot } from './postBookingTypes'

export interface FlightStatusProvider {
  readonly id: string
  checkStatus(input: {
    flightConfirmation: string
    origin?: string | null
    destination?: string | null
  }): Promise<FlightStatusSnapshot>
}

export class MockFlightStatusProvider implements FlightStatusProvider {
  readonly id = 'mock_flight_status'
  private readonly scenario: FlightStatusKind | 'auto'

  constructor(scenario: FlightStatusKind | 'auto' = 'auto') {
    this.scenario = scenario
  }

  async checkStatus(input: {
    flightConfirmation: string
    origin?: string | null
    destination?: string | null
  }): Promise<FlightStatusSnapshot> {
    const status =
      this.scenario === 'auto'
        ? inferStatus(input.flightConfirmation)
        : this.scenario

    const delayMinutes = status === 'delayed' ? 45 : 0
    const gate = status === 'gate_change' ? 'C22' : 'B12'
    const previousGate = status === 'gate_change' ? 'B12' : null

    return {
      providerId: this.id,
      flightConfirmation: input.flightConfirmation,
      status,
      delayMinutes,
      gate,
      previousGate,
      departureAirport: input.origin ?? null,
      arrivalAirport: input.destination ?? null,
      message: messageFor(status, delayMinutes, gate),
      checkedAt: new Date().toISOString(),
    }
  }
}

export class FlightStatusMonitor {
  private readonly provider: FlightStatusProvider

  constructor(provider: FlightStatusProvider = new MockFlightStatusProvider()) {
    this.provider = provider
  }

  async check(input: {
    flightConfirmation: string
    origin?: string | null
    destination?: string | null
  }): Promise<FlightStatusSnapshot> {
    return this.provider.checkStatus(input)
  }

  getProviderId(): string {
    return this.provider.id
  }
}

export function createFlightStatusMonitor(
  provider?: FlightStatusProvider,
): FlightStatusMonitor {
  return new FlightStatusMonitor(provider)
}

function inferStatus(confirmation: string): FlightStatusKind {
  const upper = confirmation.toUpperCase()
  if (upper.includes('DELAY')) return 'delayed'
  if (upper.includes('GATE')) return 'gate_change'
  if (upper.includes('CANCEL')) return 'cancelled'
  return 'on_time'
}

function messageFor(status: FlightStatusKind, delayMinutes: number, gate: string): string {
  switch (status) {
    case 'delayed':
      return `Flight delayed by ${delayMinutes} minutes`
    case 'gate_change':
      return `Gate changed to ${gate}`
    case 'cancelled':
      return 'Flight cancelled by airline'
    case 'landed':
      return 'Flight has landed'
    case 'diverted':
      return 'Flight diverted'
    case 'scheduled':
      return 'Flight scheduled'
    case 'on_time':
    default:
      return `Flight on time — gate ${gate}`
  }
}
