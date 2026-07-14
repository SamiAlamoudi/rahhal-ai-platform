import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { ActivityOffer } from '../models/activity'

export interface ActivityProvider extends ProviderContract {
  searchActivities(req: ProviderRequest): Promise<ProviderResult<ActivityOffer[]>>
  /** Sync fixture/sample offers for demos and contract tests (optional on live adapters). */
  sampleOffers?(req: ProviderRequest): ActivityOffer[]
}
