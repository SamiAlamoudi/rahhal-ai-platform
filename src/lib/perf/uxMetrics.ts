/**
 * UX-01 — lightweight perceived-performance marks (no analytics backend).
 * Call mark/measure around critical UX paths; read via getUxMetricsSnapshot().
 */

export type UxMetricName =
  | 'app_startup'
  | 'login_render'
  | 'dashboard_render'
  | 'conversation_create_ui'
  | 'first_message_optimistic'
  | 'assistant_first_delta'

type MetricSample = {
  name: UxMetricName
  ms: number
  at: number
}

const samples: MetricSample[] = []
const MAX_SAMPLES = 40

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function markUx(name: UxMetricName, startMs?: number): number {
  const end = now()
  const ms = startMs != null ? Math.max(0, end - startMs) : 0
  samples.push({ name, ms, at: end })
  if (samples.length > MAX_SAMPLES) samples.shift()
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark(`rahhal:ux:${name}`)
      if (startMs != null) {
        performance.measure(`rahhal:ux:${name}`, {
          start: startMs,
          end,
        })
      }
    } catch {
      /* ignore invalid measure */
    }
  }
  return ms
}

export function getUxMetricsSnapshot(): MetricSample[] {
  return [...samples]
}

export function clearUxMetrics(): void {
  samples.length = 0
}

/** Route-level paint helper for Suspense / auth gates. */
export function markRoutePaint(route: 'login' | 'dashboard' | 'chat'): void {
  if (route === 'login') markUx('login_render')
  else if (route === 'dashboard') markUx('dashboard_render')
}
