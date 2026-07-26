/**
 * Progressive card reveal while assistant streams — presentation only.
 * Order: conversation first, then flight → hotel → activities → budget.
 */

/** How many smart cards to show given streamed character count. */
export function progressiveCardLimit(contentLength: number): number {
  if (contentLength <= 0) return 0
  // Hold cards until a short consultant summary has landed.
  if (contentLength < 80) return 0
  if (contentLength < 140) return 1 // flight
  if (contentLength < 220) return 2 // + hotel
  if (contentLength < 320) return 3 // + activities
  if (contentLength < 420) return 4 // + budget
  return 5
}
