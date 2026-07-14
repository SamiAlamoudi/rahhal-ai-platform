import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { ActivityOffer } from '../models/activity'

export interface ActivityProvider extends ProviderContract {
  searchActivities(req: ProviderRequest): Promise<ProviderResult<ActivityOffer[]>>
}
