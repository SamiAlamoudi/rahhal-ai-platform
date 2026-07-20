import type {
  FlightProvider,
  HotelProvider,
  ActivityProvider,
  TransferProvider,
  VisaProvider,
  WeatherProvider,
  DestinationProvider,
} from '../providers'
import { MockFlightProvider } from './mockFlightProvider'
import { MockHotelProvider } from './mockHotelProvider'
import { MockActivityProvider } from './mockActivityProvider'
import { MockTransferProvider } from './mockTransferProvider'
import { MockVisaProvider } from './mockVisaProvider'
import { MockWeatherProvider } from './mockWeatherProvider'
import { MockDestinationProvider } from './mockDestinationProvider'

export interface MockContractProviders {
  flight: FlightProvider
  hotel: HotelProvider
  activity: ActivityProvider
  transfer: TransferProvider
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
