/**
 * Resolve a short airline code and optional logo URL.
 * Uses a public IATA logo CDN when a 2-letter code is known; falls back to null.
 */

export function extractAirlineCode(airlineNameOrCode: string, flightNumber?: string): string {
  const fromFlight = flightNumber?.match(/^([A-Z0-9]{2})\d/i)?.[1]
  if (fromFlight) return fromFlight.toUpperCase()

  const trimmed = airlineNameOrCode.trim()
  if (/^[A-Z0-9]{2}$/i.test(trimmed)) return trimmed.toUpperCase()

  const known: Record<string, string> = {
    saudia: 'SV',
    'saudi arabian': 'SV',
    qatar: 'QR',
    'qatar airways': 'QR',
    emirates: 'EK',
    etihad: 'EY',
    'etihad airways': 'EY',
    jal: 'JL',
    'japan airlines': 'JL',
    turkish: 'TK',
    'turkish airlines': 'TK',
    lufthansa: 'LH',
    'british airways': 'BA',
    airfrance: 'AF',
    'air france': 'AF',
  }
  const key = trimmed.toLowerCase()
  if (known[key]) return known[key]

  const letters = trimmed.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()
  return letters || 'XX'
}

/** Optional logo CDN — UI must handle load errors with initials fallback. */
export function airlineLogoUrl(code: string): string | null {
  if (!code || code === 'XX' || code.length !== 2) return null
  return `https://pics.avs.io/64/64/${code.toUpperCase()}.png`
}
