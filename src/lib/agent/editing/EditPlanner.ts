/**
 * Sprint 118 — EditPlanner
 */

import type { AnalyzedEdit, EditSnapshot } from './EditAnalyzer'
import {
  planAffectedStages,
  type AffectedStagesPlan,
} from './AffectedStages'

export interface EditPlan {
  whatChanged: string[]
  affectedStages: AffectedStagesPlan['affectedStages']
  stagesToSkip: AffectedStagesPlan['stagesToSkip']
  stagesToRerun: AffectedStagesPlan['stagesToRerun']
  estimatedExecutionTimeMs: number
  stageOverrides: AffectedStagesPlan['stageOverrides']
  analyzed: AnalyzedEdit
  beforeTrip: EditSnapshot['trip']
  afterTrip: EditSnapshot['trip']
}

export function buildEditPlan(
  edit: AnalyzedEdit,
  snapshot: EditSnapshot,
): EditPlan {
  const affected = planAffectedStages(edit)
  const afterTrip = {
    ...snapshot.trip,
    ...edit.tripPatch,
  }
  if (edit.budgetValue != null) afterTrip.budget = edit.budgetValue
  if (edit.cabin) afterTrip.cabin = edit.cabin

  const whatChanged: string[] = [edit.summary, ...edit.signals]
  if (edit.dayDelta) whatChanged.push(`dayDelta=${edit.dayDelta}`)
  if (edit.removedCities.length) {
    whatChanged.push(`removedCities=${edit.removedCities.join(',')}`)
  }
  if (edit.addedCities.length) {
    whatChanged.push(`addedCities=${edit.addedCities.join(',')}`)
  }

  return {
    whatChanged,
    affectedStages: affected.affectedStages,
    stagesToSkip: affected.stagesToSkip,
    stagesToRerun: affected.stagesToRerun,
    estimatedExecutionTimeMs: affected.estimatedExecutionTimeMs,
    stageOverrides: affected.stageOverrides,
    analyzed: edit,
    beforeTrip: { ...snapshot.trip },
    afterTrip,
  }
}

export class EditPlanner {
  plan(edit: AnalyzedEdit, snapshot: EditSnapshot): EditPlan {
    return buildEditPlan(edit, snapshot)
  }
}

export function createEditPlanner(): EditPlanner {
  return new EditPlanner()
}
