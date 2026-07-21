/**
 * Sprint 83 — generate complete travel packages from normalized offers.
 */

import { evaluateCompatibility } from './CompatibilityEngine'
import { attachConfidence } from './PackageConfidence'
import { explainSelectedPackages } from './PackageExplainer'
import { optimizePackagesParallel } from './PackageOptimizer'
import { pickLabeledPackages, rankPackages } from './PackageRanking'
import { scorePackagesParallel } from './PackageScorer'
import { emitPackageEvent, type PackageEvent } from './events'
import {
  SPRINT83_DYNAMIC_PACKAGES_VERSION,
  type NormalizedActivityOffer,
  type NormalizedAddonOffer,
  type NormalizedFlightOffer,
  type NormalizedHotelOffer,
  type NormalizedTransferOffer,
  type PackageBuilderInput,
  type PackageCandidate,
  type PackageComponent,
} from './PackageCandidate'

export interface PackageBuilderResult {
  version: string
  packages: PackageCandidate[]
  ranked: PackageCandidate[]
  selected: PackageCandidate | null
  labels: ReturnType<typeof pickLabeledPackages>
  duplicateCount: number
  filteredCount: number
  events: PackageEvent[]
  durationMs: number
}

function money(components: PackageComponent[]): { total: number; currency: string } {
  const currency = components[0]?.currency ?? 'SAR'
  const total = components.reduce((s, c) => s + c.price, 0)
  return { total, currency }
}

function buildPackageId(parts: string[]): string {
  return `pkg_${parts.join('_')}`.slice(0, 120)
}

function flightComponent(f: NormalizedFlightOffer): PackageComponent {
  return {
    kind: 'flight',
    id: f.id,
    title: `${f.airline} ${f.origin ?? ''}→${f.destination ?? ''}`.trim(),
    price: f.price,
    currency: f.currency,
    payload: {
      durationMinutes: f.durationMinutes,
      stops: f.stops,
      cabin: f.cabin,
      refundable: f.refundable,
      loyaltyMatch: f.loyaltyMatch,
      arrivalAt: f.arrivalAt,
      departureAt: f.departureAt,
    },
  }
}

function hotelComponent(h: NormalizedHotelOffer): PackageComponent {
  return {
    kind: 'hotel',
    id: h.id,
    title: h.name,
    price: h.price,
    currency: h.currency,
    payload: {
      stars: h.stars,
      rating: h.rating,
      walkMinutes: h.walkMinutes,
      familyFriendly: h.familyFriendly,
      refundable: h.refundable,
      breakfastIncluded: h.breakfastIncluded,
      luxury: h.luxury,
      businessFriendly: h.businessFriendly,
      checkIn: h.checkIn,
      checkOut: h.checkOut,
    },
  }
}

function transferComponent(t: NormalizedTransferOffer): PackageComponent {
  return {
    kind: 'transfer',
    id: t.id,
    title: t.title,
    price: t.price,
    currency: t.currency,
    payload: {
      durationMinutes: t.durationMinutes,
      availableFrom: t.availableFrom,
      availableTo: t.availableTo,
    },
  }
}

function activityComponent(a: NormalizedActivityOffer): PackageComponent {
  return {
    kind: 'activity',
    id: a.id,
    title: a.title,
    price: a.price,
    currency: a.currency,
    payload: {
      startAt: a.startAt,
      endAt: a.endAt,
      quality: a.quality,
      familyFriendly: a.familyFriendly,
    },
  }
}

function addonComponent(a: NormalizedAddonOffer): PackageComponent {
  return {
    kind: a.kind,
    id: a.id,
    title: a.title,
    price: a.price,
    currency: a.currency,
    payload: { ...a.payload },
  }
}

function providerConfidence(
  flight: NormalizedFlightOffer,
  hotel: NormalizedHotelOffer,
  extras: Array<{ providerConfidence: number }>,
): number {
  const vals = [flight.providerConfidence, hotel.providerConfidence, ...extras.map((e) => e.providerConfidence)]
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** Generate raw package candidates (compatibility tagged). */
export function generatePackageCandidates(input: PackageBuilderInput): PackageCandidate[] {
  const flights = input.flights
  const hotels = input.hotels
  const transfers = input.transfers ?? []
  const activities = input.activities ?? []
  const addons = input.addons ?? []
  const max = input.maxCandidates ?? 60

  const transferOptions: Array<NormalizedTransferOffer | null> = transfers.length
    ? transfers
    : [null]
  const activityOptions: NormalizedActivityOffer[][] = activities.length
    ? activities.map((a) => [a]).concat([[]])
    : [[]]
  // Cap activity combos
  const activityCombos = activityOptions.slice(0, 8)
  const addonCombos: NormalizedAddonOffer[][] = [[]]
  for (const addon of addons.slice(0, 4)) {
    addonCombos.push([addon])
  }

  const out: PackageCandidate[] = []
  for (const flight of flights) {
    for (const hotel of hotels) {
      for (const transfer of transferOptions) {
        for (const acts of activityCombos) {
          for (const ads of addonCombos) {
            if (out.length >= max * 3) break
            const compat = evaluateCompatibility({
              flight,
              hotel,
              transfer,
              activities: acts,
              expectedDestination: hotel.destination ?? flight.destination,
            })
            const components: PackageComponent[] = [
              flightComponent(flight),
              hotelComponent(hotel),
            ]
            if (transfer) components.push(transferComponent(transfer))
            for (const a of acts) components.push(activityComponent(a))
            for (const a of ads) components.push(addonComponent(a))

            const { total, currency } = money(components)
            const rejectionReasons = [...compat.rejectionReasons]
            let compatible = compat.compatible
            if (input.budgetCap != null && total > input.budgetCap * 1.35) {
              rejectionReasons.push('over budget')
              compatible = false
            }

            const extras = [
              ...(transfer ? [transfer] : []),
              ...acts,
              ...ads,
            ]
            const id = buildPackageId([
              flight.id,
              hotel.id,
              transfer?.id ?? 'noxfer',
              acts.map((a) => a.id).join('-') || 'noact',
              ads.map((a) => a.id).join('-') || 'noadd',
            ])
            const title = `${flight.airline} + ${hotel.name}`
            const pkg: PackageCandidate = {
              id,
              title,
              currency,
              totalPrice: total,
              components,
              destination: hotel.destination ?? flight.destination,
              checkIn: hotel.checkIn,
              checkOut: hotel.checkOut,
              arrivalAt: flight.arrivalAt,
              departureAt: flight.departureAt,
              score: null,
              dimensions: null,
              confidence: 0,
              labels: [],
              reasons: [],
              explanation: null,
              compatible,
              rejectionReasons,
              normalizedKey: '',
              providerConfidence: providerConfidence(flight, hotel, extras),
            }
            pkg.normalizedKey = pkg.components.map((c) => `${c.kind}:${c.id}`).sort().join('|')
            out.push(pkg)
          }
        }
      }
    }
  }
  return out
}

export async function generatePackageCandidatesParallel(
  input: PackageBuilderInput,
): Promise<PackageCandidate[]> {
  const flights = input.flights
  if (flights.length === 0 || input.hotels.length === 0) return []

  // Shard by flight for parallel generation.
  const shards = await Promise.all(
    flights.map(async (flight) => generatePackageCandidates({
      ...input,
      flights: [flight],
      maxCandidates: input.maxCandidates,
    })),
  )
  return shards.flat()
}

export class PackageBuilder {
  async build(input: PackageBuilderInput): Promise<PackageBuilderResult> {
    const started = Date.now()
    const events: PackageEvent[] = []

    const raw = await generatePackageCandidatesParallel(input)
    for (const pkg of raw.slice(0, 40)) {
      emitPackageEvent('package.created', { packageId: pkg.id, compatible: pkg.compatible }, events)
    }

    const scored = await scorePackagesParallel(
      raw,
      undefined,
      input.preferenceBiases,
      input.priceTimingBoost,
    )
    for (const pkg of scored.slice(0, 40)) {
      emitPackageEvent('package.scored', { packageId: pkg.id, score: pkg.score }, events)
    }

    const beforeOptimize = scored.length
    const optimized = await optimizePackagesParallel(scored, {
      keepTop: input.maxCandidates ?? 24,
      events,
    })

    const withConfidence = optimized.packages.map(attachConfidence)
    const { ranked } = rankPackages(withConfidence, {
      isWeekend: input.isWeekend,
      events,
    })

    const labels = pickLabeledPackages(ranked)
    const selected = labels.bestOverall
    const selectedIds = new Set(
      [
        labels.bestOverall,
        labels.bestBudget,
        labels.bestBusiness,
        labels.bestFamily,
        labels.bestLuxury,
        labels.bestWeekend,
        labels.bestValue,
      ].filter(Boolean).map((p) => p!.id),
    )

    // Lazy explanation only for labeled packages.
    const explained = explainSelectedPackages(ranked, selectedIds)

    if (selected) {
      emitPackageEvent('package.selected', {
        packageId: selected.id,
        score: selected.score,
        confidence: selected.confidence,
        labels: selected.labels,
      }, events)
    }

    return {
      version: SPRINT83_DYNAMIC_PACKAGES_VERSION,
      packages: explained,
      ranked: explained,
      selected: explained.find((p) => p.id === selected?.id) ?? null,
      labels: {
        bestOverall: explained.find((p) => p.labels.includes('best_overall')) ?? null,
        bestBudget: explained.find((p) => p.labels.includes('best_budget')) ?? null,
        bestBusiness: explained.find((p) => p.labels.includes('best_business')) ?? null,
        bestFamily: explained.find((p) => p.labels.includes('best_family')) ?? null,
        bestLuxury: explained.find((p) => p.labels.includes('best_luxury')) ?? null,
        bestWeekend: explained.find((p) => p.labels.includes('best_weekend')) ?? null,
        bestValue: explained.find((p) => p.labels.includes('best_value')) ?? null,
      },
      duplicateCount: optimized.duplicateCount,
      filteredCount: Math.max(0, beforeOptimize - explained.length),
      events,
      durationMs: Date.now() - started,
    }
  }
}

export function createPackageBuilder(): PackageBuilder {
  return new PackageBuilder()
}

export async function runPackageBuilder(
  input: PackageBuilderInput,
): Promise<PackageBuilderResult> {
  return createPackageBuilder().build(input)
}

/**
 * Adaptive Learning re-rank — boost packages matching learned preferences.
 * Does not mutate Decision Engine contracts.
 */
export function rerankPackagesWithPreferences(
  packages: PackageCandidate[],
  biases?: PackageBuilderInput['preferenceBiases'],
): PackageCandidate[] {
  if (!biases) return packages
  return [...packages]
    .map((pkg) => {
      let delta = 0
      if (biases.luxury) delta += (pkg.dimensions?.luxury_level ?? 0) * biases.luxury * 0.02
      if (biases.family) delta += (pkg.dimensions?.family_suitability ?? 0) * biases.family * 0.02
      if (biases.price) delta += (pkg.dimensions?.total_cost ?? 0) * biases.price * 0.02
      if (biases.walkability) {
        delta += (pkg.dimensions?.walking_distance ?? 0) * biases.walkability * 0.02
      }
      if (biases.comfort) {
        delta += (pkg.dimensions?.business_suitability ?? 0) * biases.comfort * 0.015
      }
      return {
        ...pkg,
        score: Math.round(((pkg.score ?? 0) + delta) * 10) / 10,
      }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.totalPrice - b.totalPrice)
}
