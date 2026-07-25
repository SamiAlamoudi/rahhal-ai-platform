/**
 * Progressive card reveal while assistant streams — presentation only.
 */

/** How many smart cards to show given streamed character count. */
export function progressiveCardLimit(contentLength: number): number {
  if (contentLength <= 0) return 0
  if (contentLength < 40) return 1
  if (contentLength < 120) return 2
  if (contentLength < 220) return 3
  if (contentLength < 360) return 4
  return 5
}
