/**
 * Evolution Sprint 4 — ScenarioBranch
 */

import {
  isoNow,
  newId,
  type PlanningLocale,
  type ScenarioBranchRecord,
} from './planningGraphTypes'

export function createScenarioBranch(options: {
  name: string
  rootNodeId: string
  whyExists: string
  locale?: PlanningLocale
  now?: Date
}): ScenarioBranchRecord {
  const stamp = isoNow(options.now)
  return {
    id: newId('branch', options.now),
    name: options.name,
    rootNodeId: options.rootNodeId,
    tipNodeId: options.rootNodeId,
    whyExists: options.whyExists,
    status: 'open',
    locale: options.locale ?? 'ar',
    createdAt: stamp,
    updatedAt: stamp,
    nodeIds: [options.rootNodeId],
  }
}

export function appendNodeToBranch(
  branch: ScenarioBranchRecord,
  nodeId: string,
  now?: Date,
): ScenarioBranchRecord {
  if (branch.nodeIds.includes(nodeId)) {
    return { ...branch, tipNodeId: nodeId, updatedAt: isoNow(now) }
  }
  return {
    ...branch,
    tipNodeId: nodeId,
    nodeIds: [...branch.nodeIds, nodeId],
    updatedAt: isoNow(now),
  }
}

export function setBranchStatus(
  branch: ScenarioBranchRecord,
  status: ScenarioBranchRecord['status'],
  now?: Date,
): ScenarioBranchRecord {
  return { ...branch, status, updatedAt: isoNow(now) }
}

export const ScenarioBranch = {
  create: createScenarioBranch,
  appendNode: appendNodeToBranch,
  setStatus: setBranchStatus,
}
