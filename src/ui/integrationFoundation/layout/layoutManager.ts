/**
 * Shared layout manager — presentation chrome for foundation screens.
 */

import type { IntegrationScreenId } from '../types'

export interface LayoutChromeModel {
  showSidebar: boolean
  showPreviewFrame: boolean
  pageTransitionClass: string
}

export function resolveLayoutChrome(
  screenId: IntegrationScreenId,
): LayoutChromeModel {
  return {
    showSidebar: true,
    showPreviewFrame: screenId === 'module_preview',
    pageTransitionClass: 'rahhal-if-page',
  }
}

export const LayoutManager = {
  resolve: resolveLayoutChrome,
}
