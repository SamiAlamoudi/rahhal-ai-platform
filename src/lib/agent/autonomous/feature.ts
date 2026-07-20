import { getFeatureRegistry } from '../../ai/featureFlags'

export const AUTONOMOUS_AGENT_FEATURE_ID = 'ai.autonomous_agent' as const

export function isAutonomousAgentEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.autonomous_agent')
}
