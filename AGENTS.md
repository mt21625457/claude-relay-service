<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization
- Backend: `src/app.js` (entry) with modules in `src/routes/`, `src/services/`, `src/middleware/`, `src/utils/`, `src/validators/`, and CLI helpers in `src/cli/`.
- Tests: `tests/*.test.js` (Jest + Supertest).
- Frontend: `web/admin-spa` (Vue 3 + Vite + Tailwind). Build outputs to `web/admin-spa/dist/`.
- Config: copy `config/config.example.js` → `config/config.js` and `.env.example` → `.env` (see `make setup`).
- Scripts: `scripts/` contains operational tools, data migration, and service management.

## Build, Test, and Development Commands
- Quick start: `make setup && make dev` (nodemon with lint-on-change).
- Backend dev: `npm run dev`. Production: `npm start`.
- Tests: `npm test`.
- Lint/format: `npm run lint`, `npm run format` (CI enforces on PRs).
- Frontend: `make install-web && make build-web` or `cd web/admin-spa && npm run dev`.
- Docker: `make docker-up` / `make docker-down` (or `docker-compose up -d`). Logs: `make logs-follow`.
- Service manager: `npm run service:start`, `npm run service:stop`, `npm run service:status`.

## Coding Style & Naming Conventions
- Runtime: Node.js >= 18. CommonJS backend; Vue 3 SPA frontend.
- Prettier: 2 spaces, single quotes, no semicolons, width 100. Run `npm run format` (backend) or `cd web/admin-spa && npm run format`.
- ESLint: `eslint:recommended` + Prettier. Prefer `const`, `eqeqeq`, arrow callbacks, no `var`, unused vars prefixed with `_` if needed.
- Filenames: backend uses `camelCase.js` (e.g., `apiKeyService.js`); tests use `kebab-case.test.js` in `tests/`.
- Separation: route handlers in `src/routes/`; business logic in `src/services/`; shared helpers in `src/utils/`.

## Testing Guidelines
- Framework: Jest; HTTP tests with Supertest.
- Location: `tests/` with `*.test.js`.
- Run: `npm test`. Aim for meaningful unit and endpoint coverage for changed code.
- Keep tests deterministic; avoid external network; mock integrations.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `revert:`.
- PRs must: include a clear description, link related issues, and pass lint/format checks. Add screenshots for `web/admin-spa` UI changes.
- Secrets/config: never commit real secrets. When adding settings, update `.env.example` and `config/config.example.js` and document usage.

## Security & Configuration Tips
- Initialize config with `make setup`; adjust `config/config.js` and `.env` for local use.
- Prefer TLS via a reverse proxy in production; if enabling built-in HTTPS, set `server.https.certPath/keyPath` correctly.

## Communication Preference
- AI 助手在与当前项目用户互动时，应优先使用中文进行交流