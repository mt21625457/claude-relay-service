% Concurrency Mode Switch (No Mixed Deployment)

## Centralized Keys (in Redis)
- `concurrency:mode` = `zset` | `slots`
- `concurrency:switch_at_ms` = epoch milliseconds (use Redis TIME for a shared clock)
- `concurrency:freeze_until_ms` = epoch milliseconds; new tokens are denied while active

## Zero-Downtime Switching (Scheme 1)
1) Deploy dual-stack build across all instances (default remains `zset`)
2) Freeze window (deny new tokens); wait for one full lease window
   - `SET concurrency:freeze_until_ms <now_ms + 60000>`
3) Plan the atomic switch using Redis TIME
   - `SET concurrency:mode slots`
   - `SET concurrency:switch_at_ms <future_ms>`
4) Observe after T; unfreeze by clearing/expiring `freeze_until_ms`
5) Rollback (if needed): repeat freeze → wait → `mode zset` → unfreeze

## Config-Driven (Blue/Green)

Use env files to instruct instances to write centralized keys on startup (no per-instance mode logic). Recommended for blue/green cutover:

- Blue (zset) instance env: `config/concurrency.zset.env.example`
- Green (slots) instance env: `config/concurrency.slots.env.example`

Steps:
- Prepare both envs; set `CONCURRENCY_APPLY_ON_STARTUP=true`
- Start green with slots env; when healthy, move traffic from blue → green atomically at LB
- Optional: use `CONCURRENCY_SWITCH_AT_MS` for a scheduled unified flip; use `CONCURRENCY_FREEZE_UNTIL_MS` during window

Verification:
- `/metrics` returns `{ concurrency: { mode, freezeActive } }`
- `/admin/concurrency/overview` shows pool occupancy for current mode

## Verification
- Health page/logs show current mode and whether freeze is active
- During freeze: requests with concurrency limits receive 429 without issuing new tokens
- After switch: occupancy keys under `concurrency:{apiKeyId}:req:*` appear

## Notes
- No KEYS calls: system uses SCAN with capped rounds (default 50)
- Use hash tag `{pool}` in future per-pool keys to keep slot locality
- Ensure leaseSeconds and renew interval are tuned for your workloads
