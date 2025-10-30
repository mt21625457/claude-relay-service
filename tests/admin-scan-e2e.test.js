const express = require('express')
const request = require('supertest')

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (_req, _res, next) => next()
}))

describe('Admin SCAN 分页接口 E2E', () => {
  let app
  beforeEach(() => {
    app = express()
    const adminRoutes = require('../src/routes/admin')
    app.use('/admin', adminRoutes)
  })

  test('GET /admin/redis/scan 返回分页游标', async () => {
    const redis = require('../src/models/redis')
    redis.scanPage = async (pattern, { count, cursor }) => {
      if (cursor === '0') return { keys: ['a:1', 'a:2'], nextCursor: '1', hasMore: true }
      return { keys: ['a:3'], nextCursor: '0', hasMore: false }
    }

    const res1 = await request(app).get('/admin/redis/scan').query({ pattern: 'a:*', count: 2 })
    expect(res1.status).toBe(200)
    expect(res1.body.data.keys).toEqual(['a:1', 'a:2'])
    expect(res1.body.data.hasMore).toBe(true)
    const cursor = res1.body.data.cursor

    const res2 = await request(app)
      .get('/admin/redis/scan')
      .query({ pattern: 'a:*', count: 2, cursor })
    expect(res2.status).toBe(200)
    expect(res2.body.data.keys).toEqual(['a:3'])
    expect(res2.body.data.hasMore).toBe(false)
  })
})

