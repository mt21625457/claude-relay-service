const redis = require('../src/models/redis')

describe('scanPage helper', () => {
  const originalClient = redis.client

  beforeEach(() => {
    redis.client = {
      scan: async (cursor, _m, pattern, _c, count) => {
        // simple mock: two pages
        if (cursor === '0') return ['1', Array.from({ length: Math.min(count, 3) }, (_, i) => `${pattern.replace('*','x')}:${i}`)]
        return ['0', ['done:1']]
      }
    }
    redis.isConnected = true
  })

  afterEach(() => {
    redis.client = originalClient
    redis.isConnected = false
  })

  test('returns page and nextCursor', async () => {
    const { keys, nextCursor, hasMore } = await redis.scanPage('a:*', { count: 2, cursor: '0' })
    expect(keys.length).toBe(2)
    expect(nextCursor).toBe('1')
    expect(hasMore).toBe(true)
  })

  test('second page ends', async () => {
    const first = await redis.scanPage('a:*', { count: 2, cursor: '0' })
    const second = await redis.scanPage('a:*', { count: 2, cursor: first.nextCursor })
    expect(second.hasMore).toBe(false)
    expect(second.nextCursor).toBe('0')
  })
})
