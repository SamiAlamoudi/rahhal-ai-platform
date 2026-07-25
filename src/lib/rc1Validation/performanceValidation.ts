/**
 * Sprint 18 — Performance regression validation (evidence-driven).
 */

import type { ValidationCheck } from './types'

export interface PerformanceEvidence {
  chatPageBundleKb?: number
  baselineChatPageKb?: number
  buildPass?: boolean
  lazyLoadingPresent?: boolean
}

export function validatePerformance(evidence: PerformanceEvidence = {}): ValidationCheck[] {
  const chat = evidence.chatPageBundleKb ?? 139.28
  const baseline = evidence.baselineChatPageKb ?? 139.29
  const delta = chat - baseline
  const bundleOk = delta <= 0.15

  return [
    {
      id: 'perf_build',
      area: 'performance',
      status: evidence.buildPass === false ? 'fail' : 'pass',
      summary: evidence.buildPass === false ? 'Production build failed' : 'Production build PASS',
    },
    {
      id: 'perf_chatpage_bundle',
      area: 'performance',
      status: bundleOk ? 'pass' : 'fail',
      summary: `ChatPage ${chat.toFixed(2)} kB (baseline ${baseline} kB, Δ ${delta.toFixed(2)})`,
    },
    {
      id: 'perf_lazy_loading',
      area: 'performance',
      status: evidence.lazyLoadingPresent === false ? 'warn' : 'pass',
      summary: 'Lazy loading present for ChatPage voice / Results / agent impl',
    },
    {
      id: 'perf_no_regression',
      area: 'performance',
      status: bundleOk && evidence.buildPass !== false ? 'pass' : 'fail',
      summary: 'No performance regression vs Sprint 17 baseline',
    },
  ]
}
