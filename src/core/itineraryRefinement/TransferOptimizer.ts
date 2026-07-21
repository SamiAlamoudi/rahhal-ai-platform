/**
 * Sprint 84 — align airport transfers to flight arrival / departure.
 */

import type { PackageCandidate, PackageComponent } from '../packageBuilder/PackageCandidate'

export function optimizeTransfers(pkg: PackageCandidate): {
  pkg: PackageCandidate
  touchedIds: string[]
} {
  const flight = pkg.components.find((c) => c.kind === 'flight')
  const touched: string[] = []
  const arrivalAt = typeof flight?.payload.arrivalAt === 'string' ? flight.payload.arrivalAt : pkg.arrivalAt
  const returnAt = typeof flight?.payload.returnDepartureAt === 'string'
    ? flight.payload.returnDepartureAt
    : null

  let components = pkg.components.map((c) => {
    if (c.kind !== 'transfer') return c
    touched.push(c.id)
    const availableFrom = arrivalAt
      ? new Date(Date.parse(arrivalAt) - 30 * 60_000).toISOString()
      : c.payload.availableFrom
    const availableTo = arrivalAt
      ? new Date(Date.parse(arrivalAt) + 3 * 3600_000).toISOString()
      : c.payload.availableTo
    return {
      ...c,
      payload: {
        ...c.payload,
        availableFrom,
        availableTo,
        durationMinutes: Math.min(
          typeof c.payload.durationMinutes === 'number' ? c.payload.durationMinutes : 45,
          40,
        ),
        optimized: true,
      },
    }
  })

  // If no transfer but flight exists, add a lightweight optimized transfer (impacted only).
  if (flight && !components.some((c) => c.kind === 'transfer') && arrivalAt) {
    const xfer: PackageComponent = {
      kind: 'transfer',
      id: `xfer_opt_${flight.id}`,
      title: 'Airport transfer',
      price: 100,
      currency: pkg.currency,
      payload: {
        durationMinutes: 35,
        availableFrom: new Date(Date.parse(arrivalAt) - 30 * 60_000).toISOString(),
        availableTo: new Date(Date.parse(arrivalAt) + 3 * 3600_000).toISOString(),
        returnPickup: returnAt,
        optimized: true,
      },
    }
    touched.push(xfer.id)
    components = [...components, xfer]
  }

  const totalPrice = components.reduce((s, c) => s + c.price, 0)
  return { pkg: { ...pkg, components, totalPrice }, touchedIds: touched }
}
