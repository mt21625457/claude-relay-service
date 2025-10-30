## Why
Redis `KEYS` 全量扫描为 O(N) 阻塞操作，会在键数增多时卡住 Redis 单线程，导致高并发下的 p95/p99 延迟升高与吞吐下降。当前在并发清理与部分管理列表场景存在 `KEYS` 使用，需要替换为非阻塞的 `SCAN` 迭代并配合 pipeline 批处理。

## What Changes
- 用 `SCAN`/`scanStream` 替换所有 `KEYS` 全量扫描
- 在需要批处理的场景（并发清理、批量统计）使用 `pipeline` 降低往返
- 对并发清理类逻辑优先采用 TTL/ZSET 过期语义；确需清理时以 `SCAN MATCH pattern COUNT N` 分批处理

### 方案 1（不混跑切换，零停机）
- 引入“双栈”并发实现（保持现有 ZSET 模式，同时新增“槽位键 slots 模式”，不依赖 Lua）
- 集中配置开关存于 Redis：`concurrency:mode=zset|slots`、`concurrency:switch_at_ms`、`concurrency:freeze_until_ms`
- 发布策略：
  1) 全量实例先上线“双栈”版本但保持 `zset` 运行；此阶段不改行为
  2) 通过集中配置下发 freeze（新令牌拒发）并等待一个完整租约；
  3) 到达统一的 `switch_at_ms`（以 Redis TIME 为时钟）原子切换至 `slots`；解除 freeze；
  4) 观察稳定后，保留旧键自然过期；如需回滚，将 `mode` 改回 `zset` 并重复 freeze→等待→切回

## Impact
- Affected specs: `specs/runtime-performance/spec.md`
- Affected code: 
  - `src/app.js`（并发清理定时任务：KEYS→SCAN；后续在 slots 模式下不再需要全局扫描）
  - `src/models/redis.js`（通用键扫描/统计、scanKeys 辅助；并发工具双栈：zset 与 slots）
  - `src/routes/admin.js`（列表/搜索接口分页化；跨池聚合使用受限 SCAN）
