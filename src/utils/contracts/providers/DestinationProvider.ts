import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { DestinationInsight } from '../models/destination'

export interface DestinationProvider extends ProviderContract {
  getDestinationInsight(req: ProviderRequest): Promise<ProviderResult<DestinationInsight>>
}
