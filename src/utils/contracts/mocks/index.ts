import type {
  FlightProvider,
  HotelProvider,
  ActivityProvider,
  TransferProvider,
  VisaProvider,
  WeatherProvider,
  DestinationProvider,
  ProviderRequest,
  FlightOffer,
  HotelOffer,
  ActivityOffer,
  TransferOffer,
} from '../index'
import { MockFlightProvider } from './mockFlightProvider'
import { MockHotelProvider } from './mockHotelProvider'
import { MockActivityProvider } from './mockActivityProvider'
import { MockTransferProvider } from './mockTransferProvider'
import { MockVisaProvider } from './mockVisaProvider'
import { MockWeatherProvider } from './mockWeatherProvider'
import { MockDestinationProvider } from './mockDestinationProvider'

/** Contract mocks always expose sync sampleOffers for demos/tests. */
export type FlightProviderWithSamples = FlightProvider & {
  sampleOffers(req: ProviderRequest): FlightOffer[]
}
export type HotelProviderWithSamples = HotelProvider & {
  sampleOffers(req: ProviderRequest): HotelOffer[]
}
export type ActivityProviderWithSamples = ActivityProvider & {
  sampleOffers(req: ProviderRequest): ActivityOffer[]
}
export type TransferProviderWithSamples = TransferProvider & {
  sampleOffers(req: ProviderRequest): TransferOffer[]
}

export interface MockContractProviders {
  flight: FlightProviderWithSamples
  hotel: HotelProviderWithSamples
  activity: ActivityProviderWithSamples
  transfer: TransferProviderWithSamples
  visa: VisaProvider
  weather: WeatherProvider
  destination: DestinationProvider
}

export function createMockContractProviders(): MockContractProviders {
  return {
    flight: new MockFlightProvider(),
    hotel: new MockHotelProvider(),
    activity: new MockActivityProvider(),
    transfer: new MockTransferProvider(),
    visa: new MockVisaProvider(),
    weather: new MockWeatherProvider(),
    destination: new MockDestinationProvider(),
  }
}
