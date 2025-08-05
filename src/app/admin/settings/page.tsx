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

  useEffect(() => {
    loadSettings()
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
        .forEach((setting: SystemSetting) => {
          initialFormData[setting.parameter_name] = setting.parameter_value
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

  const handleReset = async (setting: SystemSetting) => {
    if (confirm(`Reset "${setting.display_name}" to default value?`)) {
      await handleSave(setting.parameter_name, setting.default_value)
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
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={setting.is_readonly}
          >
            {options.map((option: string) => (
              <option key={option} value={option}>
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
            <div className='text-sm text-gray-600'>
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
        return (
          <textarea
            value={value}
            onChange={(e) =>
              handleInputChange(setting.parameter_name, e.target.value)
            }
            rows={4}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
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
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={setting.is_readonly}
          />
        )
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai':
        return '🤖'
      case 'search':
        return '🔍'
      case 'content':
        return '📝'
      case 'security':
        return '🔒'
      default:
        return '⚙️'
    }
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'ai':
        return 'AI Model Settings'
      case 'search':
        return 'Search & Retrieval'
      case 'content':
        return 'Content Settings'
      case 'security':
        return 'Security & Limits'
      default:
        return category.charAt(0).toUpperCase() + category.slice(1)
    }
  }

  const getCategoryBgColor = (category: string, index: number) => {
    const colors = [
      'bg-gray-800', // Темно-серый
      'bg-slate-800', // Немного синеватый серый
      'bg-zinc-800', // Немного теплее серый
      'bg-neutral-800', // Нейтральный серый
    ]
    return colors[index % colors.length]
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
      {Object.entries(settings).map(([category, categorySettings], index) => (
        <div
          key={category}
          className={`${getCategoryBgColor(
            category,
            index
          )} rounded-lg shadow p-6`}
        >
          <div className='flex items-center mb-6'>
            <span className='text-2xl mr-3'>{getCategoryIcon(category)}</span>
            <h2 className='text-xl font-semibold text-white'>
              {getCategoryTitle(category)}
            </h2>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {categorySettings.map((setting) => (
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

                        {setting.requires_restart && (
                          <span className='px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full'>
                            Requires Restart
                          </span>
                        )}
                        {setting.is_sensitive && (
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

                      {setting.is_readonly && (
                        <span className='text-xs text-gray-400'>Read-only</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
