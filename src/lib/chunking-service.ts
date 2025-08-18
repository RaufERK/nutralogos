import { SettingsService } from './settings-service'
import {
  OptimizedTextSplitter,
  ChunkingOptions,
} from './text-splitter-optimized'

/**
 * Сервис для управления чанкингом с настройками из базы данных
 */
export class ChunkingService {
  /**
   * Получает настройки чанкинга из базы данных
   */
  static async getChunkingOptions(): Promise<ChunkingOptions> {
    try {
      const [chunkSize, chunkOverlap, preserveStructure] = await Promise.all([
        SettingsService.getSettingValue<number>('chunk_size', 1000),
        SettingsService.getSettingValue<number>('chunk_overlap', 200),
        SettingsService.getSettingValue<boolean>(
          'preserve_text_structure',
          true
        ),
      ])

      return {
        chunkSize,
        chunkOverlap,
        preserveStructure,
      }
    } catch (error) {
      console.warn(
        '⚠️ Failed to load chunking settings, using defaults:',
        error
      )

      // Fallback to default values
      return {
        chunkSize: 1000,
        chunkOverlap: 200,
        preserveStructure: true,
      }
    }
  }

  /**
   * Разбивает текст на чанки с настройками из базы данных
   */
  static async splitText(text: string) {
    const options = await this.getChunkingOptions()

    console.log(
      `📝 [CHUNKING] Using settings: ${options.chunkSize} tokens, ${options.chunkOverlap} overlap, structure: ${options.preserveStructure}`
    )

    return await OptimizedTextSplitter.splitTextOptimized(text, options)
  }

  /**
   * Получает информацию о настройках чанкинга
   */
  static async getChunkingInfo() {
    const options = await this.getChunkingOptions()

    return {
      chunkSizeTokens: options.chunkSize ?? 1000,
      chunkOverlapTokens: options.chunkOverlap ?? 200,
      preserveStructure: options.preserveStructure ?? true,
      estimatedCharsPerChunk: (options.chunkSize ?? 1000) * 3.5, // примерно 1 токен = 3.5 символа
    }
  }
}
