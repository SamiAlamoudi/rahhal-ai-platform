/**
 * Sprint 85 — Result Merger.
 * Merges tool results into a unified structure — never exposes provider payloads.
 */

import type {
  ExecutableToolType,
  MergedExecutionResults,
  UnifiedResultItem,
  UnifiedToolResult,
} from './types'

export class ResultMerger {
  merge(results: UnifiedToolResult[]): MergedExecutionResults {
    const byTool: Partial<Record<ExecutableToolType, UnifiedToolResult>> = {}
    const items: UnifiedResultItem[] = []

    for (const result of results) {
      // Keep latest successful (or last) result per tool.
      byTool[result.tool] = {
        ...result,
        items: result.items.map((i) => this.normalizeItem(i)),
        meta: { ...result.meta, simulated: true, source: 'execution_simulator' },
      }
    }

    for (const result of Object.values(byTool)) {
      if (!result) continue
      for (const item of result.items) items.push(item)
    }

    const okCount = results.filter((r) => r.ok).length
    const summary = `Merged ${items.length} unified item(s) from ${okCount}/${results.length} tool result(s)`

    return { byTool, items, summary }
  }

  private normalizeItem(item: UnifiedResultItem): UnifiedResultItem {
    // Strip any accidental provider-looking keys from attributes.
    const attributes: Record<string, string | number | boolean | null> = {}
    for (const [key, value] of Object.entries(item.attributes ?? {})) {
      if (/^(raw|provider|amadeus|duffel|payload)_/i.test(key)) continue
      attributes[key] = value
    }
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      amount: item.amount ?? null,
      currency: item.currency ?? null,
      score: item.score ?? null,
      tags: [...(item.tags ?? [])],
      attributes,
    }
  }
}

export function createResultMerger(): ResultMerger {
  return new ResultMerger()
}
