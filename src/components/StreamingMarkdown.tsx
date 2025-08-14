import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingMarkdownProps {
  content: string
}

export default function StreamingMarkdown({ content }: StreamingMarkdownProps) {
  let visible = content
  if (content && !/\s$/.test(content)) {
    const lastSpace = Math.max(
      content.lastIndexOf(' '),
      content.lastIndexOf('\n'),
      content.lastIndexOf('\t'),
      content.lastIndexOf('\r')
    )
    if (lastSpace > -1) visible = content.slice(0, lastSpace + 1)
  }

  return (
    <div className='fade-in-soft will-change-auto'>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{visible}</ReactMarkdown>
    </div>
  )
}
