/**
 * Canonical destination identity — one normalized place object for the whole turn.
 * City and country are separate; never silently swap a city for an unrelated country.
 */

export type DestinationIdentity = {
  /** Canonical English city label when known (e.g. Tokyo). */
  city: string | null
  /** Canonical English country label when known (e.g. Japan). */
  country: string | null
  /** Primary booking label used in memory.destination (prefer city). */
  label: string
  /** Raw token from extract / ASR (for telemetry). */
  raw: string
}

type PlaceRow = {
  keys: string[]
  city: string | null
  country: string
  label: string
}

const PLACES: PlaceRow[] = [
  { keys: ['tokyo', 'طوكيو'], city: 'Tokyo', country: 'Japan', label: 'Tokyo' },
  { keys: ['osaka', 'اوساكا', 'أوساكا'], city: 'Osaka', country: 'Japan', label: 'Osaka' },
  { keys: ['kyoto', 'كيوتو'], city: 'Kyoto', country: 'Japan', label: 'Kyoto' },
  { keys: ['sapporo', 'هوكايدو', 'hokkaido', 'سابورو'], city: 'Sapporo', country: 'Japan', label: 'Sapporo' },
  // Yemen BEFORE Japan — avoid any accidental substring / ASR confusion path.
  { keys: ['yemen', 'sanaa', 'sana\'a', 'اليمن', 'صنعاء'], city: null, country: 'Yemen', label: 'اليمن' },
  { keys: ['japan', 'اليابان'], city: null, country: 'Japan', label: 'Japan' },
  { keys: ['riyadh', 'الرياض'], city: 'Riyadh', country: 'Saudi Arabia', label: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], city: 'Jeddah', country: 'Saudi Arabia', label: 'Jeddah' },
  { keys: ['dubai', 'دبي'], city: 'Dubai', country: 'United Arab Emirates', label: 'Dubai' },
  { keys: ['abu dhabi', 'أبوظبي', 'ابوظبي'], city: 'Abu Dhabi', country: 'United Arab Emirates', label: 'Abu Dhabi' },
  // City rows first; country-only rows never invent a capital city.
  { keys: ['paris', 'باريس'], city: 'Paris', country: 'France', label: 'Paris' },
  { keys: ['france', 'فرنسا'], city: null, country: 'France', label: 'France' },
  { keys: ['london', 'لندن'], city: 'London', country: 'United Kingdom', label: 'London' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول'], city: 'Istanbul', country: 'Turkey', label: 'Istanbul' },
  { keys: ['turkey', 'تركيا'], city: null, country: 'Turkey', label: 'Turkey' },
  { keys: ['cairo', 'القاهرة'], city: 'Cairo', country: 'Egypt', label: 'Cairo' },
  { keys: ['egypt', 'مصر'], city: null, country: 'Egypt', label: 'Egypt' },
  { keys: ['bangkok', 'بانكوك'], city: 'Bangkok', country: 'Thailand', label: 'Bangkok' },
  { keys: ['thailand', 'تايلند', 'تايلاند'], city: null, country: 'Thailand', label: 'Thailand' },
  { keys: ['marrakech', 'مراكش'], city: 'Marrakech', country: 'Morocco', label: 'Marrakech' },
  { keys: ['agadir', 'اكادير', 'أكادير'], city: 'Agadir', country: 'Morocco', label: 'Agadir' },
  { keys: ['morocco', 'المغرب'], city: null, country: 'Morocco', label: 'Morocco' },
  { keys: ['amman', 'عمّان', 'عمان'], city: 'Amman', country: 'Jordan', label: 'Amman' },
  { keys: ['jordan', 'الأردن', 'الاردن'], city: null, country: 'Jordan', label: 'Jordan' },
  // Keep Arabic label لبنان — never truncate to لبن via IATA slicing.
  { keys: ['beirut', 'بيروت'], city: 'بيروت', country: 'لبنان', label: 'بيروت' },
  { keys: ['lebanon', 'لبنان'], city: null, country: 'لبنان', label: 'لبنان' },
  { keys: ['maldives', 'المالديف'], city: null, country: 'Maldives', label: 'Maldives' },
  { keys: ['bali', 'بالي'], city: 'Bali', country: 'Indonesia', label: 'Bali' },
  { keys: ['rome', 'روما'], city: 'Rome', country: 'Italy', label: 'Rome' },
  { keys: ['italy', 'إيطاليا', 'ايطاليا'], city: null, country: 'Italy', label: 'Italy' },
  { keys: ['barcelona', 'برشلونة'], city: 'Barcelona', country: 'Spain', label: 'Barcelona' },
  { keys: ['spain', 'إسبانيا', 'اسبانيا'], city: null, country: 'Spain', label: 'Spain' },
  { keys: ['zurich', 'زوريخ'], city: 'Zurich', country: 'Switzerland', label: 'Zurich' },
  { keys: ['switzerland', 'سويسرا'], city: null, country: 'Switzerland', label: 'Switzerland' },
]

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Resolve a free-text / alias destination into city + country. */
export function resolveDestinationIdentity(raw: string | null | undefined): DestinationIdentity | null {
  const text = (raw || '').trim()
  if (!text) return null
  const n = norm(text)
  for (const row of PLACES) {
    if (row.keys.some((k) => n === norm(k) || n.includes(norm(k)))) {
      return {
        city: row.city,
        country: row.country,
        label: row.label,
        raw: text,
      }
    }
  }
  // Unknown place — keep as-is; never invent another country.
  return {
    city: text,
    country: null,
    label: text,
    raw: text,
  }
}

export function destinationsConflict(
  transcriptIdentity: DestinationIdentity | null,
  searchIdentity: DestinationIdentity | null,
): boolean {
  if (!transcriptIdentity || !searchIdentity) return false
  if (transcriptIdentity.label && searchIdentity.label
    && norm(transcriptIdentity.label) !== norm(searchIdentity.label)
  ) {
    // Same country + city-null vs city is OK (Japan vs Tokyo).
    if (
      transcriptIdentity.country
      && searchIdentity.country
      && norm(transcriptIdentity.country) === norm(searchIdentity.country)
    ) {
      if (!transcriptIdentity.city || !searchIdentity.city) return false
      return norm(transcriptIdentity.city) !== norm(searchIdentity.city)
    }
    return true
  }
  if (
    transcriptIdentity.country
    && searchIdentity.country
    && norm(transcriptIdentity.country) !== norm(searchIdentity.country)
  ) {
    return true
  }
  if (
    transcriptIdentity.city
    && searchIdentity.city
    && norm(transcriptIdentity.city) !== norm(searchIdentity.city)
  ) {
    return true
  }
  return false
}

/** Telemetry snapshot for destination integrity (never shown to travelers). */
export type DestinationPipelineTelemetry = {
  transcriptDestination: string | null
  extractedDestination: string | null
  memoryDestination: string | null
  searchPayloadDestination: string | null
  renderedDestination: string | null
  destinationCity: string | null
  destinationCountry: string | null
  conflict: boolean
}

export function buildDestinationTelemetry(input: {
  transcriptDestination?: string | null
  extractedDestination?: string | null
  memoryDestination?: string | null
  searchPayloadDestination?: string | null
  renderedDestination?: string | null
  identity?: DestinationIdentity | null
  conflict?: boolean
}): DestinationPipelineTelemetry {
  const identity = input.identity
    ?? resolveDestinationIdentity(
      input.memoryDestination
      || input.extractedDestination
      || input.transcriptDestination
      || null,
    )
  return {
    transcriptDestination: input.transcriptDestination ?? null,
    extractedDestination: input.extractedDestination ?? null,
    memoryDestination: input.memoryDestination ?? null,
    searchPayloadDestination: input.searchPayloadDestination ?? null,
    renderedDestination: input.renderedDestination ?? null,
    destinationCity: identity?.city ?? null,
    destinationCountry: identity?.country ?? null,
    conflict: input.conflict === true,
  }
}

/** Extract the first destination token from a confirmed ASR / user turn. */
export function destinationFromTranscript(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  for (const row of PLACES) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()) || trimmed.includes(k))) {
      // Prefer city destinations over country-only when both match (Tokyo before Japan).
      if (row.city) return row.label
    }
  }
  for (const row of PLACES) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()) || trimmed.includes(k))) {
      return row.label
    }
  }
  return null
}
