#!/usr/bin/env node
/**
 * Live Amadeus search: Riyadh → Casablanca on 2026-07-30.
 * Prints raw Amadeus response + mapped Rahhal offers when connected.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv(resolve(process.cwd(), '.env.local'))
loadDotEnv(resolve(process.cwd(), '.env'))

const host = (process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com')
  .replace(/\/+$/, '')
  .replace(/\/v1$/i, '')
const clientId = (process.env.AMADEUS_CLIENT_ID || '').trim()
const clientSecret = (process.env.AMADEUS_CLIENT_SECRET || '').trim()

const OUT_DIR = '/opt/cursor/artifacts'
try { mkdirSync(OUT_DIR, { recursive: true }) } catch { /* ignore */ }

const report = {
  route: 'Riyadh (RUH) → Casablanca (CMN)',
  departureDate: '2026-07-30',
  returnDate: '2026-08-06',
  health: null,
  raw: null,
  mapped: null,
  error: null,
}

if (!clientId || !clientSecret) {
  report.health = { amadeus: 'missing_credentials', fallback: true }
  report.error = 'Missing AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET'
  console.log(JSON.stringify(report, null, 2))
  console.error('\nSee docs/AMADEUS_SETUP.md')
  writeFileSync(resolve(OUT_DIR, 'amadeus-live-search.json'), JSON.stringify(report, null, 2))
  process.exit(2)
}

async function getToken() {
  const response = await fetch(`${host}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Token HTTP ${response.status}: ${text}`)
  }
  return JSON.parse(text)
}

function mapOffer(offer, dictionaries) {
  const itin = offer.itineraries?.[0]
  const segments = itin?.segments || []
  const first = segments[0]
  const last = segments[segments.length - 1]
  const carrierCode = first?.carrierCode || ''
  const airlineName = dictionaries?.carriers?.[carrierCode] || carrierCode || 'Airline'
  const duration = itin?.duration || ''
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  const minutes = match ? (Number(match[1] || 0) * 60 + Number(match[2] || 0)) : 0
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const durationLabel = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
  return {
    id: offer.id,
    airlineName,
    origin: first?.departure?.iataCode,
    destination: last?.arrival?.iataCode,
    departure: first?.departure?.at,
    durationLabel,
    stops: Math.max(0, segments.length - 1),
    price: Number(offer.price?.total || 0),
    currency: offer.price?.currency || 'SAR',
    conversation: [
      `✈️ ${airlineName}`,
      `${first?.departure?.iataCode || 'RUH'} → ${last?.arrival?.iataCode || 'CMN'}`,
      '',
      'Departure:',
      '30 Jul 2026',
      '',
      'Return:',
      '6 Aug 2026',
      '',
      'Duration:',
      durationLabel,
      '',
      'Stops:',
      String(Math.max(0, segments.length - 1)),
      '',
      'Price:',
      `${offer.price?.currency || 'SAR'} ${Number(offer.price?.total || 0).toLocaleString('en-US')}`,
    ].join('\n'),
  }
}

try {
  const tokenPayload = await getToken()
  report.health = { amadeus: 'connected', fallback: false, host }

  const params = new URLSearchParams({
    originLocationCode: 'RUH',
    destinationLocationCode: 'CMN',
    departureDate: '2026-07-30',
    returnDate: '2026-08-06',
    adults: '1',
    max: '5',
    currencyCode: 'SAR',
    nonStop: 'false',
  })

  const searchUrl = `${host}/v1/shopping/flight-offers?${params}`
  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'Content-Type': 'application/json',
    },
  })
  const raw = await response.json()
  report.raw = raw

  if (!response.ok) {
    report.error = `Flight search HTTP ${response.status}`
    console.log(JSON.stringify(report, null, 2))
    writeFileSync(resolve(OUT_DIR, 'amadeus-live-search.json'), JSON.stringify(report, null, 2))
    process.exit(1)
  }

  const mapped = (raw.data || []).slice(0, 5).map((offer) => mapOffer(offer, raw.dictionaries))
  report.mapped = mapped

  console.log('=== HEALTH ===')
  console.log(JSON.stringify(report.health, null, 2))
  console.log('\n=== RAW AMADEUS (truncated to first offer meta) ===')
  console.log(JSON.stringify({
    count: raw.meta?.count ?? raw.data?.length ?? 0,
    firstOfferId: raw.data?.[0]?.id,
    dictionaries: raw.dictionaries,
    firstOffer: raw.data?.[0],
  }, null, 2))
  console.log('\n=== MAPPED RAHHAL ===')
  console.log(JSON.stringify(mapped, null, 2))
  if (mapped[0]) {
    console.log('\n=== SAMPLE CONVERSATION CARD ===')
    console.log(mapped[0].conversation)
  }

  writeFileSync(resolve(OUT_DIR, 'amadeus-live-search.json'), JSON.stringify(report, null, 2))
  process.exit(0)
} catch (err) {
  report.health = {
    amadeus: 'unreachable',
    fallback: true,
    host,
    detail: err instanceof Error ? err.message : String(err),
  }
  report.error = err instanceof Error ? err.message : String(err)
  console.log(JSON.stringify(report, null, 2))
  writeFileSync(resolve(OUT_DIR, 'amadeus-live-search.json'), JSON.stringify(report, null, 2))
  console.error('\n⚠ Live Amadeus search could not complete. See docs/AMADEUS_SETUP.md')
  process.exit(1)
}
