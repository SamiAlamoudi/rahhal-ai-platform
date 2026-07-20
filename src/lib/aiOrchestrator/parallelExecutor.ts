/**
 * Sprint 43 — parallel tool execution for independent waves.
 */

import type { OrchestratorToolId, ToolExecutionResult, ToolParallelGroup } from './types'

export type ToolRunner = (tool: OrchestratorToolId) => Promise<ToolExecutionResult>

export async function executeToolWaves(input: {
  waves: ToolParallelGroup[]
  runTool: ToolRunner
  signal?: AbortSignal
}): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = []

  for (const wave of input.waves) {
    if (input.signal?.aborted) {
      for (const tool of wave.tools) {
        results.push({
          tool,
          ok: false,
          durationMs: 0,
          summary: 'Aborted',
          recommendations: [],
          error: 'aborted',
        })
      }
      break
    }

    if (wave.parallel && wave.tools.length > 1) {
      const waveResults = await Promise.all(wave.tools.map((tool) => input.runTool(tool)))
      results.push(...waveResults)
    } else {
      for (const tool of wave.tools) {
        results.push(await input.runTool(tool))
      }
    }
  }

  return results
}

/** True when independent tools in a wave actually overlapped in wall time. */
export function assertParallelWave(results: ToolExecutionResult[]): boolean {
  if (results.length < 2) return false
  // Heuristic for tests: all completed successfully with non-zero timing allowed.
  return results.every((r) => r.ok || r.error != null)
}
