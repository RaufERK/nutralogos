#!/usr/bin/env tsx
import { readFile, writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

async function removeWarningSuppressors() {
  console.log('🧹 Removing temporary warning suppressors...\n')

  // 1. Remove suppress-warnings.ts file
  const suppressFile = path.join(process.cwd(), 'src/lib/suppress-warnings.ts')
  if (existsSync(suppressFile)) {
    await unlink(suppressFile)
    console.log('✅ Deleted src/lib/suppress-warnings.ts')
  }

  // 2. Remove imports from files
  const filesToClean = ['src/app/layout.tsx', 'src/app/api/sync/route.ts']

  for (const file of filesToClean) {
    const filePath = path.join(process.cwd(), file)
    if (existsSync(filePath)) {
      let content = await readFile(filePath, 'utf-8')
      const originalContent = content

      // Remove the import line
      content = content.replace(/import '@\/lib\/suppress-warnings'.*\n/g, '')

      if (content !== originalContent) {
        await writeFile(filePath, content)
        console.log(`✅ Removed import from ${file}`)
      }
    }
  }

  // 3. Clean up document-processors-clean.ts
  const processorFile = path.join(
    process.cwd(),
    'src/lib/document-processors-clean.ts'
  )
  if (existsSync(processorFile)) {
    let content = await readFile(processorFile, 'utf-8')

    // Remove the warning suppression block from extractText method
    const pattern =
      /\/\/ Подавляем warning сообщения от PDF библиотек[\s\S]*?originalLog\(msg\)\s*}\s*\n\s*try \{/
    const replacement = 'try {'

    const newContent = content.replace(
      pattern,
      '  async extractText(_filePath: string, buffer: Buffer): Promise<string> {\n    try {'
    )

    // Also remove the finally block that restores console methods
    const finallyPattern =
      /} finally \{\s*\/\/ Восстанавливаем оригинальные console методы[\s\S]*?console\.log = originalLog\s*}/
    const finalContent = newContent.replace(finallyPattern, '}')

    if (finalContent !== content) {
      await writeFile(processorFile, finalContent)
      console.log('✅ Cleaned up src/lib/document-processors-clean.ts')
    }
  }

  // 4. Restore Turbopack in package.json (optional)
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  let packageJson = await readFile(packageJsonPath, 'utf-8')
  const originalPackageJson = packageJson

  packageJson = packageJson.replace(
    '"dev": "concurrently \\"node websocket-server.js\\" \\"next dev\\"",',
    '"dev": "concurrently \\"node websocket-server.js\\" \\"next dev --turbopack\\"",'
  )

  if (packageJson !== originalPackageJson) {
    await writeFile(packageJsonPath, packageJson)
    console.log('✅ Restored Turbopack in package.json')
  }

  console.log('\n✨ All temporary warning suppressors have been removed!')
  console.log("💡 Remember to restart the dev server if it's running.")
}

removeWarningSuppressors().catch(console.error)


