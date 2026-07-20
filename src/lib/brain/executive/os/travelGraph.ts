/**
 * Sprint 52 — Travel Graph Engine foundation.
 * Reusable graph of destinations, regions, airports, hotels, airlines, activities.
 */

import { DESTINATION_CATALOG } from '../../../agent/reasoning/destinationCatalog'
import { cacheWrap } from './computationCache'
import { buildDestinationIntelligence } from './globalKnowledge'

export type TravelGraphNodeKind =
  | 'destination'
  | 'region'
  | 'airport'
  | 'climate'
  | 'hotel'
  | 'airline'
  | 'activity'
  | 'visa_regime'

export interface TravelGraphNode {
  id: string
  kind: TravelGraphNodeKind
  label: string
  meta: Record<string, unknown>
}

export interface TravelGraphEdge {
  from: string
  to: string
  relation:
    | 'in_region'
    | 'similar_climate'
    | 'similar_cost'
    | 'visa_peer'
    | 'short_haul'
    | 'has_hotel'
    | 'served_by'
    | 'offers_activity'
    | 'visa_agreement'
  weight: number
}

export interface TravelGraph {
  nodes: TravelGraphNode[]
  edges: TravelGraphEdge[]
}

export function buildTravelGraph(month?: number | null): TravelGraph {
  const key = `travel-graph:${month ?? 'now'}`
  return cacheWrap(key, 120_000, () => {
    const nodes: TravelGraphNode[] = []
    const edges: TravelGraphEdge[] = []
    const regions = new Set<string>()

    for (const profile of DESTINATION_CATALOG) {
      const intel = buildDestinationIntelligence(profile, month)
      nodes.push({
        id: `dest:${profile.id}`,
        kind: 'destination',
        label: profile.nameEn,
        meta: {
          region: profile.region,
          visa: profile.visaFromSaudi,
          cost: intel.averageDailyCostSar,
          climate: intel.weather,
        },
      })
      nodes.push({
        id: `airport:${profile.id}`,
        kind: 'airport',
        label: `${profile.nameEn} Airport`,
        meta: { quality: intel.airportQuality, hours: profile.flightHoursFromRiyadh },
      })
      edges.push({
        from: `dest:${profile.id}`,
        to: `airport:${profile.id}`,
        relation: 'short_haul',
        weight: intel.flightAccessibility,
      })

      const regionId = `region:${profile.region}`
      if (!regions.has(profile.region)) {
        regions.add(profile.region)
        nodes.push({
          id: regionId,
          kind: 'region',
          label: profile.region,
          meta: {},
        })
      }
      edges.push({
        from: `dest:${profile.id}`,
        to: regionId,
        relation: 'in_region',
        weight: 1,
      })

      nodes.push({
        id: `climate:${intel.weather}:${profile.id}`,
        kind: 'climate',
        label: intel.weather,
        meta: { destination: profile.id },
      })

      const visaId = `visa:${profile.visaFromSaudi}`
      if (!nodes.some((n) => n.id === visaId)) {
        nodes.push({
          id: visaId,
          kind: 'visa_regime',
          label: profile.visaFromSaudi,
          meta: {},
        })
      }
      edges.push({
        from: `dest:${profile.id}`,
        to: visaId,
        relation: 'visa_agreement',
        weight: intel.visa === 'visa_free' ? 1 : intel.visa === 'evisa' ? 0.7 : 0.4,
      })

      const hotelId = `hotel:${profile.id}:${intel.luxuryScore >= 0.7 ? 'luxury' : 'standard'}`
      nodes.push({
        id: hotelId,
        kind: 'hotel',
        label: intel.luxuryScore >= 0.7 ? `${profile.nameEn} Luxury Stay` : `${profile.nameEn} Stay`,
        meta: { luxury: intel.luxuryScore },
      })
      edges.push({
        from: `dest:${profile.id}`,
        to: hotelId,
        relation: 'has_hotel',
        weight: intel.luxuryScore,
      })

      const airlineId = 'airline:saudia'
      if (!nodes.some((n) => n.id === airlineId)) {
        nodes.push({
          id: airlineId,
          kind: 'airline',
          label: 'Saudia',
          meta: { hub: 'RUH' },
        })
      }
      edges.push({
        from: `dest:${profile.id}`,
        to: airlineId,
        relation: 'served_by',
        weight: intel.flightAccessibility,
      })

      for (const tag of profile.bestFor) {
        const activityId = `activity:${tag}`
        if (!nodes.some((n) => n.id === activityId)) {
          nodes.push({
            id: activityId,
            kind: 'activity',
            label: tag,
            meta: {},
          })
        }
        edges.push({
          from: `dest:${profile.id}`,
          to: activityId,
          relation: 'offers_activity',
          weight: 0.8,
        })
      }
    }

    // Affinity edges between destinations.
    for (let i = 0; i < DESTINATION_CATALOG.length; i++) {
      for (let j = i + 1; j < DESTINATION_CATALOG.length; j++) {
        const a = DESTINATION_CATALOG[i]!
        const b = DESTINATION_CATALOG[j]!
        const ia = buildDestinationIntelligence(a, month)
        const ib = buildDestinationIntelligence(b, month)

        if (ia.weather === ib.weather) {
          edges.push({
            from: `dest:${a.id}`,
            to: `dest:${b.id}`,
            relation: 'similar_climate',
            weight: 0.8,
          })
        }
        if (Math.abs(ia.averageDailyCostSar - ib.averageDailyCostSar) <= 200) {
          edges.push({
            from: `dest:${a.id}`,
            to: `dest:${b.id}`,
            relation: 'similar_cost',
            weight: 0.7,
          })
        }
        if (a.visaFromSaudi === b.visaFromSaudi) {
          edges.push({
            from: `dest:${a.id}`,
            to: `dest:${b.id}`,
            relation: 'visa_peer',
            weight: 0.6,
          })
        }
        if (Math.abs(a.flightHoursFromRiyadh - b.flightHoursFromRiyadh) <= 2) {
          edges.push({
            from: `dest:${a.id}`,
            to: `dest:${b.id}`,
            relation: 'short_haul',
            weight: 0.65,
          })
        }
      }
    }

    return { nodes, edges }
  })
}

export function relatedDestinations(
  destinationId: string,
  relation: TravelGraphEdge['relation'],
  limit = 5,
): string[] {
  const graph = buildTravelGraph()
  const nodeId = destinationId.startsWith('dest:') ? destinationId : `dest:${destinationId}`
  return graph.edges
    .filter((edge) => edge.relation === relation && (edge.from === nodeId || edge.to === nodeId))
    .sort((a, b) => b.weight - a.weight)
    .map((edge) => (edge.from === nodeId ? edge.to : edge.from).replace(/^dest:/, ''))
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, limit)
}
