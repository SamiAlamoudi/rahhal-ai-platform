export {
  createAmadeusProviderAdapter,
  type CreateAmadeusProviderAdapterOptions,
} from './amadeusProviderAdapter'
export {
  resolveAmadeusProviderConfig,
  isAmadeusConfigured,
  resolveAmadeusEnvironment,
  SANDBOX_HOST,
  PRODUCTION_HOST,
  type AmadeusProviderConfig,
  type AmadeusEnvironment,
} from './config'
export {
  createAmadeusAuthClient,
  AmadeusClientCredentialsAuth,
  type AmadeusAuthClient,
} from './auth'
export { flightOffersToNormalizedOffers } from './normalizeToOffer'
