/**
 * Module registry — catalogs presentation modules (no loaders here).
 */

import type { IntegrationModuleDefinition, IntegrationModuleId } from '../types'

export const INTEGRATION_MODULES: readonly IntegrationModuleDefinition[] = [
  {
    id: 'application_shell',
    featureId: 'ui.application_shell',
    nameAr: 'هيكل التطبيق',
    nameEn: 'Application Shell',
    phase: '4.1',
    dependsOn: [],
    presentationOnly: true,
    packagePath: 'src/ui/applicationShell',
  },
  {
    id: 'conversation_center',
    featureId: 'ui.conversation_center',
    nameAr: 'مركز المحادثة',
    nameEn: 'Conversation Center',
    phase: '4.2',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/conversationCenter',
  },
  {
    id: 'voice_center',
    featureId: 'ui.voice_center',
    nameAr: 'مركز الصوت',
    nameEn: 'Voice Center',
    phase: '4.3',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/voiceCenter',
  },
  {
    id: 'travel_workspace',
    featureId: 'ui.travel_workspace',
    nameAr: 'مساحة السفر',
    nameEn: 'Travel Workspace',
    phase: '4.5',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/travelWorkspace',
  },
  {
    id: 'executive_dashboard',
    featureId: 'ui.executive_dashboard',
    nameAr: 'لوحة التنفيذ',
    nameEn: 'Executive Dashboard',
    phase: '4.6',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/executiveDashboard',
  },
  {
    id: 'command_palette',
    featureId: 'ui.command_palette',
    nameAr: 'لوحة الأوامر',
    nameEn: 'Command Palette',
    phase: '4.8',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/commandPalette',
  },
  {
    id: 'journey_timeline',
    featureId: 'ui.journey_timeline',
    nameAr: 'الجدول الزمني للرحلة',
    nameEn: 'Journey Timeline',
    phase: '5.1',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/journeyTimeline',
  },
  {
    id: 'decision_center',
    featureId: 'ui.decision_center',
    nameAr: 'مركز القرار',
    nameEn: 'Decision Center',
    phase: '5.2',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/decisionCenter',
  },
  {
    id: 'insights_center',
    featureId: 'ui.insights_center',
    nameAr: 'مركز الرؤى',
    nameEn: 'Insights Center',
    phase: '5.3',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/insightsCenter',
  },
  {
    id: 'traveler_profile',
    featureId: 'ui.traveler_profile',
    nameAr: 'ملف المسافر',
    nameEn: 'Traveler Profile',
    phase: '5.4',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/travelerProfile',
  },
  {
    id: 'memory_center',
    featureId: 'ui.memory_center',
    nameAr: 'مركز الذاكرة',
    nameEn: 'Memory Center',
    phase: '5.5',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/memoryCenter',
  },
  {
    id: 'booking_hub',
    featureId: 'ui.booking_hub',
    nameAr: 'مركز الحجوزات',
    nameEn: 'Booking Hub',
    phase: '5.6',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/bookingHub',
  },
  {
    id: 'operations_center',
    featureId: 'ui.operations_center',
    nameAr: 'مركز العمليات',
    nameEn: 'Operations Center',
    phase: '5.7',
    dependsOn: ['ui.application_shell'],
    presentationOnly: true,
    packagePath: 'src/ui/operationsCenter',
  },
] as const

export function getIntegrationModule(
  id: IntegrationModuleId,
): IntegrationModuleDefinition | undefined {
  return INTEGRATION_MODULES.find((m) => m.id === id)
}

export function listIntegrationModules(): readonly IntegrationModuleDefinition[] {
  return INTEGRATION_MODULES
}

export const ModuleRegistry = {
  all: listIntegrationModules,
  get: getIntegrationModule,
  ids: () => INTEGRATION_MODULES.map((m) => m.id),
}
