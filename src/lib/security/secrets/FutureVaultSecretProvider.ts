/**
 * Sprint 14 — future vault / cloud secret provider (not enabled).
 */

import type { SecretProvider } from './types'

export interface FutureVaultCapabilities {
  hashicorpVault: false
  awsSecretsManager: false
  gcpSecretManager: false
  azureKeyVault: false
}

export const FUTURE_VAULT_CAPABILITIES: FutureVaultCapabilities = {
  hashicorpVault: false,
  awsSecretsManager: false,
  gcpSecretManager: false,
  azureKeyVault: false,
}

export class FutureVaultSecretProvider implements SecretProvider {
  readonly providerId = 'future_vault'
  readonly live = false

  get(_key: string): string | null {
    return null
  }

  has(_key: string): boolean {
    return false
  }

  listKeys(): string[] {
    return []
  }

  refresh(): void { /* architecture only */ }
  reload(): void { /* architecture only */ }
  getVersion(): string { return '0' }
  getLastUpdatedAt(): string | null { return null }
  invalidateCache(): void { /* no-op */ }
}

export function createFutureVaultSecretProvider(): FutureVaultSecretProvider {
  return new FutureVaultSecretProvider()
}
