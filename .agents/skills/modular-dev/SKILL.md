---
name: modular-dev
description: >-
  Guides subtle module-style customization so product changes stay additive and
  conflict-light when syncing the starter kit. Use when adding features,
  customizing auth/UI/deploy, extending plugins, or reducing merge conflicts
  with upstream / kit/main.
---

# Modular development (light)

Tool-agnostic. Use when adding features, customizing auth/UI/deploy, extending plugins, or reducing merge conflicts with upstream / `kit/main`.

Goal: **customize without forking the kit’s spine.** Prefer new files and thin hooks over deep edits. Keep this subtle — not a heavy module framework.

## Defaults

1. **Add before edit** — new feature → new file under an extension path; wire it from one composition point.
2. **One wiring file** — touch `src/lib/auth.ts`, a layout, or a route only to import/register; keep logic elsewhere.
3. **Wrap, don’t fork** — compose kit components; avoid copying whole UI trees to tweak one prop.
4. **Env-gate product toggles** — match existing kit style (`NEXT_PUBLIC_*`, server env) instead of hardcoding forks.
5. **Leave generated deploy alone** — change `deploy/config.ts` + `pnpm deploy:sync` (see [`deploy-targets`](../deploy-targets/SKILL.md)).

## Where product code lives

Prefer these homes (create only when needed):

| Path | Use for |
|------|---------|
| `src/modules/<name>/` | Product features (pages helpers, domain logic, feature UI) |
| `src/lib/plugins/` | Better Auth plugins (same pattern as `nostr-link.ts`) |
| `src/lib/actions/` | Server actions scoped to a feature |
| `src/components/<feature>/` | Feature UI that isn’t a shared primitive |

Keep kit paths (`src/components/ui/`, core auth routes, `src/database/schema.ts`) stable unless the change *must* live there.

### Module shape (minimal)

```
src/modules/<name>/
  index.ts          # public exports only
  <name>.ts         # logic
  <name>-view.tsx   # UI if needed
```

No required registry, barrels across the whole app, or DI container. One folder + `index.ts` is enough.

## Extension points in this kit

| Concern | Prefer |
|---------|--------|
| Auth behavior | New plugin in `src/lib/plugins/`, register in `src/lib/auth.ts` `plugins` array |
| Auth client | Thin helpers next to the feature; avoid bloating `auth-client.ts` unless shared |
| Schema | Additive tables/columns in schema; run `pnpm db:sync` / migrate as the kit docs say |
| Admin UI | New routes/components under `src/app/admin/…` + `src/components/admin/` |
| Email / branding | Env + existing `sendEmail` templates; don’t fork the mailer unless necessary |
| Deploy | `deploy/config.ts` only |

## Conflict-light edits

When you must change a kit file:

- **Smallest diff** — import + one call site, not inlined feature code.
- **Stable names** — don’t rename kit exports the product doesn’t own.
- **Adjacent custom file** — e.g. `auth.ts` imports `./modules/billing/register` instead of embedding billing.
- **Avoid drive-by** — no unrelated formatting/refactors on kit files (hurts cherry-picks).

## Sync awareness

If the branch layout from [`eject-and-follow`](../eject-and-follow/SKILL.md) is in use:

- Product work → `main` (and feature branches off it)
- Starter line → `dev`
- Upstream refresh → `kit/main` (no_push) → align `dev`, then suggest commits and integrations before applying (see [`eject-and-follow`](../eject-and-follow/SKILL.md)). The product may skip or adapt any suggestion.
- On conflict in a wiring file: restore thin imports; keep module bodies from the product side. If the user wants the edit in the kit file anyway, do that and note the hunks that will conflict next sync.

## Anti-patterns

- Copying large kit files into `src/modules/` “just in case”
- Parallel auth configs or duplicate Drizzle schemas
- Editing generated deploy artifacts by hand
- Wide renames of kit folders for aesthetics

## Checklist

```
Customization:
- [ ] New behavior mostly in src/modules/* or src/lib/plugins/*
- [ ] Kit files only wire / register
- [ ] No hand-edits to generated deploy files
- [ ] Diff on shared files stays small
```
