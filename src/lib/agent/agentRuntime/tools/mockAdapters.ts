/**
 * Phase 6 — Mock tool adapters only. No network. No production keys.
 */

import type { ToolAdapter, ToolAdapterRequest, ToolAdapterResult } from './types'

function ok(
  toolId: ToolAdapterResult['toolId'],
  summary: string,
  payload: Record<string, unknown> = {},
): ToolAdapterResult {
  return { toolId, status: 'completed', summary, payload }
}

export const FlightSearchAdapter: ToolAdapter = {
  toolId: 'flights',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    const dest = req.memory.destination ?? 'destination'
    return ok('flights', `Mock flights shortlist for ${dest}`, {
      offers: 3,
      destination: dest,
      estimateOnly: true,
    })
  },
}

export const HotelSearchAdapter: ToolAdapter = {
  toolId: 'hotels',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    const dest = req.memory.destination ?? 'city'
    const vibe = req.memory.hotelPreferences[0] ?? 'central'
    return ok('hotels', `Mock hotels in ${dest} (${vibe})`, {
      stays: 3,
      preference: vibe,
      estimateOnly: true,
    })
  },
}

export const WeatherAdapter: ToolAdapter = {
  toolId: 'weather',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    const month = req.memory.monthHint ?? 'season'
    return ok('weather', `Mock weather outlook for ${month}`, {
      month,
      summary: 'mild',
      estimateOnly: true,
    })
  },
}

export const VisaAdapter: ToolAdapter = {
  toolId: 'visa',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    return ok('visa', 'Mock visa check — status unknown until verified', {
      destination: req.memory.destination,
      status: 'needs_check',
      invented: false,
    })
  },
}

export const CurrencyAdapter: ToolAdapter = {
  toolId: 'currency',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    const amount = req.memory.budgetAmount
    return ok('currency', 'Mock FX snapshot (estimate)', {
      budgetAmount: amount,
      currency: req.memory.currency ?? 'SAR',
      estimateOnly: true,
    })
  },
}

export const MapsAdapter: ToolAdapter = {
  toolId: 'maps',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    return ok('maps', `Mock map context for ${req.memory.destination ?? 'area'}`, {
      destination: req.memory.destination,
    })
  },
}

export const RestaurantAdapter: ToolAdapter = {
  toolId: 'restaurants',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    return ok('restaurants', `Mock dining picks near ${req.memory.destination ?? 'you'}`, {
      count: 3,
    })
  },
}

export const ActivitiesAdapter: ToolAdapter = {
  toolId: 'activities',
  async execute(req: ToolAdapterRequest): Promise<ToolAdapterResult> {
    return ok('activities', `Mock activities for ${req.memory.destination ?? 'trip'}`, {
      count: 4,
      purpose: req.memory.purpose,
    })
  },
}

export const MOCK_TOOL_ADAPTERS = {
  flights: FlightSearchAdapter,
  hotels: HotelSearchAdapter,
  weather: WeatherAdapter,
  visa: VisaAdapter,
  currency: CurrencyAdapter,
  maps: MapsAdapter,
  restaurants: RestaurantAdapter,
  activities: ActivitiesAdapter,
} as const
