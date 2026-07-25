/**
 * Shared route registry — development/demo virtual routes only.
 * Not mounted in production React Router.
 */

import type { IntegrationRouteDefinition } from '../types'

export const INTEGRATION_ROUTES: readonly IntegrationRouteDefinition[] = [
  {
    id: 'dev.home',
    path: '/dev/integration',
    screenId: 'developer_nav',
    titleAr: 'أساس التكامل',
    titleEn: 'Integration Foundation',
  },
  {
    id: 'demo.home',
    path: '/dev/integration/demo',
    screenId: 'demo_nav',
    titleAr: 'تنقل العرض',
    titleEn: 'Demo navigation',
  },
  {
    id: 'dev.modules',
    path: '/dev/integration/modules',
    screenId: 'module_preview',
    titleAr: 'معاينة الوحدات',
    titleEn: 'Module previews',
  },
  {
    id: 'dev.module_preview',
    path: '/dev/integration/modules/:moduleId',
    screenId: 'module_preview',
    titleAr: 'معاينة وحدة',
    titleEn: 'Module preview',
  },
  {
    id: 'dev.flags',
    path: '/dev/integration/flags',
    screenId: 'feature_flags',
    titleAr: 'أعلام الميزات',
    titleEn: 'Feature flags',
  },
  {
    id: 'dev.status',
    path: '/dev/integration/status',
    screenId: 'module_status',
    titleAr: 'حالة الوحدات',
    titleEn: 'Module status',
  },
  {
    id: 'dev.graph',
    path: '/dev/integration/graph',
    screenId: 'dependency_graph',
    titleAr: 'مخطط الاعتماد',
    titleEn: 'Dependency graph',
  },
  {
    id: 'dev.architecture',
    path: '/dev/integration/architecture',
    screenId: 'architecture_overview',
    titleAr: 'نظرة معمارية',
    titleEn: 'Architecture overview',
  },
] as const

export function getIntegrationRoute(id: string) {
  return INTEGRATION_ROUTES.find((r) => r.id === id)
}

export function listIntegrationRoutes(): readonly IntegrationRouteDefinition[] {
  return INTEGRATION_ROUTES
}

export const RouteRegistry = {
  all: listIntegrationRoutes,
  get: getIntegrationRoute,
}
