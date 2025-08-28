const { config } = require('dotenv')

// Load test environment variables
config({ path: '.env.test' })

// Set test environment
process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key'
process.env.JWT_ACCESS_EXPIRE = '15m'
process.env.JWT_REFRESH_EXPIRE = '7d'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Clean up after all tests
afterAll(async () => {
  // Close database connections if needed
  // This would be implemented if we had a test database setup
})
