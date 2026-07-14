import type { ProviderCapabilities } from './capabilities'

export type ProviderDomain =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'transfer'
  | 'rental-car'
  | 'weather'
  | 'visa'
  | 'destination'

export interface ProviderMetadata {
  id: string
  name: string
  priority: number
  enabled: boolean
  type: ProviderDomain
  version: string
  capabilities?: ProviderCapabilities
}
