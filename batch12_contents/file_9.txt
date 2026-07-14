import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { VisaInfo } from '../models/visa'

export interface VisaProvider extends ProviderContract {
  getVisaInfo(req: ProviderRequest): Promise<ProviderResult<VisaInfo>>
}
