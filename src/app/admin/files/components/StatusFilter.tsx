'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface StatusFilterProps {
  currentStatus: string
  totalFiles: number
  displayedFiles: number
}

export default function StatusFilter({
  currentStatus,
  totalFiles,
  displayedFiles,
}: StatusFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newStatus === 'all') {
      params.delete('status')
    } else {
      params.set('status', newStatus)
    }

    params.set('page', '1') // Reset to first page when filtering

    router.push(`/admin/files?${params.toString()}`)
  }

  return (
    <div className='bg-gray-800 rounded-lg p-4'>
      <div className='flex items-center justify-between flex-wrap gap-4'>
        <div className='flex items-center space-x-4'>
          <span className='text-white font-medium'>Фильтр по статусу:</span>
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className='bg-gray-700 text-white px-3 py-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='all'>Все статусы</option>
            <option value='original_uploaded'>Загружено</option>
            <option value='embedded'>Встроено</option>
            <option value='duplicate_content'>Дубликат</option>
            <option value='failed'>Ошибка</option>
          </select>
        </div>

        <div className='text-gray-400'>
          Показано {displayedFiles} из {totalFiles} файлов
        </div>
      </div>
    </div>
  )
}
