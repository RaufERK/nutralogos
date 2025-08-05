'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const validateFile = (file: File): string | null => {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = [
      'application/pdf', // ⚠️ Может крашиться на некоторых PDF
      'text/plain', // ✅ Работает нормально
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/epub+zip',
      'application/x-fictionbook+xml',
      'text/xml', // Дополнительный MIME type для FB2
      'application/msword', // DOC - старый формат Word
    ]

    if (file.size > maxSize) {
      return 'Файл слишком большой (максимум 50MB)'
    }

    if (!allowedTypes.includes(file.type)) {
      return 'Неподдерживаемый тип файла. Поддерживаются: PDF⚠️, TXT✅, DOCX✅, EPUB✅, FB2✅, DOC⚠️'
    }

    return null
  }

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadFile[] = Array.from(fileList).map((file) => {
      const error = validateFile(file)
      return {
        id: generateId(),
        file,
        status: error ? 'error' : 'pending',
        progress: 0,
        error,
      }
    })

    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles]
  )

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    const pendingFiles = files.filter((f) => f.status === 'pending')

    for (const fileData of pendingFiles) {
      try {
        // Обновляем статус на uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id
              ? { ...f, status: 'uploading', progress: 0 }
              : f
          )
        )

        const formData = new FormData()
        formData.append('file', fileData.file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileData.id
                ? { ...f, status: 'completed', progress: 100 }
                : f
            )
          )
        } else {
          const error = await response.json()
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileData.id
                ? { ...f, status: 'error', error: error.message }
                : f
            )
          )
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileData.id
              ? { ...f, status: 'error', error: 'Ошибка загрузки' }
              : f
          )
        )
      }
    }

    setIsUploading(false)
  }

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400'
      case 'uploading':
        return 'text-blue-400'
      case 'processing':
        return 'text-yellow-400'
      case 'completed':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Ожидает'
      case 'uploading':
        return 'Загружается'
      case 'processing':
        return 'Обрабатывается'
      case 'completed':
        return 'Завершено'
      case 'error':
        return 'Ошибка'
      default:
        return 'Неизвестно'
    }
  }

  return (
    <div className='space-y-6'>
      {/* Заголовок */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Загрузка файлов</h1>
          <p className='text-gray-400'>
            Загрузите документы для добавления в базу знаний
          </p>
        </div>
        <Link
          href='/admin'
          className='px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors'
        >
          Назад к дашборду
        </Link>
      </div>

      {/* Drag & Drop зона */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-900/40'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800/20'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className='space-y-4'>
          <div className='text-6xl'>📁</div>
          <div>
            <p className='text-lg text-white font-medium'>
              Перетащите файлы сюда или нажмите для выбора
            </p>
            <p className='text-gray-400 mt-2'>
              Поддерживаются: PDF⚠️, TXT✅, DOCX✅, EPUB✅, FB2✅, DOC⚠️
              (максимум 50MB)
              <br />
              <span className='text-yellow-400 text-sm'>
                ⚠️ PDF и DOC могут иметь проблемы с некоторыми файлами
              </span>
            </p>
          </div>
          <input
            type='file'
            multiple
            accept='.pdf,.txt,.docx,.epub,.fb2,.doc'
            onChange={handleFileInput}
            className='hidden'
            id='file-input'
          />
          <label
            htmlFor='file-input'
            className='inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors'
          >
            Выбрать файлы
          </label>
        </div>
      </div>

      {/* Список файлов */}
      {files.length > 0 && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-white'>
              Файлы для загрузки ({files.length})
            </h2>
            <button
              onClick={uploadFiles}
              disabled={
                isUploading || files.every((f) => f.status !== 'pending')
              }
              className='px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors'
            >
              {isUploading ? 'Загружается...' : 'Загрузить все'}
            </button>
          </div>

          <div className='space-y-3'>
            {files.map((fileData) => (
              <div
                key={fileData.id}
                className='bg-gray-800/90 rounded-lg p-4 border border-gray-700'
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center space-x-3'>
                      <span className='text-2xl'>
                        {fileData.file.type === 'application/pdf'
                          ? '📄'
                          : fileData.file.type === 'text/plain'
                          ? '📝'
                          : fileData.file.type ===
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          ? '📄'
                          : fileData.file.type === 'application/epub+zip'
                          ? '📚'
                          : fileData.file.type ===
                            'application/x-fictionbook+xml'
                          ? '📖'
                          : fileData.file.type === 'application/msword'
                          ? '📝⚠️'
                          : '📝'}
                      </span>
                      <div className='flex-1'>
                        <p className='text-white font-medium'>
                          {fileData.file.name}
                        </p>
                        <p className='text-gray-400 text-sm'>
                          {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    {/* Прогресс-бар */}
                    {fileData.status === 'uploading' && (
                      <div className='mt-3'>
                        <div className='w-full bg-gray-700 rounded-full h-2'>
                          <div
                            className='bg-blue-500 h-2 rounded-full transition-all duration-300'
                            style={{ width: `${fileData.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Статус */}
                    <div className='mt-2 flex items-center space-x-2'>
                      <span
                        className={`text-sm ${getStatusColor(fileData.status)}`}
                      >
                        {getStatusText(fileData.status)}
                      </span>
                      {fileData.error && (
                        <span className='text-red-400 text-sm'>
                          {fileData.error}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Кнопка удаления */}
                  {fileData.status === 'pending' && (
                    <button
                      onClick={() => removeFile(fileData.id)}
                      className='text-red-400 hover:text-red-300 p-2'
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
