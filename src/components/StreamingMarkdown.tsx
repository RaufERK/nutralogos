import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingMarkdownProps {
  content: string
}

export default function StreamingMarkdown({ content }: StreamingMarkdownProps) {
  const normalized = content.replace(/\r\n/g, '\n')

  let visible = normalized
  if (normalized && !/\s$/.test(normalized)) {
    const lastSpace = Math.max(
      normalized.lastIndexOf(' '),
      normalized.lastIndexOf('\n'),
      normalized.lastIndexOf('\t'),
      normalized.lastIndexOf('\r')
    )
    if (lastSpace > -1) visible = normalized.slice(0, lastSpace + 1)
  }

  const withBlankLines = visible
    .replace(/\n{2,}/g, '\n\n')
    .replace(/\n(?!\n)/g, '\n\n')

  const blocks = withBlankLines.split('\n\n')

  return (
    <div className='fade-in-soft will-change-auto'>
      {blocks.map((block, idx) => (
        <div key={idx}>
          {block && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
          )}
          {idx < blocks.length - 1 && (
            <div className='h-4' aria-hidden='true'></div>
          )}
        </div>
      ))}
    </div>
  )
}
