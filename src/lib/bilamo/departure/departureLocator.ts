/**
 * Smart departure — browser geolocation → nearest airport, with local recall.
 * Never asks for origin when a default is known.
 */

export type BilamoDepartureAirport = {
  code: string
  cityAr: string
  cityEn: string
  lat: number
  lon: number
}

export const BILAMO_DEPARTURE_AIRPORTS: BilamoDepartureAirport[] = [
  { code: 'RUH', cityAr: 'الرياض', cityEn: 'Riyadh', lat: 24.9576, lon: 46.6988 },
  { code: 'JED', cityAr: 'جدة', cityEn: 'Jeddah', lat: 21.6796, lon: 39.1565 },
  { code: 'DMM', cityAr: 'الدمام', cityEn: 'Dammam', lat: 26.4712, lon: 49.7979 },
  { code: 'AHB', cityAr: 'أبها', cityEn: 'Abha', lat: 18.2404, lon: 42.6566 },
  { code: 'MED', cityAr: 'المدينة', cityEn: 'Madinah', lat: 24.5534, lon: 39.7051 },
  { code: 'DXB', cityAr: 'دبي', cityEn: 'Dubai', lat: 25.2532, lon: 55.3657 },
  { code: 'AUH', cityAr: 'أبوظبي', cityEn: 'Abu Dhabi', lat: 24.4330, lon: 54.6511 },
  { code: 'BAH', cityAr: 'المنامة', cityEn: 'Manama', lat: 26.2708, lon: 50.6336 },
  { code: 'DOH', cityAr: 'الدوحة', cityEn: 'Doha', lat: 25.2731, lon: 51.6081 },
  { code: 'KWI', cityAr: 'الكويت', cityEn: 'Kuwait', lat: 29.2266, lon: 47.9689 },
]

const STORAGE_KEY = 'bilamo.departureAirport'

export type DepartureResolution = {
  airport: BilamoDepartureAirport
  source: 'geolocation' | 'remembered' | 'none'
  assumptionLineAr: string
  assumptionLineEn: string
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function nearestAirport(lat: number, lon: number): BilamoDepartureAirport {
  let best = BILAMO_DEPARTURE_AIRPORTS[0]!
  let bestKm = Number.POSITIVE_INFINITY
  for (const airport of BILAMO_DEPARTURE_AIRPORTS) {
    const km = haversineKm({ lat, lon }, airport)
    if (km < bestKm) {
      bestKm = km
      best = airport
    }
  }
  return best
}

export function airportByCode(code: string | null | undefined): BilamoDepartureAirport | null {
  if (!code) return null
  const key = code.trim().toUpperCase()
  return BILAMO_DEPARTURE_AIRPORTS.find((a) => a.code === key) ?? null
}

export function airportFromCityName(city: string | null | undefined): BilamoDepartureAirport | null {
  if (!city) return null
  const key = city.trim().toLowerCase()
  return BILAMO_DEPARTURE_AIRPORTS.find((a) =>
    a.code.toLowerCase() === key
    || a.cityAr.includes(city.trim())
    || a.cityEn.toLowerCase() === key
    || key.includes(a.cityEn.toLowerCase())
    || key.includes(a.cityAr),
  ) ?? null
}

export function readRememberedDeparture(): BilamoDepartureAirport | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { code?: string }
    return airportByCode(parsed.code ?? raw)
  } catch {
    return airportByCode(String(localStorage.getItem(STORAGE_KEY) || ''))
  }
}

export function rememberDeparture(airport: BilamoDepartureAirport): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: airport.code }))
  } catch {
    /* ignore quota */
  }
}

function assumptionLines(airport: BilamoDepartureAirport): Pick<DepartureResolution, 'assumptionLineAr' | 'assumptionLineEn'> {
  return {
    assumptionLineAr: `سأعتبر ${airport.cityAr} نقطة الانطلاق.`,
    assumptionLineEn: `I'll take ${airport.cityEn} as your departure point.`,
  }
}

/**
 * Resolve departure: geolocation (if permitted) → remembered → null.
 * Does not prompt; caller shows assumption + "تغيير المطار".
 */
export async function resolveDepartureAirport(options?: {
  requestGeolocation?: boolean
  timeoutMs?: number
}): Promise<DepartureResolution | null> {
  const requestGeo = options?.requestGeolocation !== false
  const timeoutMs = options?.timeoutMs ?? 4_000

  if (requestGeo && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('geo_timeout')), timeoutMs)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            window.clearTimeout(timer)
            resolve(pos)
          },
          (err) => {
            window.clearTimeout(timer)
            reject(err)
          },
          { enableHighAccuracy: false, maximumAge: 600_000, timeout: timeoutMs },
        )
      })
      const airport = nearestAirport(position.coords.latitude, position.coords.longitude)
      rememberDeparture(airport)
      return { airport, source: 'geolocation', ...assumptionLines(airport) }
    } catch {
      /* permission denied / unavailable — fall through */
    }
  }

  const remembered = readRememberedDeparture()
  if (remembered) {
    return { airport: remembered, source: 'remembered', ...assumptionLines(remembered) }
  }

  return null
}
