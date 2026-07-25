/**
 * RC-2 — thin facade for Travel AI Agent orchestration.
 *
 * Heavy implementation lives in `travelAgentService.impl.ts` and is loaded on
 * first method call so `/chat` first paint does not pay the full agent/brain graph.
 *
 * Behavior is unchanged: same public API, same planTurn semantics.
 */

export type {
  TravelAgentService,
  TravelAgentServiceOptions,
  TravelAgentTurnInput,
  TravelAgentTurnResult,
} from './travelAgentService.impl'

import type {
  TravelAgentService,
  TravelAgentServiceOptions,
} from './travelAgentService.impl'

/**
 * Create a TravelAgentService whose heavy impl chunk loads lazily on first use.
 */
export function createTravelAgentService(
  options: TravelAgentServiceOptions = {},
): TravelAgentService {
  let inner: TravelAgentService | null = null
  let loading: Promise<TravelAgentService> | null = null

  const ensure = (): Promise<TravelAgentService> => {
    if (inner) return Promise.resolve(inner)
    if (!loading) {
      loading = import('./travelAgentService.impl').then((mod) => {
        inner = mod.createTravelAgentService(options)
        return inner
      })
    }
    return loading
  }

  return {
    async planTurn(input) {
      return (await ensure()).planTurn(input)
    },
    async regeneratePlan(input) {
      return (await ensure()).regeneratePlan(input)
    },
    async regenerateDay(input) {
      return (await ensure()).regenerateDay(input)
    },
    async regenerateScoped(input) {
      return (await ensure()).regenerateScoped(input)
    },
    async editPlan(input) {
      return (await ensure()).editPlan(input)
    },
    async savePlan(input) {
      return (await ensure()).savePlan(input)
    },
  }
}

/** Product singleton — impl loads on first planTurn / savePlan / regenerate*. */
export const travelAgentService = createTravelAgentService()
