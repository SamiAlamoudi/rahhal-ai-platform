/**
 * Phase 4 Stage 1 — Design-system primitive contracts (architecture).
 * No booking/search implementations — structural roles only.
 */

export type ShellPrimitiveRole =
  | 'Card'
  | 'Button'
  | 'Input'
  | 'List'
  | 'Section'
  | 'Sheet'
  | 'Dialog'
  | 'Badge'
  | 'Icon'
  | 'Loading'
  | 'EmptyState'
  | 'ErrorState'
  | 'Skeleton'
  | 'Snackbar'
  | 'BottomSheet'

export interface ShellPrimitiveSpec {
  role: ShellPrimitiveRole
  description: string
  tokenDeps: string[]
}

export const SHELL_PRIMITIVE_SPECS: readonly ShellPrimitiveSpec[] = [
  { role: 'Card', description: 'Surface container for module content.', tokenDeps: ['radius.md', 'elevation.sm'] },
  { role: 'Button', description: 'Primary / secondary / ghost actions.', tokenDeps: ['radius.md', 'spacing.md'] },
  { role: 'Input', description: 'Text fields and selectors.', tokenDeps: ['radius.md', 'spacing.sm'] },
  { role: 'List', description: 'Scrollable item collections.', tokenDeps: ['spacing.sm'] },
  { role: 'Section', description: 'Titled content grouping.', tokenDeps: ['typography.sizeLg', 'spacing.lg'] },
  { role: 'Sheet', description: 'Overlay panel container.', tokenDeps: ['elevation.lg', 'radius.xl'] },
  { role: 'Dialog', description: 'Modal confirmation / info.', tokenDeps: ['elevation.lg', 'radius.lg'] },
  { role: 'Badge', description: 'Status / count indicators.', tokenDeps: ['radius.pill', 'typography.sizeXs'] },
  { role: 'Icon', description: 'Icon slot sizes.', tokenDeps: ['spacing.md'] },
  { role: 'Loading', description: 'Async progress indicator.', tokenDeps: ['spacing.md'] },
  { role: 'EmptyState', description: 'No-content placeholder.', tokenDeps: ['spacing.xl', 'typography.sizeMd'] },
  { role: 'ErrorState', description: 'Recoverable error placeholder.', tokenDeps: ['spacing.xl'] },
  { role: 'Skeleton', description: 'Content loading shimmer.', tokenDeps: ['radius.md'] },
  { role: 'Snackbar', description: 'Transient toast message.', tokenDeps: ['elevation.md', 'radius.md'] },
  { role: 'BottomSheet', description: 'Mobile bottom overlay.', tokenDeps: ['elevation.lg', 'radius.xl'] },
] as const

export const ShellPrimitives = {
  specs: SHELL_PRIMITIVE_SPECS,
}
