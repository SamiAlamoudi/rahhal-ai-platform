/**
 * Phase 4 Stage 1 — Application module registry.
 * Voice ≠ Chat. Knowledge ≠ Chat. Conversation history ≠ Voice/Knowledge.
 */

import type { ShellModuleDefinition, ShellModuleId } from '../types'

export const SHELL_MODULES: readonly ShellModuleDefinition[] = [
  {
    id: 'home',
    titleKey: 'shell.module.home',
    path: '/shell/home',
    showInBottomNav: true,
    showInDrawer: true,
    graphId: 'graph.home',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'ai_conversation_center',
    titleKey: 'shell.module.ai_conversation',
    path: '/shell/conversation',
    showInBottomNav: true,
    showInDrawer: true,
    graphId: 'graph.ai_conversation',
    isolation: {
      notInsideChat: false,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: true,
    },
    enabledByDefault: true,
  },
  {
    id: 'voice_center',
    titleKey: 'shell.module.voice',
    path: '/shell/voice',
    showInBottomNav: true,
    showInDrawer: true,
    graphId: 'graph.voice',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: true,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'knowledge_center',
    titleKey: 'shell.module.knowledge',
    path: '/shell/knowledge',
    showInBottomNav: true,
    showInDrawer: true,
    graphId: 'graph.knowledge',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: true,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'trips',
    titleKey: 'shell.module.trips',
    path: '/shell/trips',
    showInBottomNav: true,
    showInDrawer: true,
    graphId: 'graph.trips',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'executive_trips',
    titleKey: 'shell.module.executive_trips',
    path: '/shell/executive-trips',
    showInBottomNav: false,
    showInDrawer: true,
    graphId: 'graph.executive_trips',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'notifications',
    titleKey: 'shell.module.notifications',
    path: '/shell/notifications',
    showInBottomNav: false,
    showInDrawer: true,
    graphId: 'graph.notifications',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'profile',
    titleKey: 'shell.module.profile',
    path: '/shell/profile',
    showInBottomNav: false,
    showInDrawer: true,
    graphId: 'graph.profile',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'settings',
    titleKey: 'shell.module.settings',
    path: '/shell/settings',
    showInBottomNav: false,
    showInDrawer: true,
    graphId: 'graph.settings',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: true,
  },
  {
    id: 'memory_center_future',
    titleKey: 'shell.module.memory_future',
    path: '/shell/memory',
    showInBottomNav: false,
    showInDrawer: false,
    graphId: 'graph.memory_future',
    isolation: {
      notInsideChat: true,
      ownsVoiceOnly: false,
      ownsKnowledgeOnly: false,
      ownsConversationHistoryOnly: false,
    },
    enabledByDefault: false,
  },
] as const

export function getShellModule(id: ShellModuleId): ShellModuleDefinition | null {
  return SHELL_MODULES.find((m) => m.id === id) ?? null
}

export function listBottomNavModules(): ShellModuleDefinition[] {
  return SHELL_MODULES.filter((m) => m.showInBottomNav && m.enabledByDefault)
}

export function listDrawerModules(): ShellModuleDefinition[] {
  return SHELL_MODULES.filter((m) => m.showInDrawer && m.enabledByDefault)
}

/** Architecture assertion helpers. */
export function assertModuleIsolation(): {
  voiceOutsideChat: boolean
  knowledgeOutsideChat: boolean
  booksOnlyKnowledge: boolean
  conversationHistoryOnlyAiCenter: boolean
  memoryIndependent: boolean
} {
  const voice = getShellModule('voice_center')!
  const knowledge = getShellModule('knowledge_center')!
  const conversation = getShellModule('ai_conversation_center')!
  const memory = getShellModule('memory_center_future')!

  return {
    voiceOutsideChat:
      voice.isolation.notInsideChat && voice.isolation.ownsVoiceOnly && voice.path !== conversation.path,
    knowledgeOutsideChat:
      knowledge.isolation.notInsideChat
      && knowledge.isolation.ownsKnowledgeOnly
      && knowledge.path !== conversation.path,
    booksOnlyKnowledge: knowledge.isolation.ownsKnowledgeOnly,
    conversationHistoryOnlyAiCenter: conversation.isolation.ownsConversationHistoryOnly,
    memoryIndependent:
      memory.isolation.notInsideChat
      && memory.path !== conversation.path
      && memory.path !== voice.path
      && memory.path !== knowledge.path,
  }
}

export const ShellModuleRegistry = {
  modules: SHELL_MODULES,
  get: getShellModule,
  bottomNav: listBottomNavModules,
  drawer: listDrawerModules,
  assertIsolation: assertModuleIsolation,
}
