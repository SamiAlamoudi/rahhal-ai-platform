import { useCallback, useEffect, useState } from 'react'
import {
  fetchProvidersHealth,
  formatAmadeusStatusLabel,
  isAmadeusConnected,
  type ProvidersHealthResponse,
} from '../../integrations/providers/amadeus/providerStatus'

export default function ProviderStatusCard() {
  const [health, setHealth] = useState<ProvidersHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const next = await fetchProvidersHealth()
    setHealth(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const connected = health ? isAmadeusConnected(health) : false
  const label = health ? formatAmadeusStatusLabel(health) : '…'
  const tone = connected
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-900'

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${tone}`}
      data-testid="provider-status-card"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Provider Status</h3>
          <p className="mt-2 text-base font-semibold tracking-tight">
            {loading ? 'Checking Amadeus…' : label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-current/20 bg-white/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white"
        >
          Refresh
        </button>
      </div>

      {health && !loading && (
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="opacity-70">Amadeus</dt>
            <dd className="font-medium">{health.amadeus}</dd>
          </div>
          <div>
            <dt className="opacity-70">Fallback</dt>
            <dd className="font-medium">{health.fallback ? 'true (mock)' : 'false (live)'}</dd>
          </div>
          {health.host && (
            <div className="sm:col-span-2">
              <dt className="opacity-70">Host</dt>
              <dd className="font-mono text-[11px]">{health.host}</dd>
            </div>
          )}
          {health.detail && (
            <div className="sm:col-span-2">
              <dt className="opacity-70">Detail</dt>
              <dd className="leading-relaxed">{health.detail}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}
