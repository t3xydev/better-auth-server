---
name: deploy-targets
description: >-
  Syncs Railway IaC (.railway/railway.ts), Dokploy, and Cloudflare deploy configs
  from deploy/config.ts. Use when adding or changing deploy targets, running
  deploy:sync, editing Dockerfile/docker-compose/wrangler/.railway, or switching
  Cloudflare Containers vs Workers/OpenNext.
---

# Deploy targets

Tool-agnostic. Use when adding or changing deploy targets, running `deploy:sync`, editing Dockerfile / `.railway/` / docker-compose / wrangler, or switching Cloudflare Containers vs Workers/OpenNext.

## Rules

1. **Edit** [`deploy/config.ts`](../../../deploy/config.ts) only — never hand-edit generated files.
2. After config changes, run **`pnpm deploy:sync`**.
3. Point users to [`docs/framework/deployment.mdx`](../../../docs/framework/deployment.mdx) for platform UI steps.

Generated (do not hand-edit): `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.railway/railway.ts`, `.railway/README.md`, `wrangler.jsonc`, and `open-next.config.ts` (Workers mode only).

Do **not** revive `railway.toml` / `railway.json` — Railway Config as Code is deprecated (hard cutoff 2026-12-01). Use Infrastructure as Code under `.railway/`.

## Target map

| Platform | Artifacts | How to deploy |
|----------|-----------|----------------|
| Railway | `.railway/railway.ts` + `Dockerfile` | `railway link` → `railway config plan` → `railway config apply`; set secrets; deploy |
| Dokploy | `docker-compose.yml` + `Dockerfile` | Compose path `./docker-compose.yml`; set `dokploy.domain` first |
| Cloudflare Containers (default) | `wrangler.jsonc` + `Dockerfile` + `deploy/cloudflare/container-worker.ts` | `pnpm cf:deploy`; set required secrets with `wrangler secret put` |
| Cloudflare Workers | OpenNext `wrangler.jsonc` + `open-next.config.ts` | Set `cloudflare.runtime: "workers"`, sync, install OpenNext deps |

## Config knobs

- `port`, `healthcheckPath`, `healthcheckTimeout`, `buildCommand`, `migrateCommand`, `startCommand`
- `containerStartCommand` — migrate then start (containers need `DATABASE_URL` at **start**)
- `requiredEnv` — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `railway.*` — IaC project/service/repo/region names for `.railway/railway.ts`
- `cloudflare.runtime` — `"containers"` (default) or `"workers"`
- `cloudflare.instanceType` — Containers size (`basic` default in this kit; Wrangler’s omit-default is `lite`)
- `dokploy.domain` / `dokploy.routerName` — Traefik Host rule

## Railway notes

- Healthcheck path must return **2xx** for deploy success. `/api/health` is liveness (always 2xx when the process is up); use `/api/health?ready=1` for DB readiness.
- Do **not** set a custom `PORT` — Railway injects it for healthchecks and public networking. The Dockerfile default (`3000`) is only for non-Railway hosts.
- After syncing IaC, run `railway config plan` / `apply`. Clear any leftover dashboard overrides (wrong health path, Railpack build command, sleep mode).
- Runtime image must include `source.config.ts`, a **writable** `.source` (fumadocs-mdx recompiles `source.config.mjs` at `next start`), and `docs/framework`.

## Cloudflare switch

**Containers → Workers**

1. Set `cloudflare.runtime: "workers"` in `deploy/config.ts`
2. `pnpm deploy:sync`
3. `pnpm add -D @opennextjs/cloudflare`
4. Document Hyperdrive for Postgres — app DB code is not Hyperdrive-wired yet

**Workers → Containers**

1. Set `cloudflare.runtime: "containers"`
2. `pnpm deploy:sync`

## Classic hosts

Render / Fly / similar (no Docker): `pnpm build` then `pnpm start` (start applies pending migrations). Schema changes still use local `pnpm db:sync` before deploy.
