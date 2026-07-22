/**
 * Sprint 118 — Editable AI Conversation barrel.
 */

export {
  EDITABLE_CONVERSATION_FEATURE_ID,
  isEditableConversationEnabled,
} from './feature'

export {
  SPRINT118_EDITABLE_CONVERSATION_VERSION,
  analyzeEdit,
  EditAnalyzer,
  createEditAnalyzer,
  type EditKind,
  type EditSnapshot,
  type ConversationEditInput,
  type AnalyzedEdit,
} from './EditAnalyzer'

export {
  coreStagesForEdit,
  planAffectedStages,
  AffectedStages,
  createAffectedStages,
  type AffectedStagesPlan,
} from './AffectedStages'

export {
  buildEditPlan,
  EditPlanner,
  createEditPlanner,
  type EditPlan,
} from './EditPlanner'

export {
  buildPartialPipelineInput,
  runPartialExecution,
  PartialExecution,
  createPartialExecution,
  type PartialExecutionOptions,
} from './PartialExecution'

export {
  buildEditDiff,
  EditDiffBuilder,
  createEditDiffBuilder,
  type EditDiff,
} from './EditDiff'

export {
  EditHistory,
  createEditHistory,
  type EditHistoryEntry,
} from './EditHistory'

export {
  buildEditMetadata,
  EditMetadataBuilder,
  createEditMetadataBuilder,
  type EditMetadata,
} from './EditMetadata'

export {
  EditRunner,
  createEditRunner,
  runConversationEdit,
  type EditRunnerResult,
  type EditRunnerOptions,
} from './EditRunner'

export {
  ConversationEditor,
  createConversationEditor,
  runConversationEditor,
  type ConversationEditorResult,
  type ConversationEditorOptions,
} from './ConversationEditor'
