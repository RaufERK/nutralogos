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
      const [chunkSizeTokens, chunkOverlapTokens, preserveStructure] =
        await Promise.all([
          SettingsService.getSetting('CHUNK_SIZE_TOKENS'),
          SettingsService.getSetting('CHUNK_OVERLAP_TOKENS'),
          SettingsService.getSetting('PRESERVE_STRUCTURE'),
        ])

      return {
        chunkSize: chunkSizeTokens
          ? parseInt(chunkSizeTokens.parameter_value)
          : 1000,
        chunkOverlap: chunkOverlapTokens
          ? parseInt(chunkOverlapTokens.parameter_value)
          : 200,
        preserveStructure: preserveStructure
          ? preserveStructure.parameter_value === 'true'
          : true,
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
      chunkSizeTokens: options.chunkSize,
      chunkOverlapTokens: options.chunkOverlap,
      preserveStructure: options.preserveStructure,
      estimatedCharsPerChunk: options.chunkSize * 3.5, // примерно 1 токен = 3.5 символа
    }
  }
}
