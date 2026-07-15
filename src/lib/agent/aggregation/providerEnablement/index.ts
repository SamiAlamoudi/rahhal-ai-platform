/**
 * Phase AJ — Live Provider Enablement Preparation public surface.
 */

export type {
  ProviderCapability,
  ProviderEnvironment,
  ProviderId,
  ProviderRegistryEntry,
  ProviderEnablementFlags,
  CapabilityEnablement,
  SecretPresenceResult,
  ProviderReadinessResult,
  ProviderSelectionDecision,
  SelectionOutcome,
  HealthCheckStrategy,
} from './types'

export {
  getProviderConfigurationRegistry,
  getRegistryEntry,
  getLiveEntriesForCapability,
  getMockFallbackEntry,
} from './registry'

export {
  maskSecretValue,
  validateSecretPresence,
  requiredSecretsSatisfied,
  hasForbiddenClientSecrets,
  isProductionAmadeusBaseUrl,
  readEnvValue,
  FORBIDDEN_VITE_SECRET_KEYS,
} from './secrets'

export {
  resolveProviderEnablementFlags,
  isCapabilityLiveEnabled,
  capabilityForLiveProviderId,
  defaultLiveProviderForCapability,
} from './flags'

export {
  checkProviderReadiness,
  checkAllProviderReadiness,
  checkLiveProviderReadiness,
} from './readiness'

export {
  selectProviderForCapability,
  selectAllCapabilities,
} from './selection'

export {
  getProviderDiagnostics,
  type ProviderDiagnosticsRequest,
  type ProviderDiagnosticsReport,
  type ProviderDiagnosticsResult,
  type DiagnosticsAuthUser,
} from './diagnostics'

export {
  runSandboxProbes,
  isSandboxProbeEnvEnabled,
  isProductionProbeConfirmed,
} from './probe'

export {
  toPhaseWFeatureFlags,
  resolveEnablementAwareFeatureFlags,
} from './factoryBridge'

export { runProvidersCheck, type ProvidersCheckResult } from './cli'

export {
  PROVIDER_FAILURE_POLICY,
  failurePolicyFor,
  type FailureScenario,
  type FailurePolicyRow,
} from './failurePolicy'

export { syncProviderEnablementFeatureFlags } from './syncFeatureFlags'

export {
  enforceSingleLiveCapability,
  isExclusiveLiveCapability,
  LIVE_CAPABILITY_PRIORITY,
  PRIMARY_SANDBOX_PROVIDER_ID,
  PRIMARY_SANDBOX_CAPABILITY,
  type ExclusivityResolution,
} from './exclusivity'

export { createAmadeusSandboxProbeFn } from './amadeusSandboxProbe'

export {
  AMADEUS_SANDBOX_VALIDATION_ENV,
  isAmadeusSandboxValidationModeEnabled,
  runAmadeusSandboxValidation,
  validateAmadeusFlightOffersShape,
  resolveSandboxTokenProxyConfig,
  type AmadeusSandboxValidationReport,
  type AmadeusSandboxValidationOptions,
  type HttpStatusCategory,
} from './amadeusSandboxValidation'

export {
  runAmadeusSandboxValidationCli,
  type AmadeusSandboxValidationCliResult,
} from './amadeusSandboxValidationCli'
