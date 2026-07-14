const QUICK_ACTIONS = [
  {
    id: 'flights',
    label: 'رحلات جوية',
    desc: 'اعثر على أفضل الخيارات',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
    color: 'bg-primary-50 text-primary-600',
  },
  {
    id: 'hotels',
    label: 'فنادق',
    desc: 'أماكن إقامة مختارة',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
        <path d="M9 9v.01M9 12v.01M9 15v.01" />
      </svg>
    ),
    color: 'bg-accent-50 text-accent-600',
  },
  {
    id: 'packages',
    label: 'باقات جاهزة',
    desc: 'رحلات متكاملة',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: 'bg-success-50 text-success-600',
  },
  {
    id: 'visa',
    label: 'تأشيرات',
    desc: 'تحقق من المتطلبات',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
    color: 'bg-warning-50 text-warning-600',
  },
  {
    id: 'explore',
    label: 'استكشاف',
    desc: 'وجهات ملهمة',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    color: 'bg-primary-50 text-primary-600',
  },
  {
    id: 'support',
    label: 'الدعم',
    desc: 'نحن هنا لمساعدتك',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
    color: 'bg-slate-100 text-slate-600',
  },
]

interface Props {
  onAction?: (id: string) => void
}

export default function QuickActions({ onAction }: Props) {
  const handleClick = (id: string) => {
    if (onAction) onAction(id)
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 sm:text-lg">إجراءات سريعة</h3>
        <a href="#" className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700">
          عرض الكل
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => handleClick(action.id)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-100 hover:shadow-md sm:p-5"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${action.color}`}>
              {action.icon}
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900 sm:text-base">{action.label}</span>
              <span className="mt-0.5 block text-xs text-slate-400 sm:text-sm">{action.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
