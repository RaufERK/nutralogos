import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3000'

async function testAPIEndpoints() {
  console.log('🧪 Testing API endpoints...')

  try {
    // Test 1: Auth session endpoint
    console.log('\n🔐 Test 1: Auth session endpoint...')
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`)
    console.log('Session response status:', sessionResponse.status)
    console.log('Session response ok:', sessionResponse.ok)

    // Test 2: Main page
    console.log('\n🏠 Test 2: Main page...')
    const mainResponse = await fetch(`${BASE_URL}/`)
    console.log('Main page status:', mainResponse.status)
    console.log('Main page ok:', mainResponse.ok)

    // Test 3: Admin page (should redirect to login)
    console.log('\n👤 Test 3: Admin page...')
    const adminResponse = await fetch(`${BASE_URL}/admin`)
    console.log('Admin page status:', adminResponse.status)
    console.log('Admin page ok:', adminResponse.ok)

    // Test 4: Check if server is running
    console.log('\n🖥️ Test 4: Server health...')
    try {
      const healthResponse = await fetch(`${BASE_URL}/api/auth/session`)
      if (healthResponse.ok) {
        console.log('✅ Server is healthy and responding')
      } else {
        console.log(
          '⚠️ Server responding but with status:',
          healthResponse.status
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Server health check failed:', errorMessage)
    }
  } catch (error) {
    console.error('❌ API test failed:', error)
  }
}

// Run the test
testAPIEndpoints()
  .then(() => {
    console.log('\n🏁 API testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 API test crashed:', error)
    process.exit(1)
  })
