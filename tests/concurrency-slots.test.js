const redis = require('../src/models/redis')

describe('concurrency slots mode (no Lua)', () => {
  const originalClient = redis.client
  const originalSwitch = redis.getConcurrencySwitchState
  let store

  beforeEach(() => {
    store = new Set()
    // mock centralized switch as slots mode without freeze
    redis.getConcurrencySwitchState = async () => ({ mode: 'slots', freezeActive: false, serverMs: Date.now() })

    // mock minimal redis client ops used by slots impl
    redis.client = {
      set: async (key, value, px, ttl, nx) => {
        if (nx === 'NX') {
          if (store.has(key)) return null
          store.add(key)
          return 'OK'
        }
        store.add(key)
        return 'OK'
      },
      del: async (key) => {
        store.delete(key)
        return 1
      },
      pttl: async (key) => (store.has(key) ? 1000 : -2),
      pexpire: async (key, ttl) => (store.has(key) ? 1 : 0),
      scan: async (cursor, _m1, pattern) => {
        // naive single-batch match
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        const matched = Array.from(store).filter((k) => regex.test(k))
        return ['0', matched]
      }
    }
    redis.isConnected = true
  })

  afterEach(() => {
    redis.client = originalClient
    redis.isConnected = false
    redis.getConcurrencySwitchState = originalSwitch
  })

  test('acquire → get → refresh → release', async () => {
    const keyId = 'k1'
    const reqId = 'r1'
    const c1 = await redis.incrConcurrency(keyId, reqId, 30)
    expect(c1).toBe(1)

    const nowCount = await redis.getConcurrency(keyId)
    expect(nowCount).toBe(1)

    const refreshed = await redis.refreshConcurrencyLease(keyId, reqId, 30)
    expect(refreshed).toBe(1)

    const c0 = await redis.decrConcurrency(keyId, reqId)
    expect(c0).toBe(0)
  })
})
