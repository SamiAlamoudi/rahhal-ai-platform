import { getFeatureRegistry } from '../../ai/featureFlags'

export const DOCUMENT_CENTER_V2_FEATURE_ID = 'ai.document_center_v2' as const

/** Sprint 63 — OFF by default. */
export function isDocumentCenterV2Enabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.document_center_v2')
}
