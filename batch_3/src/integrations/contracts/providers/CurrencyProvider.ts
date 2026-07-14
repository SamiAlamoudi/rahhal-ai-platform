import type { ProviderRequest } from '../../../utils/contracts/providers/base'
import type { ProviderContract } from '../../../utils/contracts/providers/base'
import type { ProviderResult } from '../../../utils/contracts/result'
import type { CurrencyInfo } from '../models/currency'

export interface CurrencyProvider extends ProviderContract {
  getExchangeRates(req: ProviderRequest): Promise<ProviderResult<CurrencyInfo>>
}
