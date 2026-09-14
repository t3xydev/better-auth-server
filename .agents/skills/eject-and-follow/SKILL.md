---
name: eject-and-follow
description: >-
  Ejects a fork onto product branches while keeping kit-tracking branches for
  upstream sync and selective merges. Use when ejecting from the starter kit,
  following upstream, syncing kit updates, cherry-picking starter changes, or
  setting up origin/upstream remotes and branch layout.
---

# Eject and follow upstream

Tool-agnostic. Any coding agent should follow this when ejecting from the starter kit, following upstream, syncing kit updates, cherry-picking starter changes, or setting up remotes and branch layout.

Fork stays syncable: **product work lives on `main`**; **`dev` is the starter line**; local `kit/*` helpers stay no_push.

## Branch model

| Branch | Role |
|--------|------|
| `main` | Product line (default day-to-day work; **default branch** on the remote when pushed) |
| `dev` | Starter line (tracks / mirrors the kit starter on the fork) |
| `kit/main` | Local-only tracker of upstream starter (**no_push** — never push to origin) |
| `kit/sync/<topic>` | Optional short-lived branch to bring a kit change into `main` (**no_push**) |

Do not invent more permanent branches unless the user asks. After eject, product work is on **`main`**; starter-aligned work stays on **`dev`**.

`kit/main` and `kit/sync/*` are local helpers for mirroring / merging the starter. They must not appear on `origin`.

## Remotes

```bash
# origin = this fork (already set)
# upstream = starter kit (add once)
git remote add upstream https://github.com/t3xydev/better-auth-server.git
git fetch upstream
```

If the fork *is* the starter repo, skip `upstream` and treat `origin`’s starter tip as the kit source while product work diverges on `main`.

## Eject (once)

Creates local kit tracking, product `main`, and starter `dev`.

```bash
git fetch upstream   # if configured
git checkout -B kit/main upstream/main   # or origin/main when no upstream remote
git checkout -B main kit/main            # product branch (will diverge)
git checkout -B dev kit/main             # starter branch
```

Then, **on `main` only** (never on `kit/main` or `dev`):

1. Delete the starterkit identity rule so product agents stop treating the fork as the kit:

   ```bash
   git rm .cursor/rules/project-identity.mdc
   git commit -m "$(cat <<'EOF'
   chore: drop starterkit project-identity rule after eject

   EOF
   )"
   ```

2. Keep product work on **`main`**. Leave **`dev`** as the starter line (do not drop `project-identity.mdc` there).
3. Tell the user: kit syncs refresh local **`kit/main`** (no_push) and **`dev`**; features land on **`main`**; bring kit changes via **`kit/sync/*`**.
4. Do **not** rewrite `kit/main` with product commits.
5. Do **not** push `kit/main` or `kit/sync/*`.

If `.cursor/rules/project-identity.mdc` reappears when merging kit → main, prefer **main** (keep it deleted) unless the user wants the kit rule back.

### Ask: is a remote available?

**Always ask** the user whether `origin` (or another remote) is available and they want branches pushed.

**If remote is available** — push **`main` first** so it can be the default, then **`dev`**:

```bash
git push -u origin main
gh repo edit --default-branch main   # GitHub; skip / adapt for other hosts
git push -u origin dev
```

Order matters: push `main` → set default → push `dev`. Never push `kit/*`.

**If no remote** — leave branches local; skip push and default-branch steps.

## Follow upstream

Refresh the kit branch (and starter `dev`), then selectively bring changes into the product.

```bash
git fetch upstream
git checkout kit/main
git merge --ff-only upstream/main   # prefer ff-only; if it fails, reset --hard upstream/main only with user OK
# kit/main is no_push — do not git push

git checkout dev
git merge --ff-only kit/main        # keep starter branch aligned
# if remote was set up: git push origin dev
```

### Bring a change into the app

**Small / known commits** — cherry-pick onto a sync branch:

```bash
git checkout main
git checkout -b kit/sync/<short-topic>
git cherry-pick <sha>…              # from kit/main or dev
# resolve conflicts, keep product customizations
git checkout main
git merge --no-ff kit/sync/<short-topic>
git branch -d kit/sync/<short-topic>
```

**Broader kit update** — merge `kit/main` into a sync branch, not straight onto `main` until reviewed:

```bash
git checkout -b kit/sync/$(date +%Y%m%d) main
git merge kit/main
# resolve; prefer keeping files under src/modules/ and product overrides
git checkout main
git merge --no-ff kit/sync/…
```

Never push `kit/main` or `kit/sync/*`. Never force-push `main` or `dev` unless the user explicitly asks.

## Conflict triage

When merging kit → main:

1. Prefer **main** for files under `src/modules/` and clear product overrides.
2. Prefer **kit** / **dev** for starter core you have not customized.
3. For shared composition files (`src/lib/auth.ts`, layouts, deploy config): keep **thin wiring**; move custom logic out (see [`modular-dev`](../modular-dev/SKILL.md)).
4. Prefer **main** for `.cursor/rules/project-identity.mdc` — keep it deleted after eject.
5. Re-run `pnpm deploy:sync` after kit changes touch `deploy/config.ts`.

## What “ejected” means here

Eject is **branch separation** plus dropping starterkit-only agent identity on the product branch. **`dev` stays the starter**; local **`kit/main`** stays no_push for upstream ff. Full hard-fork (drop remotes / never sync) only if the user asks explicitly.

On eject, remove `.cursor/rules/project-identity.mdc` from **`main`** only. Leave it on **`dev`** and **`kit/main`**.

## Checklist

```
Eject / follow:
- [ ] Asked whether remote is available
- [ ] upstream remote present when following (or origin is the kit)
- [ ] kit/main tracks starter locally (no_push — never on origin)
- [ ] main is the product branch
- [ ] dev is the starter branch
- [ ] If remote: pushed main, set as default, then pushed dev
- [ ] .cursor/rules/project-identity.mdc removed on main (kept on dev)
- [ ] product commits are not on kit/main or dev
- [ ] sync uses kit/sync/* then merge to main
- [ ] kit→main conflicts: keep project-identity.mdc deleted on main
- [ ] never push kit/main or kit/sync/*
- [ ] no force-push of main/dev unless user requested
```

## Related

- Customization with fewer conflicts → [`modular-dev`](../modular-dev/SKILL.md)
- Deploy file edits → [`deploy-targets`](../deploy-targets/SKILL.md)
- Agent index → [`AGENTS.md`](../../AGENTS.md)
