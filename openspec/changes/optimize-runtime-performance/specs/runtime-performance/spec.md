## ADDED Requirements

### Requirement: Redis Scans Use SCAN with Pipelines
The system SHALL replace `KEYS` full scans with `SCAN` iteration and batch Redis operations via pipelines, especially for concurrency cleanup and admin listings.

#### Scenario: Concurrency cleanup without KEYS
- WHEN cleaning `concurrency:*` keys periodically
- THEN the system SHALL iterate with `SCAN MATCH concurrency:* COUNT <N>` and execute batched cleanup via pipeline (or TTL/ZSET expiry semantics)

#### Scenario: Admin listing via SCAN
- WHEN listing keys for admin views
- THEN the system SHALL use `SCAN`-based iteration with pagination/streaming, avoiding blocking the Redis main thread

### Requirement: Concurrency Mode Switch Without Mixed Deployment
The system SHALL support a dual-stack concurrency control (zset and slots) and provide a centralized Redis configuration to switch modes atomically without mixed-mode runtime.

#### Scenario: Centralized switch with freeze window
- WHEN operators set `concurrency:freeze_until_ms` and wait at least one full lease window
- THEN the system SHALL stop issuing new tokens during freeze and allow existing leases to expire naturally

#### Scenario: Atomic mode switch using Redis TIME
- WHEN `concurrency:mode=slots` and `concurrency:switch_at_ms=T` are set
- THEN all instances SHALL switch from `zset` to `slots` at time T using Redis TIME as the shared clock, and SHALL operate in a single mode cluster-wide

#### Scenario: Safe rollback
- WHEN operators revert `concurrency:mode=zset` using the same freeze → wait → switch procedure
- THEN the system SHALL return to `zset` mode without issuing mixed-mode tokens
