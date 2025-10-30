const redis = require('../src/models/redis')

describe('scanKeys helper', () => {
  const originalClient = redis.client
  beforeEach(() => {
    // mock client with controllable scan
    const batches = [
      ['1', ['a:1', 'a:2']],
      ['2', ['a:3']],
      ['0', ['a:4']]
    ]
    let idx = 0
    redis.client = {
      scan: async () => batches[idx++] || ['0', []]
    }
    redis.isConnected = true
  })
  afterEach(() => {
    redis.client = originalClient
    redis.isConnected = false
  })

  test('aggregates results across cursors', async () => {
    const keys = await redis.scanKeys('a:*', { count: 2, maxRounds: 10 })
    expect(keys.sort()).toEqual(['a:1', 'a:2', 'a:3', 'a:4'])
  })

  test('respects maxRounds cap', async () => {
    const keys = await redis.scanKeys('a:*', { count: 2, maxRounds: 1 })
    // only first batch returned
    expect(keys.sort()).toEqual(['a:1', 'a:2'])
  })
})
