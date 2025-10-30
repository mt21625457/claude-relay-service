## Context
Redis `KEYS` 是 O(N) 阻塞操作。在键数量大时会阻塞 Redis 主线程，影响所有请求。需要以非阻塞的 `SCAN` 迭代替换，并在需要批处理时结合 `pipeline` 降低往返。

## Goals / Non-Goals
- Goals: 移除 `KEYS`，以 `SCAN`+pipeline 实现相同功能；保持功能等价或通过分页/游标提供可用替代
- Non-Goals: 与 Redis 无关的性能优化（文件 I/O、上游连接、日志、认证拆分等）

## Decisions
- 在统一的 Redis 工具中提供 `scanKeys(pattern, count)` 或基于 ioredis 的 `scanStream`
- 并发清理：优先 TTL/ZSET 过期；确需清理时用 `SCAN MATCH concurrency:* COUNT N` 分批 + pipeline 执行 DEL/UNLINK 等（不引入 Lua）
- 管理端列表：强制分页/游标化；不再尝试一次性“列出全部”

### Defaults
- Admin 默认分页大小：10
- Redis 最大遍历深度（按 SCAN 轮次计）：50

## Concurrency Mode（方案 1：不混跑切换）

### 双栈实现（无 Lua）
- zset 模式：`ZSET concurrency:{pool}`，成员为 tokenId，score 为过期时间；获取使用 WATCH/MULTI 进行乐观写入；获取/展示前执行一次 `ZREMRANGEBYSCORE` 局部清理；key 级 `PEXPIRE` 作为整键回收
- slots 模式：槽位键 `concurrency:{pool}:s:{slot}`（使用哈希标签 `{pool}`）；获取采用 `SET slot value NX PX leaseMs` 随机/轮转尝试；释放可“停止续期 + TTL 自然回收”；管理端按 `EXISTS/MGET` 统计占用

### 集中配置与原子切换
- Redis 配置键：
  - `concurrency:mode` = `zset` | `slots`
  - `concurrency:switch_at_ms` = 统一生效时间（毫秒，使用 Redis TIME 作为统一时钟）
  - `concurrency:freeze_until_ms` = 冻结截止时间（期间新令牌拒发）
- 切换流程：
  1) 部署支持双栈的新版本，但仍运行 `zset`（不改行为）
  2) 设置 `freeze_until_ms` 并等待一个完整租约窗口，确保旧令牌自然到期
  3) 设置 `mode=slots` 且 `switch_at_ms=T`，各实例到时刻 T 同步切换
  4) 解除 freeze，观察稳定；如需回滚，重复 freeze→等待→`mode=zset`→解除

### 键名与集群
- 使用 `{pool}` 作为哈希标签，保证同一并发池落在同一分片：`concurrency:{pool}:...`

### 无需全局扫描
- zset 模式仍不使用 KEYS；仅在跨池聚合数据时使用受限 SCAN（深度上限 50 轮）
- slots 模式完全依赖槽位键 TTL，不需要活跃清理任务

## Risks / Trade-offs
- `SCAN` 非原子，列表结果可能在迭代中发生变化；通过分页/游标降低一次性一致性的要求
- 对前端/调用方的“全量列出”期望需要设定上限或改为按需加载

## Migration Plan
1) 在工具层实现并验证 `scanKeys`
2) 替换并发清理中的 `KEYS` → `SCAN` + pipeline（zset 模式保持）
3) 替换管理端涉及 `KEYS` 的列表逻辑，增加分页/游标参数
4) 上线双栈并发实现（zset+slots），默认继续 zset
5) 通过集中配置执行 freeze → 等待租约 → 统一时刻切换至 slots；如需回滚按相同步骤切回
6) 在预发或本地环境以大量并发池与键进行回归，确认无阻塞与稳定性

## Open Questions
- 管理端需要的默认分页大小与最大遍历深度是多少？
- 并发清理是否可完全改为 TTL 驱动，减少主动扫描频率？（采用 slots 模式时为“是”，zset 模式为“按需局部清理”）
