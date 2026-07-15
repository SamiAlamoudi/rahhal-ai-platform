/**
 * Phase AJ — admin-only provider readiness diagnostics section.
 * Config/readiness only; no credentials; no external calls.
 */

import { useMemo } from 'react'
import { useAuth } from '../lib/auth/AuthContext'
import { getProviderDiagnostics } from '../lib/agent/aggregation'

export function ProviderReadinessDiagnosticsSection() {
  const { user, isAdmin } = useAuth()

  const result = useMemo(() => {
    if (!isAdmin) return null
    return getProviderDiagnostics({
      user: user
        ? {
            id: user.id,
            role: (user.app_metadata as { role?: string } | undefined)?.role ?? (isAdmin ? 'admin' : 'user'),
          }
        : null,
    })
  }, [user, isAdmin])

  if (!isAdmin) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Provider readiness</h2>
        <p className="text-xs text-slate-500">Admin access required.</p>
      </section>
    )
  }

  if (!result || !result.ok) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Provider readiness</h2>
        <p className="text-xs text-rose-500">{result && !result.ok ? result.error : 'Unavailable'}</p>
      </section>
    )
  }

  const { report } = result

  return (
    <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Provider readiness (Phase AJ)</h2>
          <p className="text-[10px] text-slate-400" dir="ltr">
            config-only · paymentProvider={report.paymentProvider} · masterLive={String(report.masterLive)}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-500" dir="ltr">
          {report.generatedAt}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" dir="ltr">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="p-2 font-bold">Provider</th>
              <th className="p-2 font-bold">Capability</th>
              <th className="p-2 font-bold">Configured</th>
              <th className="p-2 font-bold">Enabled</th>
              <th className="p-2 font-bold">Healthy</th>
              <th className="p-2 font-bold">Env</th>
              <th className="p-2 font-bold">Circuit</th>
              <th className="p-2 font-bold">Fallback</th>
              <th className="p-2 font-bold">Reason</th>
              <th className="p-2 font-bold">Checked</th>
            </tr>
          </thead>
          <tbody>
            {report.readiness.map((row) => (
              <tr key={`${row.provider}:${row.capability}`} className="border-b border-slate-50">
                <td className="p-2 font-mono text-slate-800">{row.provider}</td>
                <td className="p-2 text-slate-600">{row.capability}</td>
                <td className="p-2">{row.configured ? 'yes' : 'no'}</td>
                <td className="p-2">{row.enabled ? 'yes' : 'no'}</td>
                <td className="p-2">{row.healthy ? 'yes' : 'no'}</td>
                <td className="p-2">{row.environment}</td>
                <td className="p-2">{row.circuitState}</td>
                <td className="p-2">{row.fallbackAvailable ? 'yes' : 'no'}</td>
                <td className="p-2 max-w-[220px] truncate text-slate-500" title={row.reason}>{row.reason}</td>
                <td className="p-2 text-slate-400">{row.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-slate-400">
        Secrets shown only as [set]/[missing]. No outbound provider calls from this view.
      </p>
    </section>
  )
}
