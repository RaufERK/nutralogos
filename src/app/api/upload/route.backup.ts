import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { FileUtils } from '@/lib/file-utils'
import { FileProcessor } from '@/lib/file-processor'
import { FileRepository } from '@/lib/file-repository'
import { getEmbedding } from '@/lib/openai'
import { upsertPoints } from '@/lib/qdrant'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    console.log('[UPLOAD] Получен запрос на загрузку файла')
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('[UPLOAD] Файл не найден в formData')
      return NextResponse.json(
        { step: 'file_check', error: 'Файл не найден' },
        { status: 400 }
      )
    }
    console.log(
      `[UPLOAD] Получен файл: name=${file.name}, size=${file.size}, type=${file.type}`
    )

    // Валидация файла
    const validation = FileUtils.validateFile({
      size: file.size,
      mimetype: file.type,
      originalname: file.name,
    })

    if (!validation.valid) {
      console.log(`[UPLOAD] Ошибка валидации: ${validation.error}`)
      return NextResponse.json(
        { step: 'validation', error: validation.error },
        { status: 400 }
      )
    }

    // Проверяем поддержку типа файла
    if (!FileProcessor.isSupportedFileType(file.type)) {
      console.log(`[UPLOAD] Неподдерживаемый тип файла: ${file.type}`)
      return NextResponse.json(
        { step: 'type_check', error: 'Неподдерживаемый тип файла' },
        { status: 400 }
      )
    }

    // Создаем уникальную папку для файла
    const processId = randomUUID()
    const uploadDir = join(
      process.cwd(),
      'uploads',
      'temp',
      'processing',
      processId
    )
    const filePath = join(uploadDir, file.name)

    // Создаем директорию
    await FileUtils.ensureDir(uploadDir)

    // Сохраняем файл
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    console.log(`[UPLOAD] Файл сохранен: ${filePath}`)

    // Вычисляем хеш файла
    const fileHash = createHash('sha256').update(buffer).digest('hex')
    console.log(`[UPLOAD] Хеш файла: ${fileHash}`)

    // Проверяем дубликаты в БД
    try {
      const existingFile = await FileRepository.findByHash(fileHash)
      if (existingFile) {
        console.log('[UPLOAD] Найден дубликат файла, удаляем временный файл')
        await FileUtils.removeFile(filePath)
        await FileUtils.removeDir(uploadDir)

        return NextResponse.json({
          success: true,
          step: 'duplicate_check',
          message: 'Файл уже был загружен ранее',
          duplicate: true,
          file: existingFile,
        })
      }
    } catch (dbError) {
      console.log('[UPLOAD] Ошибка проверки дубликатов:', dbError)
      // Продолжаем обработку, даже если база недоступна
    }

    console.log('[UPLOAD] Начинаем обработку нового файла')

    // Обрабатываем файл
    const processedFile = await FileProcessor.processPDF(filePath)
    console.log(
      `[UPLOAD] Файл обработан: ${processedFile.chunks.length} чанков`
    )

    // Создаем эмбеддинги для каждого чанка
    console.log('[UPLOAD] Создаем эмбеддинги...')
    const embeddingPromises = processedFile.chunks.map(async (chunk, index) => {
      try {
        const embedding = await getEmbedding(chunk.content)
        console.log(
          `[UPLOAD] Эмбеддинг ${index + 1}/${
            processedFile.chunks.length
          } создан`
        )
        return {
          id: `${fileHash}_chunk_${index}`,
          vector: embedding,
          payload: {
            content: chunk.content,
            chunkIndex: index,
            fileName: file.name,
            fileHash: fileHash,
            uploadDate: new Date().toISOString(),
            metadata: processedFile.metadata,
          },
        }
      } catch (embeddingError) {
        console.error(
          `[UPLOAD] Ошибка создания эмбеддинга для чанка ${index}:`,
          embeddingError
        )
        throw embeddingError
      }
    })

    const embeddings = await Promise.all(embeddingPromises)
    console.log(`[UPLOAD] Создано ${embeddings.length} эмбеддингов`)

    // Загружаем в Qdrant
    console.log('[UPLOAD] Загружаем в Qdrant...')
    try {
      await upsertPoints(embeddings)
      console.log(
        '[UPLOAD] Данные успешно загружены в Qdrant',
        embeddings.length
      )
    } catch (qdrantError) {
      console.error('[UPLOAD] Ошибка загрузки в Qdrant:', qdrantError)
      // Не прерываем процесс, сохраняем в БД
    }

    // Сохраняем информацию о файле в базу данных
    const fileRecord = {
      fileName: file.name,
      originalName: file.name,
      fileHash: fileHash,
      mimeType: file.type,
      size: file.size,
      chunks: processedFile.chunks.length,
      path: filePath,
      metadata: processedFile.metadata,
      uploadDate: new Date().toISOString(),
    }

    try {
      await FileRepository.create(fileRecord)
      console.log('[UPLOAD] Информация о файле сохранена в БД')
    } catch (dbError) {
      console.error('[UPLOAD] Ошибка сохранения в БД:', dbError)
      // Продолжаем, т.к. основные данные уже в Qdrant
    }

    // Удаляем временный файл
    console.log('[UPLOAD] Удаляем временные файлы...')
    try {
      await FileUtils.removeFile(filePath)
      await FileUtils.removeDir(uploadDir)
      console.log('[UPLOAD] Временные файлы удалены')
    } catch (cleanupError) {
      console.error('[UPLOAD] Ошибка очистки временных файлов:', cleanupError)
      // Не критично, продолжаем
    }

    console.log('[UPLOAD] Загрузка файла завершена успешно')
    return NextResponse.json({
      success: true,
      step: 'completed',
      message: 'Файл успешно обработан и загружен',
      file: {
        name: file.name,
        hash: fileHash,
        size: file.size,
        chunks: processedFile.chunks.length,
        metadata: processedFile.metadata,
      },
    })
  } catch (error) {
    console.error('[UPLOAD] Общая ошибка:', error)
    return NextResponse.json(
      {
        step: 'error',
        error: 'Внутренняя ошибка сервера',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
