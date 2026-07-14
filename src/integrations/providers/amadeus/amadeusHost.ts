/** Official Amadeus host (test). Paths always include `/v1/...`. */
export const AMADEUS_DEFAULT_HOST = 'https://test.api.amadeus.com'

/**
 * Strip trailing slash and optional `/v1` so callers can safely append `/v1/...`.
 */
export function normalizeAmadeusHost(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

export function amadeusV1Url(host: string, path: string): string {
  const normalizedHost = normalizeAmadeusHost(host)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedHost}/v1${normalizedPath}`
}
