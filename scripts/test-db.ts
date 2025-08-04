import { getDatabase } from '../src/lib/database'

async function testDatabase() {
  console.log('🧪 Testing database connection and tables...')

  try {
    // Test 1: Database connection
    console.log('\n🔗 Test 1: Database connection...')
    const db = await getDatabase()
    console.log('✅ Database connected successfully')

    // Test 2: Check tables exist
    console.log('\n📋 Test 2: Checking tables...')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
    console.log(
      '📊 Found tables:',
      tables.map((t: any) => t.name)
    )

    // Test 3: Check files table structure
    console.log('\n📁 Test 3: Files table structure...')
    const filesTableInfo = db.prepare('PRAGMA table_info(files)').all()
    console.log(
      '📋 Files table columns:',
      filesTableInfo.map((col: any) => col.name)
    )

    // Test 4: Check system_settings table
    console.log('\n⚙️ Test 4: System settings table...')
    const settingsCount = db
      .prepare('SELECT COUNT(*) as count FROM system_settings')
      .get() as { count: number } | undefined
    console.log('📊 System settings count:', settingsCount?.count)

    // Test 5: Insert test record
    console.log('\n➕ Test 5: Inserting test record...')
    const testId = 'test-' + Date.now()
    db.prepare(
      `
      INSERT OR IGNORE INTO files (
        id, filename, original_name, file_hash, file_size, mime_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      testId,
      'test.txt',
      'test.txt',
      'test-hash',
      1024,
      'text/plain',
      'completed'
    )
    console.log('✅ Test record inserted')

    // Test 6: Query test record
    console.log('\n🔍 Test 6: Querying test record...')
    const testRecord = db
      .prepare('SELECT * FROM files WHERE id = ?')
      .get(testId) as any
    if (testRecord) {
      console.log('✅ Test record found:', {
        id: testRecord.id,
        filename: testRecord.filename,
        status: testRecord.status,
      })
    } else {
      console.log('❌ Test record not found')
    }

    // Clean up test record
    db.prepare('DELETE FROM files WHERE id = ?').run(testId)
    console.log('🧹 Test record cleaned up')
  } catch (error) {
    console.error('❌ Database test failed:', error)
  }
}

// Run the test
testDatabase()
  .then(() => {
    console.log('\n🏁 Database testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Database test crashed:', error)
    process.exit(1)
  })
