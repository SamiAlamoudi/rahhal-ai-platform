/**
 * Travel Planning Engine contracts — pure builders, no booking or pricing.
 */

import type {
  PlanningAlternativesContract,
  PlanningConfidenceContract,
  PlanningConstraintsContract,
  PlanningEngineContract,
  PlanningGoalsContract,
  PlanningLifecycleContract,
  PlanningOptimizationContract,
  PlanningPipelineContract,
  PlanningPrioritiesContract,
  PlanningRevisionContract,
  PlanningRulesContract,
  PlanningSchemaContract,
  PlanningSnapshotContract,
  PlanningStrategyContract,
  PlanningTimelineContract,
  PlanningValidationContract,
  PlanningVersionContract,
  TravelPlan,
  PlanningGoal,
  PlanningConstraint,
  PlanningStep,
  PlanningAlternative,
  PlanningScore,
  PlanningConfidence,
  PlanningValidation,
  PlanningRevision,
  PlanningSnapshot,
} from './types'
import { TRAVEL_PLANNING_LIFECYCLE_ACTIONS, TRAVEL_PLANNING_PIPELINE_STAGES } from './types'

const ISO = '2026-07-25T00:00:00.000Z'
const PLAN_ID = 'plan-architecture'

export function buildPlanningEngine(): PlanningEngineContract {
  return {
    kind: 'travel_planning_engine',
    version: '7.7.0-travel-planning',
    execution: 'none',
    books: false,
  }
}

export function buildPlanningPipeline(): PlanningPipelineContract {
  return {
    kind: 'travel_planning_pipeline',
    stages: TRAVEL_PLANNING_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildPlanningSchema(): PlanningSchemaContract {
  return {
    kind: 'travel_planning_schema',
    outputKinds: [
      'travel_plan',
      'planning_goal',
      'planning_constraint',
      'planning_step',
      'planning_alternative',
      'planning_score',
      'planning_confidence',
      'planning_validation',
      'planning_revision',
      'planning_snapshot',
    ],
    execution: 'none',
  }
}

export function buildTravelPlanSample(): TravelPlan {
  return {
    kind: 'travel_plan',
    planId: PLAN_ID,
    destinationHint: null,
    dateHints: [],
    budgetHint: null,
    execution: 'none',
    books: false,
  }
}

export function buildPlanningGoalSample(): PlanningGoal {
  return {
    kind: 'planning_goal',
    goalId: 'goal-architecture',
    goalHint: 'structure_trip_blueprint',
    execution: 'none',
  }
}

export function buildPlanningConstraintSample(): PlanningConstraint {
  return {
    kind: 'planning_constraint',
    constraintId: 'constraint-architecture',
    constraintHint: 'never_book',
    hardHint: true,
    execution: 'none',
  }
}

export function buildPlanningStepSample(): PlanningStep {
  return {
    kind: 'planning_step',
    stepId: 'step-architecture',
    stageHint: 'build_plan_structure',
    summaryHint: 'architecture blueprint',
    execution: 'none',
  }
}

export function buildPlanningAlternativeSample(): PlanningAlternative {
  return {
    kind: 'planning_alternative',
    alternativeId: 'alt-architecture',
    labelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildPlanningScoreSample(): PlanningScore {
  return {
    kind: 'planning_score',
    planId: PLAN_ID,
    scoreHint: 0,
    execution: 'none',
  }
}

export function buildPlanningConfidenceSample(): PlanningConfidence {
  return {
    kind: 'planning_confidence',
    planId: PLAN_ID,
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildPlanningValidationSample(): PlanningValidation {
  return {
    kind: 'planning_validation',
    planId: PLAN_ID,
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildPlanningRevisionSample(): PlanningRevision {
  return {
    kind: 'planning_revision',
    revisionId: 'rev-architecture',
    planId: PLAN_ID,
    reasonHint: 'architecture_blueprint',
    execution: 'none',
  }
}

export function buildPlanningSnapshotSample(): PlanningSnapshot {
  return {
    kind: 'planning_snapshot',
    snapshotId: 'psnap-architecture',
    atIso: ISO,
    planId: PLAN_ID,
    versionHint: 0,
    execution: 'none',
  }
}

export function buildPlanningValidationContract(): PlanningValidationContract {
  return {
    kind: 'travel_planning_validation',
    validation: buildPlanningValidationSample(),
    execution: 'none',
  }
}

export function buildPlanningLifecycle(): PlanningLifecycleContract {
  return {
    kind: 'travel_planning_lifecycle',
    actions: TRAVEL_PLANNING_LIFECYCLE_ACTIONS,
    currentActionHint: null,
    execution: 'none',
  }
}

export function buildPlanningStrategy(): PlanningStrategyContract {
  return {
    kind: 'travel_planning_strategy',
    strategyHints: [
      'structure_only',
      'never_book',
      'prefer_constraints_over_suggestions',
    ],
    execution: 'none',
  }
}

export function buildPlanningConstraints(): PlanningConstraintsContract {
  return {
    kind: 'travel_planning_constraints',
    constraints: [buildPlanningConstraintSample()],
    execution: 'none',
  }
}

export function buildPlanningGoals(): PlanningGoalsContract {
  return {
    kind: 'travel_planning_goals',
    goals: [buildPlanningGoalSample()],
    execution: 'none',
  }
}

export function buildPlanningPriorities(): PlanningPrioritiesContract {
  return {
    kind: 'travel_planning_priorities',
    priorityHints: [
      'intent',
      'constraints',
      'budget',
      'dates',
      'destination',
      'preferences',
      'profile',
    ],
    execution: 'none',
  }
}

export function buildPlanningRules(): PlanningRulesContract {
  return {
    kind: 'travel_planning_rules',
    ruleHints: [
      'deny_booking_side_effects',
      'deny_pricing_calls',
      'require_intent_before_structure',
    ],
    execution: 'none',
  }
}

export function buildPlanningTimeline(): PlanningTimelineContract {
  return {
    kind: 'travel_planning_timeline',
    steps: [buildPlanningStepSample()],
    execution: 'none',
  }
}

export function buildPlanningSnapshotContract(): PlanningSnapshotContract {
  return {
    kind: 'travel_planning_snapshot',
    snapshot: buildPlanningSnapshotSample(),
    execution: 'none',
  }
}

export function buildPlanningConfidenceContract(): PlanningConfidenceContract {
  return {
    kind: 'travel_planning_confidence',
    confidence: buildPlanningConfidenceSample(),
    execution: 'none',
  }
}

export function buildPlanningRevisionContract(): PlanningRevisionContract {
  return {
    kind: 'travel_planning_revision',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildPlanningVersion(): PlanningVersionContract {
  return {
    kind: 'travel_planning_version',
    version: 0,
    previousVersion: null,
    execution: 'none',
  }
}

export function buildPlanningAlternatives(): PlanningAlternativesContract {
  return {
    kind: 'travel_planning_alternatives',
    alternatives: [],
    execution: 'none',
  }
}

export function buildPlanningOptimization(): PlanningOptimizationContract {
  return {
    kind: 'travel_planning_optimization',
    optimizationHints: ['schedule_hint', 'budget_hint'],
    executed: false,
    execution: 'none',
  }
}
