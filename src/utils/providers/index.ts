import { createProviderRegistry, sortProvidersByPriority, type ProviderRegistry } from '../providerRegistry'
import { flightProvider, flightAdapter } from './flightProvider'
import { hotelProvider, hotelAdapter } from './hotelProvider'
import { activityProvider, activityAdapter } from './activityProvider'
import { transportationProvider, transportationAdapter } from './transportationProvider'

export function createDefaultRegistry(): ProviderRegistry {
  const registry = createProviderRegistry()
  registry.registerProvider(flightProvider, flightAdapter)
  registry.registerProvider(hotelProvider, hotelAdapter)
  registry.registerProvider(activityProvider, activityAdapter)
  registry.registerProvider(transportationProvider, transportationAdapter)
  return registry
}

export const defaultRegistry = createDefaultRegistry()

export function getActiveProviders(): ReturnType<ProviderRegistry['listProviders']> {
  return sortProvidersByPriority(defaultRegistry.listProviders({ enabledOnly: true }))
}

export {
  createProviderRegistry,
  sortProvidersByPriority,
  type ProviderRegistry,
} from '../providerRegistry'

export { flightProvider, flightAdapter } from './flightProvider'
export { hotelProvider, hotelAdapter } from './hotelProvider'
export { activityProvider, activityAdapter } from './activityProvider'
export { transportationProvider, transportationAdapter } from './transportationProvider'
