import type { ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import type { ProviderContract } from '../../utils/contracts/providers/base'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'
import type { CurrencyInfo, CurrencyProvider } from '../contracts'

const METADATA: ProviderMetadata = {
  id: 'mock-currency-001',
  name: 'Mock Currency Provider',
  priority: 5,
  enabled: true,
  type: 'destination',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsRealtime: true,
}

function buildCurrencyInfo(): CurrencyInfo {
  return {
    id: 'MOCK-CURRENCY-001',
    providerId: METADATA.id,
    base: 'SAR',
    rates: [
      { base: 'SAR', quote: 'USD', rate: 0.27, fetchedAt: new Date().toISOString() },
      { base: 'SAR', quote: 'EUR', rate: 0.25, fetchedAt: new Date().toISOString() },
      { base: 'SAR', quote: 'JPY', rate: 40.5, fetchedAt: new Date().toISOString() },
      { base: 'SAR', quote: 'GBP', rate: 0.21, fetchedAt: new Date().toISOString() },
    ],
    fetchedAt: new Date().toISOString(),
  }
}

export class MockCurrencyAdapter implements CurrencyProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async getExchangeRates(_req: ProviderRequest): Promise<ProviderResult<CurrencyInfo>> {
    const start = Date.now()
    const data = buildCurrencyInfo()
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}

export type { ProviderContract }
