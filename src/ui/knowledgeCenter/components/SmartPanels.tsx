import type { KnowledgeCenterLocale, KnowledgeSmartPanel } from '../types'
import { KNOWLEDGE_SMART_PANELS } from '../types'

export interface SmartPanelsProps {
  active: KnowledgeSmartPanel
  locale?: KnowledgeCenterLocale
  onChange: (panel: KnowledgeSmartPanel) => void
}

const PANEL_LABEL: Record<KnowledgeSmartPanel, { ar: string; en: string }> = {
  recently_opened: { ar: 'فُتحت مؤخراً', en: 'Recently opened' },
  recommended: { ar: 'موصى بها', en: 'Recommended' },
  popular: { ar: 'الأكثر شيوعاً', en: 'Popular' },
  favorites: { ar: 'المفضلة', en: 'Favorites' },
  downloads: { ar: 'التنزيلات', en: 'Downloads' },
  offline: { ar: 'دون اتصال', en: 'Offline' },
}

/** Smart panels — UI chips only; downloads/offline are placeholders. */
export function SmartPanels({ active, locale = 'ar', onChange }: SmartPanelsProps) {
  return (
    <div className="rahhal-kc-smart" data-testid="kc-smart-panels">
      {KNOWLEDGE_SMART_PANELS.map((panel) => (
        <button
          key={panel}
          type="button"
          data-smart-panel={panel}
          data-placeholder={
            panel === 'downloads' || panel === 'offline' ? 'true' : 'false'
          }
          className={active === panel ? 'is-active' : undefined}
          aria-pressed={active === panel}
          onClick={() => onChange(panel)}
        >
          {locale === 'en' ? PANEL_LABEL[panel].en : PANEL_LABEL[panel].ar}
        </button>
      ))}
    </div>
  )
}
