import type { ContinueBookingModel, HomeLocale } from '../../lib/aiHome'
import { HomeButton } from './HomeButton'
import { HomeCard } from './HomeCard'
import { SectionHeader } from './SectionHeader'
import { StatusChip } from './StatusChip'

export interface ContinueBookingPanelProps {
  locale: HomeLocale
  model: ContinueBookingModel
  onResume: () => void
}

export function ContinueBookingPanel({ locale, model, onResume }: ContinueBookingPanelProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <section data-testid="ai-home-continue-booking">
      <SectionHeader
        title={t('متابعة الحجز', 'Continue booking')}
        subtitle={t('أكمل رحلتك من حيث توقفت', 'Pick up where you left off')}
      />
      <HomeCard className="border-primary-100 bg-gradient-to-l from-primary-50/40 via-white to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {model.bookingReference}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">{model.title}</p>
            <div className="mt-2">
              <StatusChip
                label={locale === 'ar' ? model.statusLabelAr : model.statusLabelEn}
                tone="info"
              />
            </div>
          </div>
          <HomeButton size="sm" onClick={onResume} data-testid="ai-home-resume">
            {t('استئناف', 'Resume')}
          </HomeButton>
        </div>

        <ol className="mt-4 space-y-2 border-s-2 border-slate-100 ps-3">
          {model.remainingSteps.map((step) => (
            <li key={step.id} className="text-xs text-slate-600">
              <span className={`font-semibold ${step.current ? 'text-primary-700' : ''}`}>
                {locale === 'ar' ? step.labelAr : step.labelEn}
              </span>
              {step.current ? (
                <span className="ms-2 text-[10px] text-primary-600">
                  {t('الخطوة الحالية', 'Current step')}
                </span>
              ) : null}
              {step.done && !step.current ? (
                <span className="ms-2 text-[10px] text-emerald-600">{t('تم', 'Done')}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </HomeCard>
    </section>
  )
}
