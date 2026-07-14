import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { TransferOffer } from '../models/transfer'

export interface TransferProvider extends ProviderContract {
  searchTransfers(req: ProviderRequest): Promise<ProviderResult<TransferOffer[]>>
}
