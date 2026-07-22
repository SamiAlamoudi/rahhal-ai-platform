/**
 * Sprint 118 — EditHistory
 */

import type { EditKind } from './EditAnalyzer'
import type { EditDiff } from './EditDiff'
import type { EditPlan } from './EditPlanner'
import type { PipelineStageId } from '../pipeline'

export interface EditHistoryEntry {
  id: string
  at: string
  editText: string
  kind: EditKind
  summary: string
  stagesRerun: PipelineStageId[]
  stagesSkipped: PipelineStageId[]
  diff: EditDiff | null
  ok: boolean
}

export class EditHistory {
  private readonly entries: EditHistoryEntry[] = []
  private seq = 0

  append(entry: Omit<EditHistoryEntry, 'id' | 'at'> & { at?: string }): EditHistoryEntry {
    this.seq += 1
    const full: EditHistoryEntry = {
      id: `edit_${this.seq}`,
      at: entry.at ?? new Date().toISOString(),
      editText: entry.editText,
      kind: entry.kind,
      summary: entry.summary,
      stagesRerun: entry.stagesRerun,
      stagesSkipped: entry.stagesSkipped,
      diff: entry.diff,
      ok: entry.ok,
    }
    this.entries.push(full)
    return full
  }

  list(): readonly EditHistoryEntry[] {
    return this.entries.slice()
  }

  latest(): EditHistoryEntry | null {
    return this.entries[this.entries.length - 1] ?? null
  }

  clear(): void {
    this.entries.length = 0
  }

  recordPlan(
    editText: string,
    plan: EditPlan,
    diff: EditDiff | null,
    ok: boolean,
  ): EditHistoryEntry {
    return this.append({
      editText,
      kind: plan.analyzed.kind,
      summary: plan.analyzed.summary,
      stagesRerun: plan.stagesToRerun,
      stagesSkipped: plan.stagesToSkip,
      diff,
      ok,
    })
  }
}

export function createEditHistory(): EditHistory {
  return new EditHistory()
}
