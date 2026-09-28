# Architecture

Omnichannel SaaS combines AI voice calling and WhatsApp messaging under one login.

## Request flow

`HTTP → Route → Controller → Service → Repository → Database`

External providers:

`Service → Integration → External API`

## Layout

- `backend/` — Express API, jobs, and provider integrations
- `frontend/` — React (Vite) UI
- `packages/diploy-core/` — `@diploy/core` helpers
- `packages/shared/` — roles, error codes, constants (`@shared/*`)
- `infra/docker/` — app image and ignore rules (build from repo root)
- `infra/pm2/` — production process config
- `scripts/` — setup, DB, and path-alias loader
- `docs/` — installation and architecture notes
- `storage/` — runtime files only (gitignored except `.gitkeep`)
- `dist/` — build output (gitignored)

Schema tables stay in `backend/src/config/` (`@shared/schema`, `@shared/whatsapp-schema`).
