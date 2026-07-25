import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  productBrandName,
  productCopy,
  productMotion,
  type ProductLocale,
} from '../../lib/productUx'
import { Atmosphere } from './Atmosphere'
import { BrandMark } from './BrandMark'
import { SurfacePanel } from './SurfacePanel'

export interface AuthExperienceProps {
  locale?: ProductLocale
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * Brand-first Arabic auth composition — full-bleed atmosphere + one interaction panel.
 */
export function AuthExperience({
  locale = 'ar',
  title,
  subtitle,
  children,
  footer,
}: AuthExperienceProps) {
  const brand = productBrandName(locale)

  return (
    <Atmosphere variant="auth" className="min-h-screen">
      <div
        className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6"
        data-testid="product-auth-experience"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: productMotion.enterMs / 1000, ease: productMotion.ease }}
          className="mb-8 text-center"
        >
          <BrandMark locale={locale} size="hero" withName stacked inverted />
          <p className="mt-4 text-sm font-medium tracking-wide text-sky-100/90">
            {productCopy(locale, 'tagline')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-sky-100/75">
            {productCopy(locale, 'promise')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: productMotion.enterMs / 1000,
            delay: 0.08,
            ease: productMotion.ease,
          }}
        >
          <SurfacePanel className="p-6 sm:p-7">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{subtitle}</p>
            <div className="mt-5">{children}</div>
            {footer ? <div className="mt-5">{footer}</div> : null}
          </SurfacePanel>
        </motion.div>

        <p className="mt-8 text-center text-xs text-sky-100/55">
          {brand} · {productCopy(locale, 'tagline')}
        </p>
      </div>
    </Atmosphere>
  )
}
