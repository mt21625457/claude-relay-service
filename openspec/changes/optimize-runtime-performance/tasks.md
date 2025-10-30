## 1. Implementation
- [x] 1.1 引入 `scanKeys`/`scanStream` 助手，并在 Redis 客户端模块中可复用（src/models/redis.js）
- [x] 1.2 用 `SCAN + pipeline` 替换并发清理中的 `KEYS`（src/app.js）
- [x] 1.3 管理端列表/搜索改为基于 `SCAN` 的分页或流式迭代（src/routes/admin.js）
- [x] 1.4 清理逻辑尽量采用 TTL/ZSET 过期；必要时分批清理（slots 模式跳过清理；zset 模式 SCAN+pipeline）（src/app.js）
- [x] 1.5 并发控制双栈（无 Lua）：保留 zset 模式；新增 slots 模式（SET NX PX 槽位键）并封装 acquire/release/extend/status（src/models/redis.js 或专用 service）
- [x] 1.6 集中配置与不混跑切换：读取 `concurrency:mode`/`switch_at_ms`/`freeze_until_ms`（Redis 配置键），在运行时按 Redis TIME 统一切换（src/app.js 或并发服务初始化）
- [x] 1.7 管理端/指标适配：根据模式切换统计口径（zset→ZCARD；slots→req 键计数），新增跨池聚合分页接口（/admin/concurrency/overview），并在 /metrics 暴露 mode/freeze 状态

## 2. Validation
 - [x] 2.1 单元测试：`scanKeys` 在空集与大集下均能完整遍历
 - [x] 2.2 集成测试：并发清理任务不再阻塞（模拟大量 `concurrency:*` 键），管道执行成功
 - [x] 2.3 端到端：管理端列表在大量键下返回稳定，确认分页/游标可用
 - [x] 2.4 并发模式双栈：在 zset 与 slots 下分别验证 acquire/extend/release 正确性与不超发（含概览分页聚合）
 - [x] 2.5 不混跑切换演练：设置 freeze→等待→按 `switch_at_ms` 同步切换；观察统计与额度一致性；回滚验证

## 3. Tooling & Benchmarks
 - [x] 3.1 文档说明如何启用 Redis 慢查询日志，验证 `KEYS` 消失、SCAN 无阻塞
 - [x] 3.2 记录替换前后 Redis CPU 与 p95 差异（可选压测脚本）
 - [x] 3.3 运维手册：集中配置键的设置流程、时序建议（freeze 窗口 ≥ 租约）、回滚步骤、观测指标与常见故障
