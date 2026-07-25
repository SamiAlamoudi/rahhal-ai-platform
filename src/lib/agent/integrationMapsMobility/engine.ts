/**
 * Integration Sprint 8 — Maps & Live Mobility engine.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationMapsLiveEnabled, isIntegrationMapsMobilityEnabled } from './feature'
import { createMockMapProvider } from './mockProvider'
import { createLiveGoogleMapsProvider } from './liveAdapter'
import {
  detectMapsMobilityIntent,
  detectMobilityMode,
  extractRouteEndpoints,
} from './intents'
import { resolvePlaces, toSpatialContext } from './spatial'
import { buildMapsMobilitySummary } from './consultant'
import {
  INTEGRATION_MAPS_MOBILITY_VERSION,
  type MapProvider,
  type MapsMobilityResult,
  type MobilityMode,
  type MobilityRoute,
} from './types'

export interface MapsMobilityDeps {
  enabled?: boolean
  liveEnabled?: boolean
  provider?: MapProvider
  now?: Date
  coords?: { lat: number; lng: number } | null
  arriveByIso?: string | null
}

export interface RunMapsMobilityInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  locale?: AgentLocale
  deps?: MapsMobilityDeps
}

function disabled(latencyMs: number): MapsMobilityResult {
  return {
    version: INTEGRATION_MAPS_MOBILITY_VERSION,
    enabled: false,
    ok: false,
    live: false,
    intent: 'unknown',
    spatial: {
      origin: null,
      destination: null,
      currentLabelEn: null,
      currentLabelAr: null,
      city: null,
    },
    origin: null,
    destination: null,
    route: null,
    alternatives: [],
    nearby: [],
    consultantSummaryEn: '',
    consultantSummaryAr: '',
    latencyMs,
    logs: ['maps_mobility_disabled'],
  }
}

function pickProvider(deps?: MapsMobilityDeps): MapProvider {
  if (deps?.provider) return deps.provider
  if (isIntegrationMapsLiveEnabled({ liveEnabled: deps?.liveEnabled })) {
    return createLiveGoogleMapsProvider()
  }
  return createMockMapProvider()
}

async function buildAlternatives(
  provider: MapProvider,
  from: NonNullable<MapsMobilityResult['origin']>,
  to: NonNullable<MapsMobilityResult['destination']>,
  primaryMode: MobilityMode,
  arriveByIso: string | null,
): Promise<MobilityRoute[]> {
  const modes: MobilityMode[] = ['walking', 'transit', 'driving', 'taxi']
  const alts: MobilityRoute[] = []
  for (const mode of modes) {
    if (mode === primaryMode) continue
    const route = await provider.route({ from, to, mode, arriveByIso })
    if (route) alts.push(route)
  }
  return alts.slice(0, 3)
}

export async function runMapsMobility(
  input: RunMapsMobilityInput,
): Promise<MapsMobilityResult> {
  const started = Date.now()
  const enabled = isIntegrationMapsMobilityEnabled({ enabled: input.deps?.enabled })
  if (!enabled) return disabled(Date.now() - started)

  const provider = pickProvider(input.deps)
  const userText = input.userText?.trim() ?? ''
  const intent = detectMapsMobilityIntent(userText)
  const logs = [`maps_mobility_enabled`, `provider:${provider.providerId}`, `intent:${intent}`]
  const plan = input.tripPlan ?? input.memory.tripPlan
  const endpoints = extractRouteEndpoints(userText)
  const mode = detectMobilityMode(userText) ?? 'transit'
  const arriveByIso = input.deps?.arriveByIso
    ?? plan?.endDate
    ?? null

  const places = await resolvePlaces({
    plan,
    provider,
    originQuery: endpoints.from ?? null,
    destinationQuery: endpoints.to ?? null,
    coords: input.deps?.coords ?? null,
  })

  let route: MobilityRoute | null = null
  let alternatives: MobilityRoute[] = []
  let nearby = [] as MapsMobilityResult['nearby']

  const needsRoute = intent === 'how_to_get_there'
    || intent === 'eta'
    || intent === 'leave_by'
    || intent === 'route'
  const needsNearby = intent === 'nearby'
  const needsWhere = intent === 'where_am_i'

  if ((needsRoute || intent === 'unknown') && places.origin && places.destination) {
    route = await provider.route({
      from: places.origin,
      to: places.destination,
      mode,
      arriveByIso,
    })
    if (route) {
      alternatives = await buildAlternatives(
        provider,
        places.origin,
        places.destination,
        mode,
        arriveByIso,
      )
      logs.push(`route:${route.mode}:${route.durationMinutes}m`)
    }
  }

  if (needsNearby || (intent === 'unknown' && places.origin && !route)) {
    const near = places.origin ?? places.destination
    if (near) {
      nearby = await provider.nearby({
        near,
        query: /restaurant|cafe|food|مطعم|مقهى/i.test(userText) ? 'cafe' : null,
        radiusMeters: 3000,
      })
      logs.push(`nearby:${nearby.length}`)
    }
  }

  if (needsWhere && !places.origin && places.city) {
    places.origin = (await provider.geocode(places.city))[0] ?? places.origin
  }

  const spatial = toSpatialContext(places.origin, places.destination, places.city)
  const summary = buildMapsMobilitySummary({
    intent: intent === 'unknown' && route ? 'how_to_get_there' : intent === 'unknown' && nearby.length ? 'nearby' : intent,
    spatial,
    route,
    alternatives,
    nearby,
    origin: places.origin,
    destination: places.destination,
    live: provider.live,
  })

  const ok = Boolean(places.origin || places.destination || route || nearby.length)

  return {
    version: INTEGRATION_MAPS_MOBILITY_VERSION,
    enabled: true,
    ok,
    live: provider.live,
    intent: intent === 'unknown' && route
      ? 'how_to_get_there'
      : intent === 'unknown' && nearby.length
        ? 'nearby'
        : intent,
    spatial,
    origin: places.origin,
    destination: places.destination,
    route,
    alternatives,
    nearby,
    consultantSummaryEn: summary.en,
    consultantSummaryAr: summary.ar,
    latencyMs: Date.now() - started,
    logs,
  }
}
