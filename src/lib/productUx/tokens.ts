/**
 * Product Sprint A — UX/UI Foundation tokens.
 * Single design language for the new experience. Reuses existing primary palette.
 */

export const PRODUCT_UX_SPRINT = 'product-sprint-a' as const
export const PRODUCT_UX_VERSION = '1.0.0-foundation' as const
export const UI_NEW_EXPERIENCE_FEATURE_ID = 'ui.new_experience' as const

export const productBrand = {
  nameAr: 'Bilamo',
  nameEn: 'Bilamo',
  markPath:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm0 3.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13z',
} as const

export const productTypography = {
  family: {
    display: '"Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
    body: '"Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  size: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.25rem',
    hero: 'clamp(2.5rem, 8vw, 4.25rem)',
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const

export const productSpacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const

export const productRadius = {
  none: '0',
  sm: '0.5rem',
  md: '0.75rem',
  control: '0.9rem',
  lg: '1rem',
  panel: '1.35rem',
  hero: '1.75rem',
  pill: '999px',
} as const

export const productElevation = {
  none: 'none',
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  md: '0 4px 14px rgba(15, 23, 42, 0.08)',
  lg: '0 12px 32px rgba(15, 23, 42, 0.12)',
  glow: '0 12px 40px rgba(28, 128, 240, 0.18)',
} as const

export const productBorders = {
  subtle: '1px solid rgba(148, 163, 184, 0.28)',
  strong: '1px solid rgba(100, 116, 139, 0.45)',
  focus: '2px solid #1c80f0',
} as const

export const productColors = {
  ink: '#F8FAFC',
  muted: '#94A3B8',
  surface: '#0D1327',
  surfaceMuted: '#050816',
  brand: '#7C3AED',
  brandDeep: '#2e1065',
  success: '#34D399',
  warning: '#d97706',
  danger: '#F43F5E',
  info: '#22D3EE',
} as const

export const productStatus = {
  listening: { labelAr: 'يستمع', labelEn: 'Listening', color: '#0284c7' },
  thinking: { labelAr: 'يفكّر', labelEn: 'Thinking', color: '#1c80f0' },
  speaking: { labelAr: 'يتحدث', labelEn: 'Speaking', color: '#059669' },
  interrupted: { labelAr: 'تم الإيقاف', labelEn: 'Interrupted', color: '#d97706' },
  reconnecting: { labelAr: 'يعيد الاتصال', labelEn: 'Reconnecting', color: '#d97706' },
  offline: { labelAr: 'غير متصل', labelEn: 'Offline', color: '#64748b' },
  error: { labelAr: 'خطأ', labelEn: 'Error', color: '#e11d48' },
  ready: { labelAr: 'جاهز', labelEn: 'Ready', color: '#059669' },
} as const

/** Bilamo liquid-glass atmosphere — deep navy + violet/cyan bloom. */
export const productAtmosphere = {
  hero:
    'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.45), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(34,211,238,0.28), transparent 50%), #050816',
  page:
    'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.28), transparent 55%), radial-gradient(ellipse 50% 35% at 10% 70%, rgba(34,211,238,0.12), transparent 45%), #050816',
  authSurface: 'rgba(13, 19, 39, 0.72)',
  glow: 'rgba(124, 58, 237, 0.35)',
} as const

export const productMotion = {
  enterMs: 420,
  staggerMs: 70,
  fastMs: 160,
  ease: [0.22, 1, 0.36, 1] as const,
  reducedMotion: false,
} as const

export const productBreakpoints = {
  sm: 390,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const
