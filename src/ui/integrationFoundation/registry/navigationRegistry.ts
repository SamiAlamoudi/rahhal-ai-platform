/**
 * Navigation registry — developer + demo navigation graphs.
 */

import type { IntegrationNavItem } from '../types'
import { INTEGRATION_MODULES } from './moduleRegistry'

export const DEVELOPER_NAV_ITEMS: readonly IntegrationNavItem[] = [
  {
    id: 'nav-dev-home',
    routeId: 'dev.home',
    labelAr: 'تنقل المطوّر',
    labelEn: 'Developer navigation',
    screenId: 'developer_nav',
  },
  {
    id: 'nav-demo',
    routeId: 'demo.home',
    labelAr: 'تنقل العرض',
    labelEn: 'Demo navigation',
    screenId: 'demo_nav',
  },
  {
    id: 'nav-modules',
    routeId: 'dev.modules',
    labelAr: 'معاينة الوحدات',
    labelEn: 'Module previews',
    screenId: 'module_preview',
  },
  {
    id: 'nav-flags',
    routeId: 'dev.flags',
    labelAr: 'أعلام الميزات',
    labelEn: 'Feature flags',
    screenId: 'feature_flags',
  },
  {
    id: 'nav-status',
    routeId: 'dev.status',
    labelAr: 'حالة الوحدات',
    labelEn: 'Module status',
    screenId: 'module_status',
  },
  {
    id: 'nav-graph',
    routeId: 'dev.graph',
    labelAr: 'مخطط الاعتماد',
    labelEn: 'Dependency graph',
    screenId: 'dependency_graph',
  },
  {
    id: 'nav-arch',
    routeId: 'dev.architecture',
    labelAr: 'نظرة معمارية',
    labelEn: 'Architecture overview',
    screenId: 'architecture_overview',
  },
] as const

export const DEMO_NAV_ITEMS: readonly IntegrationNavItem[] =
  INTEGRATION_MODULES.map((mod) => ({
    id: `nav-demo-${mod.id}`,
    routeId: 'dev.module_preview' as const,
    labelAr: mod.nameAr,
    labelEn: mod.nameEn,
    moduleId: mod.id,
    screenId: 'module_preview' as const,
  }))

export function listDeveloperNav(): readonly IntegrationNavItem[] {
  return DEVELOPER_NAV_ITEMS
}

export function listDemoNav(): readonly IntegrationNavItem[] {
  return DEMO_NAV_ITEMS
}

export const NavigationRegistry = {
  developer: listDeveloperNav,
  demo: listDemoNav,
}
