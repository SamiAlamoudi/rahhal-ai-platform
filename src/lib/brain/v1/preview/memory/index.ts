/**
 * Sprint 88 Task 3 — Preview memory adapters (in-memory only).
 * Not wired into BrainRouter / planTurn / ConversationManager in this task.
 */

export {
  MEMORY_PROVENANCE_CONTRACT_VERSION,
  createMemoryFactProvenance,
  mergeFactIntoRequirementsProvenance,
  resolveProvenanceConflict,
  toAgentFieldProvenanceSource,
  type MemoryProvenanceSource,
  type MemoryFactProvenance,
  type MemoryProvenanceMap,
} from './provenance'

export {
  WORKING_MEMORY_ADAPTER_VERSION,
  WorkingMemoryAdapter,
  createWorkingMemoryAdapter,
  type WorkingSlotKey,
  type WorkingSlotPatch,
  type WorkingMemorySnapshot,
  type WorkingMemoryApplyOptions,
} from './WorkingMemoryAdapter'

export {
  USER_PREFERENCE_ADAPTER_VERSION,
  UserPreferenceAdapter,
  createUserPreferenceAdapter,
  type UserPreferenceSnapshot,
} from './UserPreferenceAdapter'

export {
  TRIP_MEMORY_ADAPTER_VERSION,
  TripMemoryAdapter,
  createTripMemoryAdapter,
  type TripMemorySnapshot,
  type TripInvalidationResult,
} from './TripMemoryAdapter'
