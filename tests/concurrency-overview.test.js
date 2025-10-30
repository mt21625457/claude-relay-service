const redis = require('../src/models/redis')

describe('concurrencyOverviewPage', () => {
  const originalClient = redis.client
  const originalSwitch = redis.getConcurrencySwitchState

  afterEach(() => {
    redis.client = originalClient
    redis.getConcurrencySwitchState = originalSwitch
    redis.isConnected = false
  })

  test('zset mode aggregates via zremrangebyscore+zcard', async () => {
    redis.getConcurrencySwitchState = async () => ({ mode: 'zset', freezeActive: false, serverMs: Date.now() })
    const evalCalls = []
    redis.client = {
      scan: async () => ['0', ['concurrency:k1', 'concurrency:k2', 'concurrency:k3:req:abc']],
      pipeline() {
        const res = []
        const p = {
          zremrangebyscore: () => p,
          zcard: () => {
            // push placeholder; final exec will map to 1,2 counts
            res.push(null)
            return p
          },
          async exec() {
            // Build pair results: for k1 -> zrem ok + zcard=1, k2 -> zrem ok + zcard=2
            const out = []
            // zrem k1
            out.push([null, 0])
            // zcard k1
            out.push([null, 1])
            // zrem k2
            out.push([null, 0])
            // zcard k2
            out.push([null, 2])
            return out
          }
        }
        return p
      }
    }
    redis.isConnected = true
    const page = await redis.concurrencyOverviewPage({ count: 10, cursor: '0' })
    expect(page.items.find((i) => i.id === 'k1')?.count).toBe(1)
    expect(page.items.find((i) => i.id === 'k2')?.count).toBe(2)
    // filtered out req key
    expect(page.items.find((i) => i.id.includes('req'))).toBeUndefined()
  })

  test('slots mode aggregates by grouping req keys', async () => {
    redis.getConcurrencySwitchState = async () => ({ mode: 'slots', freezeActive: false, serverMs: Date.now() })
    redis.client = {
      scan: async () => ['0', ['concurrency:k1:req:a', 'concurrency:k1:req:b', 'concurrency:k2:req:c']],
    }
    redis.isConnected = true
    const page = await redis.concurrencyOverviewPage({ count: 10, cursor: '0' })
    expect(page.items.find((i) => i.id === 'k1')?.count).toBe(2)
    expect(page.items.find((i) => i.id === 'k2')?.count).toBe(1)
  })
})
