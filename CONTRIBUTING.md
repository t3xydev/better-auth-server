# Contributing

Thanks for helping improve Better Auth Server.

This repository is a fork of [daveyplate/better-auth-nextjs-starter](https://github.com/daveyplate/better-auth-nextjs-starter). Please keep that attribution and the [t3xy.dev](https://t3xy.dev) credit intact in the README when you contribute.

## Ways to contribute

- Bug reports and deployment notes for new platforms  
- Docs fixes and clearer examples  
- Features that keep the “clone → configure → deploy” path simple  
- Plugin integrations that are well-documented and optional by default  

## Development

```bash
pnpm install
cp .env.example .env   # fill required vars
pnpm db:sync
pnpm dev
```

Before opening a PR:

```bash
pnpm lint
pnpm check-types
pnpm build
```

If you change Better Auth plugins or schema:

```bash
pnpm db:sync
```

Commit the updated `src/database/schema.ts` and any new files under `migrations/`.

## Pull requests

1. Keep changes focused — one concern per PR when possible.  
2. Update docs under `docs/framework/` when behavior or env vars change.  
3. Prefer extending existing patterns in `src/lib/auth.ts` over parallel auth stacks.  

## Code style

- Biome for lint/format (`pnpm lint`, `pnpm format`)  
- Match existing TypeScript and component patterns  
- Do not commit `.env` or secrets  

## Questions

Open an issue on the repository, or start a discussion if you are proposing a larger feature.
