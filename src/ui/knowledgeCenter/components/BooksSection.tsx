import type { KnowledgeCenterLocale, KnowledgeDocument } from '../types'

export interface BooksSectionProps {
  books: KnowledgeDocument[]
  locale?: KnowledgeCenterLocale
  onOpen?: (id: string) => void
}

/**
 * Dedicated Books section — where the two future books will live.
 * Books are NOT shown inside Chat or Voice.
 */
export function BooksSection({ books, locale = 'ar', onOpen }: BooksSectionProps) {
  return (
    <section
      className="rahhal-kc-books"
      data-testid="kc-books-section"
      data-books-dedicated="true"
    >
      <header>
        <h2>{locale === 'en' ? 'Books' : 'الكتب'}</h2>
        <p>
          {locale === 'en'
            ? 'Dedicated shelf for Rahhal books — not inside Chat or Voice.'
            : 'رف مخصص لكتب رحّال — ليس داخل المحادثة أو الصوت.'}
        </p>
      </header>

      <div className="rahhal-kc-books__shelf" data-testid="kc-books-shelf">
        {books.length === 0 ? (
          <>
            <article className="rahhal-kc-books__slot" data-testid="kc-book-slot-1">
              <h3>{locale === 'en' ? 'Book One (placeholder)' : 'الكتاب الأول (واجهة)'}</h3>
              <p>{locale === 'en' ? 'Reserved shelf slot' : 'مكان محجوز على الرف'}</p>
            </article>
            <article className="rahhal-kc-books__slot" data-testid="kc-book-slot-2">
              <h3>{locale === 'en' ? 'Book Two (placeholder)' : 'الكتاب الثاني (واجهة)'}</h3>
              <p>{locale === 'en' ? 'Reserved shelf slot' : 'مكان محجوز على الرف'}</p>
            </article>
          </>
        ) : (
          books.map((book) => (
            <article
              key={book.id}
              className="rahhal-kc-books__slot"
              data-testid="kc-book-item"
              data-doc-id={book.id}
            >
              <h3>{book.title}</h3>
              <p>{book.preview}</p>
              <button type="button" onClick={() => onOpen?.(book.id)}>
                {locale === 'en' ? 'Open' : 'فتح'}
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
