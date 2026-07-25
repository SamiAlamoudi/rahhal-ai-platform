/**
 * Sprint 14 — future vault / cloud secret provider (not enabled).
 * Prepared for HashiCorp Vault / AWS Secrets Manager / GCP Secret Manager.
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

/** Stub — always empty. Live vault integration is a future sprint. */
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
}

export function createFutureVaultSecretProvider(): FutureVaultSecretProvider {
  return new FutureVaultSecretProvider()
}
