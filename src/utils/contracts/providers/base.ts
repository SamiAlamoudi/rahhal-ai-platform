import type { TravelSearchRequest } from '../../travelSearchRequest'
import type { ProviderMetadata } from '../metadata'
import type { ProviderCapabilities } from '../capabilities'

export interface ProviderRequest {
  search: TravelSearchRequest
}

export interface ProviderContract {
  readonly metadata: ProviderMetadata
  getCapabilities(): ProviderCapabilities
}
