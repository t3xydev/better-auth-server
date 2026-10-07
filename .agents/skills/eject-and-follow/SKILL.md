---
name: eject-and-follow
description: >-
  Ejects a fork onto product branches while keeping kit-tracking branches for
  upstream sync and selective merges. Use when ejecting from the starter kit,
  following upstream, syncing kit updates, cherry-picking starter changes, or
  setting up origin/upstream remotes and branch layout. Eject creates main
  (product) and dev (starter) from the same kit commit with a linear history.
  After that, "sync", "fetch updates", and "fetch updates and suggestions"
  refresh the starter and suggest which commits to take and how each integrates;
  the product may skip or adapt any suggestion.
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

Create three branches that share one starter commit, then a single linear product commit on `main`. Do not merge `main` and `dev` into each other. Do not leave `main` or `dev` with a different base than the kit tip.

Target shape:

| Branch | Points at |
|--------|-----------|
| `kit/main` | Exact starter tip (`upstream/main`, or `origin/main` when this repo is the kit) |
| `dev` | That **same commit**. Starter history only. |
| `main` | That commit, plus one normal eject commit. Product history grows as further linear commits on `main`. |

`git merge-base main dev` is `dev`. `git log dev..main` is the eject commit (and, only if the user asked, product commits replayed on top). No merge commit on either branch from eject.

### 1. Fetch and stop if history would be dropped

```bash
git fetch upstream          # if configured
KIT=upstream/main           # or origin/main when this repo is the kit
git log --oneline "$KIT"..main
git log --oneline "$KIT"..dev
```

Skip a `git log` when that branch does not exist yet. If either range lists commits, stop and show them. Do not `checkout -B` or `branch -f` over them unless the user explicitly agrees to rewrite.

With that yes: save the old tip (`git rev-parse main` / `dev`) and replay those commits **onto `main` after the eject commit** with `git cherry-pick` in order (skip merge commits). That keeps one line. Without that yes, stop. Do not discard the commits and do not merge the old branch in.

If the worktree is dirty, stop. The eject commit is only the identity-rule deletion.

### 2. Point all three at the kit tip

```bash
git checkout -B kit/main "$KIT"
git branch -f dev kit/main          # same SHA as kit/main; not a merge
git checkout -B main kit/main
```

`branch -f dev` fails if `dev` is checked out. Move to `kit/main` first, then force `dev`, then check out `main`.

### 3. One commit on `main` only

Never on `kit/main` or `dev`:

```bash
git rm .cursor/rules/project-identity.mdc
git commit -m "$(cat <<'EOF'
chore: drop starterkit project-identity rule after eject

EOF
)"
```

If the user agreed to replay older product commits, cherry-pick them onto this commit now. Still no merge commits.

### 4. Check the history before pushing or declaring eject done

```bash
test "$(git rev-parse dev)" = "$(git rev-parse kit/main)"
git merge-base --is-ancestor dev main
test -z "$(git log --merges --oneline dev..main)"
test -z "$(git log --oneline kit/main..dev)"
git log --oneline dev..main
```

`dev..main` is the eject commit, or that commit plus the replay the user asked for. `project-identity.mdc` is gone on `main` and still present on `dev` and `kit/main`.

Then:

1. Keep product work on **`main`**. Leave **`dev`** as the starter line.
2. Tell the user the shape, and that they can say **sync**, **fetch updates**, or **fetch updates and suggestions** when they want starter changes reviewed.
3. Do **not** rewrite `kit/main` with product commits.
4. Do **not** push `kit/main` or `kit/sync/*`.

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

Push `main` only if it fast-forwards `origin/main` (the usual case: one eject commit on the starter tip). If the user asked to replay or rewrite and the push is not a fast-forward, stop and ask. Do not force-push unless they explicitly say so. `dev` is a new branch at the starter tip; a first push is a fast-forward. If `origin/dev` already diverged, show that log and ask before rewriting it.

## Prompts after eject

These mean **follow upstream**: refresh `kit/main` and `dev`, then suggest. Do not cherry-pick or merge onto `main` until the user accepts the plan.

| User says | Do |
|-----------|-----|
| sync / sync the kit / sync upstream | Refresh, then suggest commits and integrations |
| fetch updates / fetch updates and suggestions / what's new | Same |
| take \<commits or topic they name\> | Skip the wait and apply only that |

**sync** here is the starter. Generating deploy files is `pnpm deploy:sync` ([`deploy-targets`](../deploy-targets/SKILL.md)). Use that when they mention deploy targets. Use this follow flow when they mention the kit, starter, upstream, or suggestions.

## Follow upstream

Refresh the kit branch (and starter `dev`), then **suggest** which commits to bring into the product and how each one integrates. Apply only what the user accepts. `main` may deviate from the kit; skipped or adapted commits stay off `main`.

Keep `dev` fast-forward only. If `git merge --ff-only kit/main` fails, do not merge. Show `git log --oneline kit/main..dev` and ask. A merge commit on `dev` breaks the clean starter line.

Hard rules stay in force either way: never push `kit/*`, never rewrite `kit/main` with product commits, never force-push `main` or `dev` unless the user explicitly asks.

```bash
git fetch upstream
git checkout kit/main
git merge --ff-only upstream/main   # prefer ff-only; if it fails, reset --hard upstream/main only with user OK
# kit/main is no_push — do not git push

git checkout dev
git merge --ff-only kit/main        # keep starter branch aligned
# if remote was set up: git push origin dev
```

## Suggest commits and integrations

Do this after `kit/main` and `dev` are refreshed, and before any cherry-pick or merge onto `main`. Skip the wait only when the user already named the commits or told you to take the update.

Deviation is normal. Suggest the conflict-light path; if the user skips a commit, rewrites it, or lands it in a different file, do that.

### Inspect

```bash
git log --oneline --no-merges main..kit/main
git diff --stat main...kit/main
```

Read subjects and the files each commit touches. Group the range into topics (feature, fix, schema, deploy) instead of one undifferentiated update.

### Suggest

Show a short plan and wait for accept, trim, or replace:

| | Commit | Why | Integration |
|--|--------|-----|-------------|
| take / skip / adapt | `<sha>` subject | one line | as-is, thin wire, or adapt |

**Integration** is how that commit meets code already on `main`:

| Choice | When |
|--------|------|
| **As-is** | Product has not customized those files |
| **Thin wire** | Commit edits a composition file (`src/lib/auth.ts`, a layout, deploy config). Keep product logic in `src/modules/` or `src/lib/plugins/`; the shared file only imports or registers. See [`modular-dev`](../modular-dev/SKILL.md). |
| **Adapt** | Same intent, but `main` already diverged — say what you will keep from each side |
| **Skip** | Conflicts with a product decision. Leave it off `main`. |

Prefer several small topics over one merge of `kit/main`. For a commit that will conflict, name the integration that avoids it (move product-only logic out of the shared file, then take the kit hunk). Say which hunks will still conflict if the user edits the kit file in place, then follow their choice.

On the next follow, list previously skipped commits again as optional. Do not re-apply them unless the user asks.

### Apply the accepted plan

One `kit/sync/<topic>` per accepted topic. Cherry-pick when those commits apply cleanly. Merge a wider range only when the user asked for that whole update.

A sync commit is the accepted kit change plus the smallest integration hunk. Do not bundle an unrelated product refactor into it.

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

**Broader kit update** — only after the user accepts the whole range. Merge `kit/main` into a sync branch, not straight onto `main`:

```bash
git checkout -b kit/sync/$(date +%Y%m%d) main
git merge kit/main
# resolve; prefer keeping files under src/modules/ and product overrides
git checkout main
git merge --no-ff kit/sync/…
```

Never push `kit/main` or `kit/sync/*`. Never force-push `main` or `dev` unless the user explicitly asks.

## Conflict triage

When merging kit → main, use these defaults for a plan the user accepted as proposed. If they chose adapt, skip, or an in-place edit, follow that choice.

1. Prefer **main** for files under `src/modules/` and clear product overrides.
2. Prefer **kit** / **dev** for starter core you have not customized.
3. For shared composition files (`src/lib/auth.ts`, layouts, deploy config): keep **thin wiring**; move custom logic out (see [`modular-dev`](../modular-dev/SKILL.md)).
4. Prefer **main** for `.cursor/rules/project-identity.mdc` — keep it deleted after eject.
5. Re-run `pnpm deploy:sync` after kit changes touch `deploy/config.ts`.

## What “ejected” means here

Eject is **branch separation** with a shared starter commit: **`dev` and `kit/main` match**, **`main` is that commit plus a linear product history**, and starterkit-only agent identity is dropped on `main` only. Local **`kit/main`** stays no_push. Full hard-fork (drop remotes / never sync) only if the user asks explicitly.

On eject, remove `.cursor/rules/project-identity.mdc` from **`main`** only. Leave it on **`dev`** and **`kit/main`**.

## Checklist

```
Eject / follow:
- [ ] Asked whether remote is available
- [ ] upstream remote present when following (or origin is the kit)
- [ ] kit/main tracks starter locally (no_push — never on origin)
- [ ] main is the product branch
- [ ] dev is the starter branch, same commit as kit/main
- [ ] main is a linear descendant of that commit (eject commit, plus a replay only if the user asked)
- [ ] no merge commit was used to create main or dev
- [ ] unique commits on the old main/dev were shown before any rewrite
- [ ] If remote: pushed main (fast-forward), set as default, then pushed dev
- [ ] .cursor/rules/project-identity.mdc removed on main (kept on dev)
- [ ] product commits are not on kit/main or dev
- [ ] Follow: inspected main..kit/main and suggested commits + integrations before touching main
- [ ] User accepted, trimmed, or replaced the plan; skips and adaptations were kept
- [ ] Previously skipped commits were not re-applied
- [ ] sync uses kit/sync/* then merge to main; each sync commit is one accepted topic
- [ ] kit→main conflicts: keep project-identity.mdc deleted on main
- [ ] never push kit/main or kit/sync/*
- [ ] no force-push of main/dev unless user requested
```

## Related

- Customization with fewer conflicts → [`modular-dev`](../modular-dev/SKILL.md)
- Deploy file edits → [`deploy-targets`](../deploy-targets/SKILL.md)
- Agent index → [`AGENTS.md`](../../AGENTS.md)
