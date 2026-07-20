import type { VisaProvider, ProviderRequest } from '../providers'
import type { VisaInfo } from '../models'
import type { ProviderResult } from '../result'
import type { ProviderCapabilities } from '../capabilities'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'

const METADATA: ProviderMetadata = {
  id: 'mock-visa-001',
  name: 'Mock Visa Provider',
  priority: 5,
  enabled: true,
  type: 'visa',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
}

function buildVisaInfo(destination: string): VisaInfo {
  return {
    id: 'MOCK-VISA-001',
    providerId: METADATA.id,
    destination,
    visaType: 'Tourist e-Visa',
    required: true,
    processingDays: 7,
    cost: 150,
    currency: 'SAR',
    validDays: 90,
    documentsRequired: ['passport', 'passport-photo', 'return-ticket', 'hotel-booking'],
    notes: 'تأشيرة إلكترونية للسياحة، يمكن التقديم عبر الإنترنت',
  }
}

export class MockVisaProvider implements VisaProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async getVisaInfo(req: ProviderRequest): Promise<ProviderResult<VisaInfo>> {
    const start = Date.now()
    const data = buildVisaInfo(req.search.destination || 'Unknown')
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
