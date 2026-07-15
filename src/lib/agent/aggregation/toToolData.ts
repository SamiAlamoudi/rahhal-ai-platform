import type { AggregatableDomain, AggregationResult, NormalizedOffer } from './types'

/**
 * Map unified aggregation output into the tool payload shape expected by mergeToolResults.
 * Keeps the TripPlan merge contract stable.
 */
export function aggregationResultToToolData(
  domain: AggregatableDomain,
  result: AggregationResult,
): Record<string, unknown> {
  switch (domain) {
    case 'flights':
      return {
        offers: result.items.map((item) => item.payload),
        currency: result.items[0]?.currency ?? 'USD',
        aggregation: summary(result),
      }
    case 'hotels':
      return {
        stays: result.items.map((item) => item.payload),
        aggregation: summary(result),
      }
    case 'weather':
      return {
        ...(result.items[0]?.payload ?? {}),
        aggregation: summary(result),
      }
    case 'maps':
      return {
        legs: result.items.map((item) => item.payload),
        aggregation: summary(result),
      }
    case 'currency':
      return {
        ...(result.items[0]?.payload ?? {}),
        aggregation: summary(result),
      }
    case 'visa':
      return {
        ...(result.items[0]?.payload ?? {}),
        aggregation: summary(result),
      }
    case 'attractions':
      return {
        attractions: result.items.map((item) => item.payload),
        aggregation: summary(result),
      }
    default:
      return { items: result.items, aggregation: summary(result) }
  }
}

export function topOfferSummary(items: NormalizedOffer[]): string {
  if (items.length === 0) return 'no results'
  const top = items[0]
  const price = top.price != null ? ` · ${top.price} ${top.currency ?? ''}`.trim() : ''
  return `${top.title}${price}`
}

function summary(result: AggregationResult) {
  return {
    providersQueried: result.meta.providersQueried,
    providersSucceeded: result.meta.providersSucceeded,
    duplicatesRemoved: result.meta.duplicatesRemoved,
    averageConfidence: Number(result.averageConfidence.toFixed(3)),
    providerResults: result.providerResults,
  }
}
