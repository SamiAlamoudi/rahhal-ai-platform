import { useCallback, useEffect, useState } from 'react'
import {
  getProviderHealthMonitor,
  getMultiProviderConfig,
  type MultiProviderHealthReport,
} from '../../integrations/multiProvider'

const DOMAIN_LABELS: Record<string, string> = {
  flight: 'Flights',
  hotel: 'Hotels',
  cars: 'Cars',
  activities: 'Activities',
  transfers: 'Transfers',
}

export default function MultiProviderHealthCard() {
  const [report, setReport] = useState<MultiProviderHealthReport | null>(null)
  const enabled = getMultiProviderConfig().enabled

  const refresh = useCallback(() => {
    setReport(getProviderHealthMonitor().report())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!enabled) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Multi Provider Health</h3>
        <p className="mt-2 text-xs text-slate-500">
          Multi-provider mode is disabled (`VITE_MULTI_PROVIDER_ENABLED=false`).
        </p>
      </section>
    )
  }

  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
      data-testid="multi-provider-health-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Multi Provider Health</h3>
          <p className="mt-1 text-xs text-slate-500">
            Connected · Latency · Errors · Fallback count · Quota
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {report && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              Domains connected: {report.totals.connected}
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
              Errors: {report.totals.errors}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
              Fallbacks: {report.totals.fallbackCount}
            </span>
          </div>

          {report.domains.map((domain) => (
            <div key={domain.domain} className="rounded-xl border border-slate-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {DOMAIN_LABELS[domain.domain] ?? domain.domain}
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  {domain.chain.join(' → ')}
                </p>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Provider</th>
                      <th className="py-1 pr-3 font-medium">Connected</th>
                      <th className="py-1 pr-3 font-medium">Latency</th>
                      <th className="py-1 pr-3 font-medium">Errors</th>
                      <th className="py-1 pr-3 font-medium">Fallback</th>
                      <th className="py-1 font-medium">Quota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domain.providers.map((p) => (
                      <tr key={p.providerId} className="border-t border-slate-50 text-slate-700">
                        <td className="py-1.5 pr-3 font-medium">{p.providerId}</td>
                        <td className="py-1.5 pr-3">{p.connected ? '✓' : '—'}</td>
                        <td className="py-1.5 pr-3">
                          {p.latencyMs != null ? `${p.latencyMs}ms` : '—'}
                        </td>
                        <td className="py-1.5 pr-3">{p.errors}</td>
                        <td className="py-1.5 pr-3">{p.fallbackCount}</td>
                        <td className="py-1.5">{p.quotaStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
