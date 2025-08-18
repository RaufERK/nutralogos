'use client'

import { useState, useEffect } from 'react'
import { SystemSetting, SettingsByCategory } from '@/lib/settings-service'
import HelpTooltip from './components/HelpTooltip'

interface SettingsFormData {
  [key: string]: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsByCategory>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [formData, setFormData] = useState<SettingsFormData>({})
  const [resetting, setResetting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [promptFiles, setPromptFiles] = useState<
    Array<{ name: string; filename: string; content: string }>
  >([])

  useEffect(() => {
    loadSettings()
    loadPromptFiles()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) {
        throw new Error('Failed to load settings')
      }

      const data = await response.json()
      setSettings(data.settings)

      // Initialize form data
      const initialFormData: SettingsFormData = {}
      Object.values(data.settings)
        .flat()
        .forEach((setting) => {
          const typedSetting = setting as SystemSetting
          initialFormData[typedSetting.parameter_name] =
            typedSetting.parameter_value
        })
      setFormData(initialFormData)
    } catch (error) {
      console.error('Error loading settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (parameterName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [parameterName]: value,
    }))
  }

  const handleSave = async (parameterName: string, value: string) => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parameterName,
          value,
          reason: 'Updated via admin interface',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update setting')
      }

      setMessage({ type: 'success', text: 'Setting updated successfully' })

      // Reload settings to get updated values
      await loadSettings()
    } catch (error) {
      console.error('Error updating setting:', error)
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to update setting',
      })
    } finally {
      setSaving(false)
    }
  }

  const loadPromptFiles = async () => {
    try {
      const res = await fetch('/api/settings/prompts/list')
      const data = await res.json()
      if (res.ok && data?.success) {
        setPromptFiles(data.prompts || [])
      }
    } catch {}
  }

  const handleReset = async (setting: SystemSetting) => {
    await handleSave(setting.parameter_name, setting.default_value)
  }

  const handleResetAll = async () => {
    setResetting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings/reset', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || 'Failed to reset settings')
      }
      setMessage({
        type: 'success',
        text: 'Все настройки сброшены к значениям по умолчанию',
      })
      await loadSettings()
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to reset settings',
      })
    } finally {
      setResetting(false)
    }
  }

  const renderSettingInput = (setting: SystemSetting) => {
    const value = formData[setting.parameter_name] || setting.parameter_value

    switch (setting.ui_component) {
      case 'select':
        const options = setting.ui_options ? JSON.parse(setting.ui_options) : []
        return (
          <select
            value={value}
            onChange={(e) =>
              handleInputChange(setting.parameter_name, e.target.value)
            }
            className='w-full px-3 py-2 bg-gray-600 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            disabled={setting.is_readonly}
          >
            {options.map((option: string) => (
              <option
                key={option}
                value={option}
                className='bg-gray-600 text-white'
              >
                {option}
              </option>
            ))}
          </select>
        )

      case 'slider':
        const sliderOptions = setting.ui_options
          ? JSON.parse(setting.ui_options)
          : {}
        return (
          <div className='space-y-2'>
            <input
              type='range'
              min={sliderOptions.min || 0}
              max={sliderOptions.max || 100}
              step={sliderOptions.step || 1}
              value={value}
              onChange={(e) =>
                handleInputChange(setting.parameter_name, e.target.value)
              }
              className='w-full'
              disabled={setting.is_readonly}
            />
            <div className='text-sm text-white'>
              {value} {sliderOptions.unit || ''}
            </div>
          </div>
        )

      case 'toggle':
        return (
          <label className='flex items-center cursor-pointer'>
            <input
              type='checkbox'
              checked={value === 'true'}
              onChange={(e) =>
                handleInputChange(
                  setting.parameter_name,
                  e.target.checked.toString()
                )
              }
              className='sr-only'
              disabled={setting.is_readonly}
            />
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${
                value === 'true' ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute w-5 h-5 bg-white rounded-full transition-transform ${
                  value === 'true' ? 'translate-x-6' : 'translate-x-1'
                } top-0.5`}
              />
            </div>
          </label>
        )

      case 'textarea':
        if (setting.parameter_name === 'system_prompt') {
          return (
            <div className='space-y-2'>
              <div className='flex items-center space-x-2'>
                <select
                  className='px-2 py-1 bg-gray-600 text-white border border-gray-500 rounded'
                  onChange={(e) => {
                    const sel = promptFiles.find(
                      (p) => p.filename === e.target.value
                    )
                    if (sel) {
                      handleInputChange(setting.parameter_name, sel.content)
                    }
                  }}
                >
                  <option value=''>Выбрать промпт из файла…</option>
                  {promptFiles.map((p) => (
                    <option key={p.filename} value={p.filename}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={value}
                onChange={(e) =>
                  handleInputChange(setting.parameter_name, e.target.value)
                }
                rows={8}
                className='w-full px-3 py-2 bg-gray-600 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                disabled={setting.is_readonly}
              />
            </div>
          )
        }
        return (
          <textarea
            value={value}
            onChange={(e) =>
              handleInputChange(setting.parameter_name, e.target.value)
            }
            rows={4}
            className='w-full px-3 py-2 bg-gray-600 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            disabled={setting.is_readonly}
          />
        )

      default:
        const inputOptions = setting.ui_options
          ? JSON.parse(setting.ui_options)
          : {}
        return (
          <input
            type={inputOptions.type || 'text'}
            value={value}
            onChange={(e) =>
              handleInputChange(setting.parameter_name, e.target.value)
            }
            min={inputOptions.min}
            max={inputOptions.max}
            step={inputOptions.step}
            className='w-full px-3 py-2 bg-gray-600 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
            disabled={setting.is_readonly}
          />
        )
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'AI_Model_and_Response_Generation':
        return '🧠'
      case 'RAG_Embedding_and_Chunking':
        return '📖'
      case 'Retrieval_Settings':
        return '🔍'
      case 'System_and_Limits':
        return '⚙️'
      case 'Chat_Context_Settings':
        return '💬'
      case 'Enhanced_Metadata':
        return '🏷️'
      case 'Deduplication':
        return '♻️'
      case 'Vector_Search':
        return '🧭'
      default:
        return '💻'
    }
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'AI_Model_and_Response_Generation':
        return 'AI Модель и генерация ответов'
      case 'RAG_Embedding_and_Chunking':
        return 'RAG: Подготовка и индексация'
      case 'Retrieval_Settings':
        return 'Поиск и подбор контекста'
      case 'System_and_Limits':
        return 'Система и лимиты'
      case 'Chat_Context_Settings':
        return 'Настройки контекста чата'
      case 'Enhanced_Metadata':
        return 'Улучшенные метаданные'
      case 'Deduplication':
        return 'Дедупликация'
      case 'Vector_Search':
        return 'Векторный поиск'
      default:
        return category.charAt(0).toUpperCase() + category.slice(1)
    }
  }

  const categoryHelp: Record<string, string> = {
    AI_Model_and_Response_Generation:
      'Настройки основной модели чата и параметров генерации ответов.',
    RAG_Embedding_and_Chunking:
      'Параметры разбиения текста и модели эмбеддингов для индексации.',
    Retrieval_Settings:
      'Параметры извлечения контекста из векторной БД и пороги релевантности.',
    System_and_Limits: 'Системные лимиты и производственные параметры.',
    Chat_Context_Settings:
      'Поведение контекста в чате и приветственные сообщения.',
    Enhanced_Metadata:
      'Автоматическое обогащение документов метаданными перед чанкингом.',
    Deduplication:
      'Стратегии предотвращения дубликатов по содержимому (контент-хеш).',
    Vector_Search:
      'Multi-vector: два вектора на чанк (content + meta) и взвешенное объединение при поиске.',
  }

  const getCategoryBgColor = (category: string) => {
    // Закрепляем цвета за конкретными категориями для логичности
    const colorMap: Record<string, string> = {
      AI_Model_and_Response_Generation: 'bg-purple-900/90', // Фиолетовый для AI
      RAG_Embedding_and_Chunking: 'bg-blue-900/90', // Синий для подготовки данных
      Retrieval_Settings: 'bg-teal-800/90', // Бирюзовый для поиска
      System_and_Limits: 'bg-emerald-800/90', // Изумрудный для системы
      Chat_Context_Settings: 'bg-indigo-900/90', // Индиго для чата
      Enhanced_Metadata: 'bg-amber-900/90', // Янтарный для метаданных
      Deduplication: 'bg-lime-900/90', // Лаймовый для дедупликации
      Vector_Search: 'bg-cyan-900/90', // Циан для поиска
    }

    return colorMap[category] || 'bg-gray-900/90'
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-xl'>Loading settings...</div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold text-white'>System Settings</h1>
        <p className='text-gray-400'>Configure RAG system parameters</p>
        <div className='mt-4'>
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className='px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-red-700/60 border border-red-500'
          >
            {resetting ? 'Сброс настроек…' : 'Сбросить все настройки'}
          </button>
          <button
            onClick={async () => {
              setSyncing(true)
              setMessage(null)
              try {
                const res = await fetch('/api/admin/settings/sync', {
                  method: 'POST',
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok || data?.success === false) {
                  throw new Error(data?.error || 'Failed to sync settings')
                }
                setMessage({
                  type: 'success',
                  text: 'Настройки синхронизированы с defaults',
                })
                await loadSettings()
              } catch (e) {
                setMessage({
                  type: 'error',
                  text:
                    e instanceof Error ? e.message : 'Failed to sync settings',
                })
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            className='ml-3 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-700/60 border border-blue-500'
          >
            {syncing ? 'Синхронизация…' : 'Синхронизировать с defaults'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Settings by Category */}
      {Object.entries(settings).map(([category, categorySettings]) => (
        <div
          key={category}
          className={`${getCategoryBgColor(category)} rounded-lg shadow p-6`}
        >
          <div className='flex items-start justify-between mb-6'>
            <div className='flex items-center'>
              <span className='text-2xl mr-3'>{getCategoryIcon(category)}</span>
              <h2 className='text-xl font-semibold text-white'>
                {getCategoryTitle(category)}
              </h2>
            </div>
            {categoryHelp[category] && (
              <div className='relative group'>
                <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white cursor-default'>
                  ?
                </span>
                <div className='absolute right-0 mt-2 w-72 p-3 rounded bg-black/90 text-white text-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
                  {categoryHelp[category]}
                </div>
              </div>
            )}
          </div>

          <div className='space-y-6'>
            {/* Полноширинные настройки (textarea) */}
            {categorySettings
              .filter((setting) => setting.ui_component === 'textarea')
              .map((setting) => (
                <div
                  key={setting.parameter_name}
                  className='bg-gray-700/50 rounded-lg p-4 border border-gray-600'
                >
                  <div className='space-y-3'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center space-x-2'>
                          <h3 className='text-base font-medium text-white'>
                            {setting.display_name}
                          </h3>

                          {(setting.description || setting.help_text) && (
                            <HelpTooltip
                              content={
                                setting.description ||
                                setting.help_text ||
                                'Настройка системы'
                              }
                            />
                          )}

                          {setting.requires_restart === true && (
                            <span className='px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full'>
                              Requires Restart
                            </span>
                          )}

                          {setting.is_sensitive === true && (
                            <span className='px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full'>
                              Sensitive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className='space-y-3'>
                      <div>{renderSettingInput(setting)}</div>

                      <div className='flex items-center space-x-2'>
                        <button
                          onClick={() =>
                            handleSave(
                              setting.parameter_name,
                              formData[setting.parameter_name] ||
                                setting.parameter_value
                            )
                          }
                          disabled={saving || setting.is_readonly}
                          className='px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>

                        <button
                          onClick={() => handleReset(setting)}
                          disabled={saving || setting.is_readonly}
                          className='px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          Reset to Default
                        </button>

                        {setting.is_readonly === true && (
                          <span className='text-xs text-gray-400'>
                            Read-only
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {/* Настройки обычного размера (в сетке) */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {categorySettings
                .filter((setting) => setting.ui_component !== 'textarea')
                .map((setting) => (
                  <div
                    key={setting.parameter_name}
                    className='bg-gray-700/50 rounded-lg p-4 border border-gray-600'
                  >
                    <div className='space-y-3'>
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center space-x-2'>
                            <h3 className='text-base font-medium text-white'>
                              {setting.display_name}
                            </h3>
                            {(setting.description || setting.help_text) && (
                              <HelpTooltip
                                content={
                                  setting.description ||
                                  setting.help_text ||
                                  'Настройка системы'
                                }
                              />
                            )}
                            {setting.requires_restart === true && (
                              <span className='px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full'>
                                Requires Restart
                              </span>
                            )}

                            {setting.is_sensitive === true && (
                              <span className='px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full'>
                                Sensitive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className='space-y-3'>
                        <div>{renderSettingInput(setting)}</div>

                        <div className='flex items-center space-x-2'>
                          <button
                            onClick={() =>
                              handleSave(
                                setting.parameter_name,
                                formData[setting.parameter_name] ||
                                  setting.parameter_value
                              )
                            }
                            disabled={saving || setting.is_readonly}
                            className='px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>

                          <button
                            onClick={() => handleReset(setting)}
                            disabled={saving || setting.is_readonly}
                            className='px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            Reset to Default
                          </button>

                          {setting.is_readonly === true && (
                            <span className='text-xs text-gray-400'>
                              Read-only
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
