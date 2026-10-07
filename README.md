<p align="center">
  <img src="docs/assets/banner.svg" alt="Better Auth Server — your own OpenID Connect issuer" width="100%" />
</p>

<p align="center">
  <strong>Your own OpenID Connect / OAuth identity server, on Better Auth.</strong><br />
  Run the issuer. Other apps sign in through standard OAuth 2.1 / OIDC.<br />
  Email, passkeys, and Nostr today. Bluesky and wallet identity on the roadmap.
</p>

<p align="center">
  <a href="https://t3xy.dev">t3xy.dev</a>
</p>

<p align="center">
  <a href="https://better-auth-server.t3xy.dev/"><img src="https://img.shields.io/badge/live%20demo-t3xy.dev-0B1220?style=flat-square" alt="Live demo" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/quick%20start-3%20commands-0d9488?style=flat-square" alt="Quick start" /></a>
  <a href="https://better-auth.com"><img src="https://img.shields.io/badge/Better%20Auth-1.7-black?style=flat-square" alt="Better Auth" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square" alt="Next.js" /></a>
  <a href="https://orm.drizzle.team"><img src="https://img.shields.io/badge/Drizzle-PostgreSQL-C5F74F?style=flat-square" alt="Drizzle" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-slate?style=flat-square" alt="MIT" /></a>
</p>

<p align="center">
  <a href="https://better-auth-server.t3xy.dev/"><strong>Live demo</strong></a> ·
  <a href="https://better-auth-server.t3xy.dev/docs/framework">Docs</a> ·
  <a href="https://t3xy.dev">t3xy.dev</a> ·
  <a href="docs/framework/product.mdx">Product</a> ·
  <a href="docs/framework/getting-started.mdx">Getting started</a> ·
  <a href="docs/framework/features.mdx">Features</a> ·
  <a href="docs/framework/deployment.mdx">Deploy</a>
</p>

---

## What this is

A framework and starter for an **authorization server you own**. The Next.js app is the identity host: sign-in UI, OAuth / OIDC endpoints, discovery, consent, and admin. Other products authenticate against it. It is built for two setups, and both are intentional.

| Mode | What you do |
|---|---|
| **Extend the template** | Keep this app and grow product UI on the same deploy |
| **Accounts-style IdP** | Deploy this as the accounts host; other apps are separate OAuth / OIDC clients |

Postgres, migrations, SMTP (or a console mailer), branding from env vars, and `/api/health` are included. Clone it, set three variables, migrate, deploy.

**Live demo:** [https://better-auth-server.t3xy.dev/](https://better-auth-server.t3xy.dev/)

## What ships

| Capability | Status |
|---|---|
| Email code sign-in, plus email & password | Ready |
| OAuth 2.1 / OpenID Connect provider, discovery, consent | Ready |
| Passkeys (WebAuthn) and TOTP two-factor | Ready |
| Nostr sign-in and key linking | Ready |
| User invitations (invite-only is opt-in) | Ready |
| Organizations | Opt-in (`NEXT_PUBLIC_ORGANIZATIONS_ENABLED`) |
| Account billing — card or USDC | Opt-in (`NEXT_PUBLIC_BILLING_ENABLED`) |
| Admin UI for users, roles, groups, and OAuth clients | Ready |
| Client trust tiers for dynamic registration | Ready |
| OpenAPI reference, health check, optional PostHog / Sentry / OpenTelemetry | Ready |
| Bluesky (AT Proto), Bitcoin Connect, Lightning, Ethereum | Planned |

Details: [features](docs/framework/features.mdx) · [product](docs/framework/product.mdx) · [client trust](docs/framework/client-trust-model.mdx)

## Stack

- [Better Auth](https://www.better-auth.com) + [Better Auth UI](https://better-auth-ui.com)
- [Next.js](https://nextjs.org) 15 (App Router) · [React](https://react.dev) 19
- [Drizzle ORM](https://orm.drizzle.team) · [PostgreSQL](https://www.postgresql.org)
- [shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS](https://tailwindcss.com) 4 · [Biome](https://biomejs.dev)

## Quick start

**1. Clone and install**

```bash
git clone https://github.com/t3xydev/better-auth-server.git
cd better-auth-server
pnpm install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Set at least:

```bash
BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
BETTER_AUTH_URL="http://localhost:3000"
DATABASE_URL="postgresql://user:pass@localhost:5432/better_auth"
```

SMTP, branding, OAuth, billing, and observability are in [environment variables](docs/framework/environment-variables.mdx).

**3. Sync the database and run**

```bash
pnpm db:sync   # generate schema, write migrations, apply them
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You land on sign-in.

> First admin: sign up, then `UPDATE users SET role = 'admin' WHERE email = 'you@example.com';`  
> With `NEXT_PUBLIC_INVITE_ONLY=true`, the first user can still sign up. Later sign-ups need an invite — [invitations](docs/framework/invitations.mdx).  
> Admin UI: [admin panel](docs/framework/admin-panel.mdx).

## Deploy

Synced targets (Cloudflare Containers, Railway, Dokploy) live in [`deploy/config.ts`](deploy/config.ts). After edits:

```bash
pnpm deploy:sync
```

| Setting | Classic hosts | Railway / Dokploy | Cloudflare Containers |
|---|---|---|---|
| **Build** | `pnpm build` | Pull `ghcr.io/<owner>/<repo>:latest` | Image: `pnpm build` |
| **Start** | `pnpm start` | `pnpm start` (image CMD) | `pnpm start` |

A version-bump PR publishes the semver tag. A GitHub Release from `main` also moves `:latest`. Railway image auto-updates and Dokploy (`pull_policy: always`) fetch that tag.

`pnpm start` and `pnpm dev` apply pending migrations before the server listens. `DATABASE_URL` is required at start. Host notes: [deployment](docs/framework/deployment.mdx).

```mermaid
flowchart LR
  A[Clone] --> B[Set env]
  B --> C[pnpm db:sync]
  C --> D[pnpm dev]
  B --> E[Deploy]
  E --> F[start migrates then serves]
  F --> G[Auth server live]
```

## Project layout

```text
src/
├── app/                 # Next.js routes (auth UI, admin, OIDC discovery, MCP)
├── components/          # UI + admin OAuth client tools
├── database/            # Drizzle client + schema
└── lib/
    ├── auth.ts          # Better Auth server config (plugins live here)
    ├── auth-client.ts   # Browser client
    └── email.ts         # SMTP / console mailer
deploy/                  # Shared deploy config + sync (Railway / Dokploy / Cloudflare)
docs/
├── assets/              # README banner
└── framework/           # Canonical docs (Fumadocs; /docs/framework when enabled)
migrations/              # Committed Drizzle SQL (required for deploys)
```

## Documentation

Canonical source: [`docs/framework`](docs/framework). The in-app site is at `/docs/framework` when `NEXT_PUBLIC_DOCS_ENABLED=true`.

| Guide | When you need it |
|---|---|
| [Product](docs/framework/product.mdx) | IdP framing, the two usage modes, planned identity methods |
| [Getting started](docs/framework/getting-started.mdx) | Local setup |
| [Features](docs/framework/features.mdx) | Plugins, endpoints, defaults |
| [Deployment](docs/framework/deployment.mdx) | Railway, Dokploy, Cloudflare, and classic hosts |
| [Environment variables](docs/framework/environment-variables.mdx) | Secrets, SMTP, branding, flags |
| [Billing](docs/framework/billing.mdx) | Subscriptions, card or USDC, entitlements |
| [Admin panel](docs/framework/admin-panel.mdx) | OAuth clients |
| [Roles and groups](docs/framework/roles-and-groups.mdx) | Catalog roles, groups, token claims |
| [Client trust model](docs/framework/client-trust-model.mdx) | Trust tiers, dynamic registration, scopes |
| [Invitations](docs/framework/invitations.mdx) | Invites and invite-only registration |
| [Observability](docs/framework/observability.mdx) | PostHog, Sentry, OpenTelemetry |

## Roadmap

Same account model, both usage modes:

- Bluesky (AT Proto) sign-in and linking
- Bitcoin Connect, Lightning, and Ethereum wallet identity

Ideas and PRs: [CONTRIBUTING.md](CONTRIBUTING.md) and [product](docs/framework/product.mdx).

## Credits

Maintained at [t3xy.dev](https://t3xy.dev). Built on [Better Auth](https://www.better-auth.com).

## License

[MIT](LICENSE)
