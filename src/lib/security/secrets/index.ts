/**
 * Sprint 14 — secrets barrel (central SecretManager layer).
 */

export { SECURITY_SECRET_MANAGER_VERSION } from './types'
export type {
  ProviderCredentialSet,
  SecretAccessEvent,
  SecretManagerDiagnostics,
  SecretPresence,
  SecretProvider,
  SecretProviderId,
  SecretRecord,
  SecretScope,
} from './types'

export {
  SECURITY_SECRET_MANAGER_FEATURE_ID,
  isSecretManagerEnabled,
} from './feature'

export { redactSecret, assertNoSecretLeak } from './redact'
export {
  recordSecretAccess,
  listSecretAccessEvents,
  resetSecretAccessAuditForTests,
} from './audit'

export {
  EnvironmentSecretProvider,
  createEnvironmentSecretProvider,
} from './EnvironmentSecretProvider'

export {
  FutureVaultSecretProvider,
  createFutureVaultSecretProvider,
  FUTURE_VAULT_CAPABILITIES,
} from './FutureVaultSecretProvider'

export {
  MemorySecretProvider,
  createMemorySecretProvider,
} from './MemorySecretProvider'

export {
  PROVIDER_SECRET_REGISTRY,
  getProviderRegistration,
  expandKeyCandidates,
} from './registry'

export {
  SecretManager,
  createSecretManager,
  getSecretManager,
  setSecretManagerForTests,
  resetSecretManagerForTests,
  type SecretManagerOptions,
} from './SecretManager'

export {
  resolveProviderCredentials,
  readSecretViaManager,
  hasProviderCredentials,
} from './providerCredentials'
