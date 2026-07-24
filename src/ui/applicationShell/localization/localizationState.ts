/**
 * Phase 4 Stage 1 — Localization architecture (Arabic RTL / English LTR).
 * Catalog keys only — no full translation loading in this stage.
 */

import type { ShellLocale, ShellLocalizationState } from '../types'
import { directionForLocale } from '../types'

export const SHELL_MESSAGE_CATALOG_IDS = [
  'shell.module.home',
  'shell.module.ai_conversation',
  'shell.module.voice',
  'shell.module.knowledge',
  'shell.module.trips',
  'shell.module.executive_trips',
  'shell.module.notifications',
  'shell.module.profile',
  'shell.module.settings',
  'shell.module.memory_future',
  'shell.nav.drawer',
  'shell.nav.bottom',
  'shell.empty.generic',
  'shell.error.generic',
] as const

const FALLBACK_LABELS: Record<ShellLocale, Record<string, string>> = {
  ar: {
    'shell.module.home': 'الرئيسية',
    'shell.module.ai_conversation': 'مركز المحادثة',
    'shell.module.voice': 'مركز الصوت',
    'shell.module.knowledge': 'مركز المعرفة',
    'shell.module.trips': 'رحلاتي',
    'shell.module.executive_trips': 'رحلات تنفيذية',
    'shell.module.notifications': 'الإشعارات',
    'shell.module.profile': 'الملف',
    'shell.module.settings': 'الإعدادات',
    'shell.module.memory_future': 'مركز الذاكرة (مستقبلاً)',
    'shell.nav.drawer': 'القائمة',
    'shell.nav.bottom': 'التنقل',
    'shell.empty.generic': 'لا يوجد محتوى بعد',
    'shell.error.generic': 'حدث خطأ في الواجهة',
  },
  en: {
    'shell.module.home': 'Home',
    'shell.module.ai_conversation': 'AI Conversation',
    'shell.module.voice': 'Voice Center',
    'shell.module.knowledge': 'Knowledge Center',
    'shell.module.trips': 'Trips',
    'shell.module.executive_trips': 'Executive Trips',
    'shell.module.notifications': 'Notifications',
    'shell.module.profile': 'Profile',
    'shell.module.settings': 'Settings',
    'shell.module.memory_future': 'Memory Center (future)',
    'shell.nav.drawer': 'Menu',
    'shell.nav.bottom': 'Navigation',
    'shell.empty.generic': 'Nothing here yet',
    'shell.error.generic': 'Something went wrong in the shell',
  },
}

export function createLocalizationState(locale: ShellLocale = 'ar'): ShellLocalizationState {
  return {
    locale,
    direction: directionForLocale(locale),
    catalogIds: [...SHELL_MESSAGE_CATALOG_IDS],
  }
}

export function tShell(locale: ShellLocale, key: string): string {
  return FALLBACK_LABELS[locale][key] ?? key
}

export function switchShellLocale(
  state: ShellLocalizationState,
  locale: ShellLocale,
): ShellLocalizationState {
  return {
    ...state,
    locale,
    direction: directionForLocale(locale),
  }
}

export const ShellLocalization = {
  create: createLocalizationState,
  t: tShell,
  switchLocale: switchShellLocale,
  catalogIds: SHELL_MESSAGE_CATALOG_IDS,
}
