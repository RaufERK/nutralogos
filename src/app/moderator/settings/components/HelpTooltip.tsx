'use client'

import { useState } from 'react'

interface HelpTooltipProps {
  content: string
}

export default function HelpTooltip({ content }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className='relative inline-block'>
      <button
        type='button'
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className='inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-300 rounded-full border border-gray-500 hover:border-gray-400 transition-colors'
      >
        <span className='text-xs font-bold'>?</span>
      </button>

      {isOpen && (
        <div className='absolute z-50 w-64 p-3 mt-1 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg shadow-lg -left-32 md:-left-16'>
          <div className='relative'>
            {content}
            <div className='absolute -top-4 left-1/2 transform -translate-x-1/2'>
              <div className='w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900'></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
