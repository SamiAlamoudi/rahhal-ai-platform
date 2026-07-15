import { useState } from 'react'
import { copyTextToClipboard, parseInlineMarkdown, parseMarkdownBlocks } from '../../lib/chat/chatHelpers'

function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((token, index) => {
        if (token.type === 'bold') {
          return <strong key={index} className="font-semibold">{token.value}</strong>
        }
        if (token.type === 'italic') {
          return <em key={index}>{token.value}</em>
        }
        if (token.type === 'code') {
          return (
            <code
              key={index}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800"
            >
              {token.value}
            </code>
          )
        }
        return <span key={index}>{token.value}</span>
      })}
    </>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-50">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[11px] text-slate-300">
        <span className="font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded px-2 py-0.5 transition-colors hover:bg-slate-800"
        >
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content)

  if (!content.trim()) {
    return <p className="text-sm text-slate-400">…</p>
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'
          const size =
            block.level === 1 ? 'text-lg' : block.level === 2 ? 'text-base' : 'text-sm'
          return (
            <Tag key={index} className={`${size} font-bold text-slate-900`}>
              <InlineMarkdown text={block.text} />
            </Tag>
          )
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag
              key={index}
              className={`ms-5 space-y-1 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ListTag>
          )
        }
        if (block.type === 'code') {
          return <CodeBlock key={index} language={block.language} code={block.code} />
        }
        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={index}
              className="border-s-2 border-primary-300 ps-3 text-slate-600"
            >
              <InlineMarkdown text={block.text} />
            </blockquote>
          )
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            <InlineMarkdown text={block.text} />
          </p>
        )
      })}
    </div>
  )
}
