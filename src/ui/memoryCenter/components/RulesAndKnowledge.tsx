import type {
  MemoryCategoryChip,
  MemoryCenterLocale,
  MemoryConversationItem,
  MemoryPlaceItem,
  MemoryRuleItem,
  MemorySourceBadge,
} from '../types'

export interface RulesAndKnowledgeProps {
  conversationMemories: MemoryConversationItem[]
  customRules: MemoryRuleItem[]
  alwaysDo: MemoryRuleItem[]
  neverDo: MemoryRuleItem[]
  knowledgeSources: MemorySourceBadge[]
  memoryCategories: MemoryCategoryChip[]
  bookmarks: MemoryPlaceItem[]
  editPlaceholder: string
  deletePlaceholder: string
  locale: MemoryCenterLocale
}

function RuleList({
  title,
  items,
  testId,
}: {
  title: string
  items: MemoryRuleItem[]
  testId: string
}) {
  return (
    <section className="rahhal-mc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <ul className="rahhal-mc-list">
        {items.map((rule) => (
          <li key={rule.id}>{rule.text}</li>
        ))}
      </ul>
    </section>
  )
}

export function RulesAndKnowledge({
  conversationMemories,
  customRules,
  alwaysDo,
  neverDo,
  knowledgeSources,
  memoryCategories,
  bookmarks,
  editPlaceholder,
  deletePlaceholder,
  locale,
}: RulesAndKnowledgeProps) {
  return (
    <>
      <section
        className="rahhal-mc-panel"
        data-testid="mc-conversation-memories"
      >
        <h2>
          {locale === 'en' ? 'Conversation memories' : 'ذكريات المحادثات'}
        </h2>
        <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
          {conversationMemories.map((m) => (
            <article key={m.id} className="rahhal-mc-card">
              <strong>{m.title}</strong>
              <span>{m.snippet}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="rahhal-mc-grid">
        <RuleList
          title={locale === 'en' ? 'Custom rules' : 'قواعد مخصصة'}
          items={customRules}
          testId="mc-custom-rules"
        />
        <RuleList
          title={locale === 'en' ? 'Always do' : 'افعل دائمًا'}
          items={alwaysDo}
          testId="mc-always-do"
        />
        <RuleList
          title={locale === 'en' ? 'Never do' : 'لا تفعل أبدًا'}
          items={neverDo}
          testId="mc-never-do"
        />
      </div>

      <div className="rahhal-mc-layout">
        <section className="rahhal-mc-panel" data-testid="mc-knowledge-sources">
          <h2>
            {locale === 'en' ? 'Knowledge sources' : 'مصادر المعرفة'}
          </h2>
          <div className="rahhal-mc-badges" data-testid="mc-source-badges">
            {knowledgeSources.map((src) => (
              <span key={src.id} data-kind={src.kind}>
                {src.label}
              </span>
            ))}
          </div>
        </section>

        <section className="rahhal-mc-panel" data-testid="mc-memory-categories">
          <h2>
            {locale === 'en' ? 'Memory categories' : 'فئات الذاكرة'}
          </h2>
          <div className="rahhal-mc-chips" data-testid="mc-category-chips">
            {memoryCategories.map((cat) => (
              <span key={cat.id} className="is-active">
                {cat.label} · {cat.count}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="rahhal-mc-panel" data-testid="mc-bookmarks">
        <h2>{locale === 'en' ? 'Bookmarks' : 'الإشارات المرجعية'}</h2>
        <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
          {bookmarks.map((bm) => (
            <article key={bm.id} className="rahhal-mc-card">
              <strong>{bm.name}</strong>
              <em>{bm.meta}</em>
            </article>
          ))}
        </div>
      </section>

      <div className="rahhal-mc-layout">
        <section className="rahhal-mc-panel" data-testid="mc-edit-placeholder">
          <h2>{locale === 'en' ? 'Edit' : 'تعديل'}</h2>
          <div className="rahhal-mc-placeholder">{editPlaceholder}</div>
        </section>
        <section className="rahhal-mc-panel" data-testid="mc-delete-placeholder">
          <h2>{locale === 'en' ? 'Delete' : 'حذف'}</h2>
          <div className="rahhal-mc-placeholder">{deletePlaceholder}</div>
        </section>
      </div>
    </>
  )
}
