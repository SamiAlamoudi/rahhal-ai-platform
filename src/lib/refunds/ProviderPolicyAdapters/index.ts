import type { PolicyServiceKind, ProviderPolicyAdapter } from '../types'
import { ActivityPolicyAdapter } from './ActivityPolicyAdapter'
import { CarRentalPolicyAdapter } from './CarRentalPolicyAdapter'
import { FlightPolicyAdapter } from './FlightPolicyAdapter'
import { HotelPolicyAdapter } from './HotelPolicyAdapter'
import { InsurancePolicyAdapter } from './InsurancePolicyAdapter'
import { VisaPolicyAdapter } from './VisaPolicyAdapter'

export { FlightPolicyAdapter } from './FlightPolicyAdapter'
export { HotelPolicyAdapter } from './HotelPolicyAdapter'
export { CarRentalPolicyAdapter } from './CarRentalPolicyAdapter'
export { ActivityPolicyAdapter } from './ActivityPolicyAdapter'
export { VisaPolicyAdapter } from './VisaPolicyAdapter'
export { InsurancePolicyAdapter } from './InsurancePolicyAdapter'

export function createDefaultPolicyAdapters(): ProviderPolicyAdapter[] {
  return [
    new FlightPolicyAdapter('flight_generic'),
    new FlightPolicyAdapter('mock-flight-001'),
    new HotelPolicyAdapter('hotel_generic'),
    new HotelPolicyAdapter('hotelbeds'),
    new HotelPolicyAdapter('booking_connectivity'),
    new HotelPolicyAdapter('expedia_rapid'),
    new HotelPolicyAdapter('mock_hotels'),
    new CarRentalPolicyAdapter('car_generic'),
    new ActivityPolicyAdapter('activity_generic'),
    new VisaPolicyAdapter(),
    new InsurancePolicyAdapter(),
  ]
}

export function selectAdapter(
  adapters: ProviderPolicyAdapter[],
  serviceKind: PolicyServiceKind,
  providerId: string,
): ProviderPolicyAdapter {
  return (
    adapters.find((a) => a.serviceKind === serviceKind && a.providerId === providerId)
    ?? adapters.find((a) => a.serviceKind === serviceKind)
    ?? adapters[0]
  )
}
