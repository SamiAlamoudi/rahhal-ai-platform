/**
 * Sprint 70 — GA release checklist.
 */

export interface GAChecklistItem {
  id: string
  label: string
  group: string
  done: boolean
}

export function buildGAChecklist(input?: {
  verificationOk?: boolean
  docsOk?: boolean
  securityOk?: boolean
  deploymentOk?: boolean
}): GAChecklistItem[] {
  const verificationOk = input?.verificationOk ?? true
  const docsOk = input?.docsOk ?? true
  const securityOk = input?.securityOk ?? true
  const deploymentOk = input?.deploymentOk ?? true

  const item = (
    id: string,
    label: string,
    group: string,
    done: boolean,
  ): GAChecklistItem => ({ id, label, group, done })

  return [
    item('ai_conversation', 'AI Conversation verified', 'Product', verificationOk),
    item('search', 'Search verified', 'Product', verificationOk),
    item('recommendation', 'Recommendation verified', 'Product', verificationOk),
    item('flights', 'Flights path verified', 'Product', verificationOk),
    item('hotels', 'Hotels path verified', 'Product', verificationOk),
    item('trips', 'Trips verified', 'Product', verificationOk),
    item('documents', 'Documents verified', 'Product', verificationOk),
    item('payments_mock', 'Payments mock mode required', 'Payments', securityOk),
    item('notifications', 'Notifications abstraction verified', 'Notifications', verificationOk),
    item('providers', 'Provider abstraction verified', 'Providers', verificationOk),
    item('observability', 'Observability enabled', 'Ops', verificationOk),
    item('deployment', 'Deployment automation verified', 'Ops', deploymentOk),
    item('recovery', 'Recovery / rollback armed', 'Ops', verificationOk),
    item('feature_flags', 'Feature flags audited', 'Security', securityOk),
    item('security', 'Security audit clean', 'Security', securityOk),
    item('configuration', 'Production configuration valid', 'Security', securityOk),
    item('secrets', 'No client secret exposure', 'Security', securityOk),
    item('health', 'Health probes OK', 'Ops', verificationOk),
    item('analytics', 'Operational analytics available', 'Ops', verificationOk),
    item('smoke', 'Smoke tests pass', 'QA', verificationOk),
    item('cicd', 'CI/CD gates green', 'QA', deploymentOk),
    item('monitoring', 'Monitoring / metrics / dashboards', 'Ops', verificationOk),
    item('beta_modules', 'Beta modules present', 'Modules', verificationOk),
    item('production_modules', 'Production modules present', 'Modules', verificationOk),
    item('docs', 'GA documentation published', 'Docs', docsOk),
    item('version', 'Version manifest 1.0.0', 'Release', true),
  ]
}

export function isGAChecklistComplete(items: GAChecklistItem[]): boolean {
  return items.every((i) => i.done)
}
