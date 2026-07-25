/**
 * Phase 6 — Autonomous AI Agent Orchestrator
 * Additive under src/lib/agent/orchestrator/autonomous (Sprint 113 package preserved).
 */

export type {
  AgentToolId,
  AutonomousOrchestratorInput,
  AutonomousOrchestratorResult,
  DecisionRecord,
  ExecutionMemorySnapshot,
  ExecutionStateSnapshot,
  MissionLocale,
  MissionPlan,
  MissionStatus,
  MissionTask,
  OrchestratorTimelineEntry,
  PriorityLevel,
  RecoveryAction,
  TaskKind,
  TaskStatus,
  ToolRouteDecision,
  TravelGoal,
  WorkflowPhase,
} from './types'

export {
  AUTONOMOUS_AGENT_ORCHESTRATOR_FEATURE_ID,
  isAutonomousAgentOrchestratorEnabled,
} from './feature'

export { GoalManager, emptyTravelGoal, updateTravelGoal } from './goalManager'
export { TaskPlanner, planMissionTasks } from './taskPlanner'
export {
  ExecutionPlanner,
  MissionExecutionPlanner,
  buildMissionPlan,
} from './executionPlanner'
export { ExecutionState, createExecutionState, advanceExecution, markTaskDone } from './executionState'
export { ToolOrchestrator, routeTool } from './toolOrchestrator'
export { DecisionEngine, explainMissionDecisions } from './decisionEngine'
export { TaskQueue, sortByPriority, nextRunnableTask, prioritizeClarifications } from './taskQueue'
export { WorkflowManager, deriveMissionStatus, applyWorkflowCommand } from './workflowManager'
export { RecoveryManager, planRecovery, detectConflicts } from './recoveryManager'
export { ExecutionMemory, emptyExecutionMemory, updateExecutionMemory } from './executionMemory'
export {
  AgentOrchestrator,
  runAutonomousAgentOrchestrator,
  PHASE6_AUTONOMOUS_ORCHESTRATOR_VERSION,
} from './agentOrchestrator'
export { enrichWithAutonomousAgentOrchestrator } from './enrich'
