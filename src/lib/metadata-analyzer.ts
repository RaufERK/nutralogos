import { ChatOpenAI } from '@langchain/openai'
import { SettingsService } from '@/lib/settings-service'

type NutritionMetadata = {
  summary?: string
  topics?: string[]
  target_conditions?: string[]
  recommended_foods?: string[]
  restricted_foods?: string[]
  author_type?: string
  emotional_tone?: string
  suggested_tags?: string[]
}

type SpiritualMetadata = {
  summary?: string
  topics?: string[]
  source_type?: string
  named_entities?: string[]
  emotional_tone?: string
  suggested_tags?: string[]
}

export type FileLLMMetadata = NutritionMetadata &
  SpiritualMetadata & {
    domain: 'nutrition' | 'spiritual'
  }

const nutritionPrompt = (
  text: string
) => `Ты — эксперт в области нутрициологии, функциональной медицины и диетологии. На входе — учебный или лекционный файл. Твоя задача — кратко и структурировано проанализировать его содержание и вернуть результат в виде JSON. Строго верни ТОЛЬКО валидный JSON.

Формат:
{
  "summary": "Краткое содержание и цель документа.",
  "topics": ["основные темы и ключевые концепции"],
  "target_conditions": ["на какие состояния/заболевания направлен документ"],
  "recommended_foods": ["список упоминаемых полезных продуктов"],
  "restricted_foods": ["список запрещённых/нежелательных продуктов"],
  "author_type": "нутрициолог / врач / специалист по гормонам и т.п.",
  "emotional_tone": "обучающий / поддерживающий / тревожный / мотивирующий и т.д.",
  "suggested_tags": ["нутрициология", "ЖКТ", "гормоны"]
}

Текст:
${text}
`

const spiritualPrompt = (
  text: string
) => `Ты — система анализа духовных и философских текстов. На входе у тебя файл в текстовом виде. Проанализируй его полностью и выведи ТОЛЬКО валидный JSON:
{
  "summary": "Краткое содержание всего текста.",
  "topics": ["главные темы"],
  "source_type": "духовная диктовка / философское послание / учение / лекция",
  "named_entities": ["имена, организации, места"],
  "emotional_tone": "воодушевляющий / тревожный / пророческий",
  "suggested_tags": ["духовность", "эзотерика"]
}

Текст:
${text}
`

function safeParseJSON(text: string): any {
  try {
    // Try direct parse
    return JSON.parse(text)
  } catch {
    // Try to extract JSON block
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {}
    }
    return {}
  }
}

export async function analyzeTextWithLLM(
  fullText: string,
  domain: 'nutrition' | 'spiritual'
): Promise<FileLLMMetadata> {
  const modelName = await SettingsService.getSettingValue(
    'metadata_model',
    'gpt-4o-mini'
  )
  const customPrompt = await SettingsService.getSettingValue<string>(
    'metadata_prompt',
    ''
  )

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY!,
    modelName,
    temperature: 0.2,
    maxTokens: 1200,
  })

  const basePrompt =
    domain === 'nutrition'
      ? nutritionPrompt(fullText)
      : spiritualPrompt(fullText)
  const userPrompt =
    customPrompt && customPrompt.trim().length > 0
      ? `${customPrompt}\n\nТекст для анализа:\n${fullText}`
      : basePrompt

  const response = await llm.invoke([
    {
      role: 'system',
      content:
        'Ты отвечаешь строго валидным JSON без комментариев и пояснений.',
    },
    { role: 'user', content: userPrompt },
  ])

  const content =
    typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
      ? response.content.map((c: any) => c.text || '').join('\n')
      : ''

  const parsed = safeParseJSON(content)
  return { ...(parsed || {}), domain }
}
