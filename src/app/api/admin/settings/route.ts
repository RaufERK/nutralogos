import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/lib/settings-service'

export async function GET() {
  try {
    console.log('📋 [ADMIN SETTINGS] Loading all settings')

    const settings = await SettingsService.getAllSettings()

    console.log(
      `✅ [ADMIN SETTINGS] Loaded ${Object.keys(settings).length} categories`
    )

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error) {
    console.error('❌ [ADMIN SETTINGS] Error loading settings:', error)
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Basic input validation
    console.log('📝 [ADMIN SETTINGS] Updating setting')

    const { parameterName, value, reason } = await request.json()

    if (!parameterName || value === undefined) {
      return NextResponse.json(
        { error: 'Parameter name and value are required' },
        { status: 400 }
      )
    }

    if (typeof parameterName !== 'string' || parameterName.length > 128) {
      return NextResponse.json(
        { error: 'Invalid parameter name' },
        { status: 400 }
      )
    }

    // Validate the setting exists
    const setting = await SettingsService.getSetting(parameterName)
    if (!setting) {
      return NextResponse.json({ error: 'Setting not found' }, { status: 404 })
    }

    // Check if setting is readonly
    if (setting.is_readonly) {
      return NextResponse.json(
        { error: 'Setting is read-only' },
        { status: 403 }
      )
    }

    // Validate value based on parameter type
    let validatedValue = value

    switch (setting.parameter_type) {
      case 'number':
        const numValue = parseFloat(value)
        if (isNaN(numValue)) {
          return NextResponse.json(
            { error: 'Invalid number value' },
            { status: 400 }
          )
        }
        validatedValue = numValue.toString()
        break

      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          return NextResponse.json(
            { error: 'Invalid boolean value' },
            { status: 400 }
          )
        }
        break

      case 'json':
        try {
          JSON.parse(value)
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON value' },
            { status: 400 }
          )
        }
        break
      default:
        if (typeof value !== 'string') {
          validatedValue = String(value)
        }
    }

    // Update the setting
    await SettingsService.updateSetting(
      parameterName,
      validatedValue,
      'admin-api', // changed_by
      reason || 'Updated via admin API'
    )

    console.log(
      `✅ [ADMIN SETTINGS] Updated ${parameterName} = ${validatedValue}`
    )

    return NextResponse.json({
      success: true,
      message: 'Setting updated successfully',
      parameter: parameterName,
      value: validatedValue,
    })
  } catch (error) {
    console.error('❌ [ADMIN SETTINGS] Error updating setting:', error)
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    )
  }
}
