const Application = require('../src/app')
const redis = require('../src/models/redis')

describe('并发清理任务（SCAN + pipeline 集成）', () => {
  const originalScanKeys = redis.scanKeys
  const originalGetClientSafe = redis.getClientSafe

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    redis.scanKeys = originalScanKeys
    redis.getClientSafe = originalGetClientSafe
  })

  test('大量 concurrency:* 键时使用两阶段 pipeline（清理+删除空键）', async () => {
    // 构造 1000 个并发键
    const keys = Array.from({ length: 1000 }, (_, i) => `concurrency:k${i}`)
    redis.scanKeys = async () => keys

    let zremCalls = 0
    let zcardCalls = 0
    let delCalls = 0
    redis.getClientSafe = () => ({
      pipeline: () => {
        const p = {
          zremrangebyscore: () => {
            zremCalls++
            return p
          },
          zcard: () => {
            zcardCalls++
            return p
          },
          del: () => {
            delCalls++
            return p
          },
          exec: async () => {
            // 第一次 exec（无 del 调用前）：返回 ZREM 和 ZCARD 结果
            if (delCalls === 0) {
              const res = []
              for (let i = 0; i < keys.length; i++) {
                res.push([null, 0])
                res.push([null, 0])
              }
              return res
            }
            // 第二次 exec：返回 del 的结果
            return keys.map(() => [null, 1])
          }
        }
        return p
      }
    })

    const app = new Application()
    // 只启动清理任务（不初始化 Redis 等）
    app.startCleanupTasks()

    // 推进计时器到触发每分钟清理任务
    jest.advanceTimersByTime(60000)

    // 断言：发生了批量删除空键（证明两阶段 pipeline 生效）
    expect(delCalls).toBeGreaterThan(0)
  })
})
jest.mock('../src/services/rateLimitCleanupService', () => ({
  start: jest.fn(),
  stop: jest.fn()
}))
