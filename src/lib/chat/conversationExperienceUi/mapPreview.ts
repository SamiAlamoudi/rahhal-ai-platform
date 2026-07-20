/**
 * Sprint 42 — map preview helpers (presentation only).
 * Uses static OSM embed URLs; does not call live Maps SDKs or invent a maps engine.
 */

export type MapPreviewKind =
  | 'hotel'
  | 'airport'
  | 'activity'
  | 'car_pickup'
  | 'multi_stop'

export interface MapPreviewModel {
  kind: MapPreviewKind
  label: string
  query: string
  embedUrl: string
  openUrl: string
}

export function buildMapPreview(input: {
  kind: MapPreviewKind
  query: string
  label?: string
}): MapPreviewModel {
  const q = input.query.trim() || 'world'
  const encoded = encodeURIComponent(q)
  return {
    kind: input.kind,
    label: input.label ?? q,
    query: q,
    embedUrl: `https://www.openstreetmap.org/export/embed.html?search=${encoded}`,
    openUrl: `https://www.openstreetmap.org/search?query=${encoded}`,
  }
}

export function buildItineraryMapPreviews(stops: string[]): MapPreviewModel[] {
  return stops.filter(Boolean).slice(0, 6).map((stop, index) =>
    buildMapPreview({
      kind: index === 0 ? 'airport' : 'multi_stop',
      query: stop,
      label: stop,
    }),
  )
}
