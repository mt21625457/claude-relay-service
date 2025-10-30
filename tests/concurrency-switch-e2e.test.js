const redis = require('../src/models/redis')

describe('不混跑切换演练（freeze → switch → rollback）', () => {
  const originalClient = redis.client
  const originalSwitch = redis.getConcurrencySwitchState

  afterEach(() => {
    redis.client = originalClient
    redis.getConcurrencySwitchState = originalSwitch
    redis.isConnected = false
  })

  test('freeze 阶段拒发新令牌', async () => {
    redis.getConcurrencySwitchState = async () => ({ mode: 'zset', freezeActive: true, serverMs: Date.now() })
    redis.client = { eval: async () => 0 }
    redis.isConnected = true
    const count = await redis.incrConcurrency('k', 'r1', 30)
    expect(count).toBe(Number.MAX_SAFE_INTEGER)
  })

  test('切换到 slots 后发放/统计按 req 键生效；回滚到 zset 仍可工作', async () => {
    // 切到 slots
    const store = new Set()
    redis.getConcurrencySwitchState = async () => ({ mode: 'slots', freezeActive: false, serverMs: Date.now() })
    redis.client = {
      set: async (key, v, px, ttl, nx) => {
        if (nx === 'NX' && store.has(key)) return null
        store.add(key)
        return 'OK'
      },
      del: async (key) => {
        store.delete(key)
        return 1
      },
      pttl: async (key) => (store.has(key) ? 1000 : -2),
      pexpire: async (key, ttl) => (store.has(key) ? 1 : 0),
      scan: async () => ['0', Array.from(store)]
    }
    redis.isConnected = true
    expect(await redis.incrConcurrency('k', 'r1', 30)).toBe(1)
    expect(await redis.incrConcurrency('k', 'r2', 30)).toBe(2)
    expect(await redis.getConcurrency('k')).toBe(2)
    await redis.decrConcurrency('k', 'r1')
    expect(await redis.getConcurrency('k')).toBe(1)

    // 回滚到 zset
    let zsetCount = 0
    redis.getConcurrencySwitchState = async () => ({ mode: 'zset', freezeActive: false, serverMs: Date.now() })
    redis.client = {
      eval: async (lua, n, key, requestId, expireAt, now, ttl) => {
        if (lua.includes('ZADD')) {
          zsetCount += 1
          return zsetCount
        }
        if (lua.includes('ZREM') && !lua.includes('ZADD')) {
          zsetCount = Math.max(0, zsetCount - 1)
          return zsetCount
        }
        if (lua.includes('ZCARD')) {
          return zsetCount
        }
        return 0
      }
    }
    expect(await redis.incrConcurrency('k', 'r3', 30)).toBe(1)
    expect(await redis.getConcurrency('k')).toBe(1)
    await redis.decrConcurrency('k', 'r3')
    expect(await redis.getConcurrency('k')).toBe(0)
  })
})
