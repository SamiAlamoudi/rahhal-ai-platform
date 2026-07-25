/**
 * Sprint 14 — secrets barrel (central SecretManager layer).
 */

export { SECURITY_SECRET_MANAGER_VERSION, REDACTED_PLACEHOLDER } from './types'
export type {
  ProviderCredentialSet,
  ProviderSecretRegistration,
  SecretAccessEvent,
  SecretCriticality,
  SecretDefinition,
  SecretManagerDiagnostics,
  SecretMetricsSnapshot,
  SecretPresence,
  SecretProvider,
  SecretProviderId,
  SecretRecord,
  SecretScope,
  SecretValidationIssue,
  SecretValidationReport,
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
  SecretRegistry,
  getSecretRegistry,
  resetSecretRegistryForTests,
  getProviderRegistration,
  expandKeyCandidates,
  PROVIDER_SECRET_REGISTRY,
} from './SecretRegistry'

export {
  ValidationService,
  createValidationService,
} from './ValidationService'

export {
  SecretSanitizer,
  createSecretSanitizer,
  sanitizeForLogs,
} from './SecretSanitizer'

export {
  SecretRotationController,
  getSecretRotationController,
  resetSecretRotationForTests,
} from './rotation'

export {
  ProviderSecretAuthorizer,
  createProviderSecretAuthorizer,
} from './authorization'

export {
  getSecretMetrics,
  resetSecretMetricsForTests,
} from './metrics'

export {
  validateSecretsAtStartup,
  shouldDisableProvider,
  isProductionRuntime,
} from './startup'

export {
  classifySecretScope,
  listServerOnlySecretKeys,
  findServerSecretLeaksInBundle,
} from './clientBoundary'

export {
  readManagedEnv,
  readManagedConfig,
  readManagedSecret,
} from './managedAccess'

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
