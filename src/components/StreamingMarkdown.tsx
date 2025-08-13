import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingMarkdownProps {
  content: string
}

export default function StreamingMarkdown({ content }: StreamingMarkdownProps) {
  const [revealLength, setRevealLength] = useState(0)
  const targetRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    targetRef.current = content.length

    if (rafRef.current !== null) return

    const step = () => {
      setRevealLength((prev) => {
        const target = targetRef.current
        if (prev >= target) {
          rafRef.current = null
          return prev
        }
        const remaining = target - prev
        const increment = remaining > 80 ? 2 : 1
        return prev + increment
      })
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [content])

  const visible = content.slice(0, revealLength)

  return (
    <div className='fade-in-soft will-change-auto'>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{visible}</ReactMarkdown>
    </div>
  )
}
