# Agent instructions

These instructions apply to **any** coding agent working in this repository (Cursor, Claude Code, Codex, Copilot, Gemini, etc.). Prefer this file and `.agents/skills/` over tool-specific skill copies.

## Kit workflows

| Topic | Canonical doc |
|-------|----------------|
| Eject from starter / follow upstream / branch model | [`.agents/skills/eject-and-follow/SKILL.md`](.agents/skills/eject-and-follow/SKILL.md) |
| Customize with fewer merge conflicts | [`.agents/skills/modular-dev/SKILL.md`](.agents/skills/modular-dev/SKILL.md) |
| Deploy target sync | [`.agents/skills/deploy-targets/SKILL.md`](.agents/skills/deploy-targets/SKILL.md) |
| Keep product docs in sync | [`.agents/skills/keep-docs-updated/SKILL.md`](.agents/skills/keep-docs-updated/SKILL.md) |

When the user asks to eject, sync the kit, or set up product vs starter branches, **read and follow** `.agents/skills/eject-and-follow/SKILL.md` before acting.

## Branch model (summary)

| Branch | Role |
|--------|------|
| `main` | Product (default on remote when pushed) |
| `dev` | Starter line |
| `kit/main` | Local upstream mirror (**never push**) |
| `kit/sync/<topic>` | Short-lived kit → main merges (**never push**) |

On eject: create `dev` and `kit/main` at the same starter commit, then one linear eject commit on `main` (no merge). Ask if a remote is available; if yes, push `main` → set as default → push `dev`. Remove `.cursor/rules/project-identity.mdc` on `main` only. Leave this file and `.agents/skills/` on `main`. Follow is these instructions plus the skill — not a tool-specific rule.

If `.cursor/rules/project-identity.mdc` is present, this clone is still the starter — do not treat `main` as an ejected product. If it is absent, the product has ejected. **sync**, **fetch updates**, **fetch updates and suggestions**, and **what's new** mean: bootstrap a missing `upstream` or local `kit/main` (see the skill), refresh `kit/main` and `dev`, then suggest which commits to take and how each integrates. Apply only what was accepted. Skipping or adapting a suggestion is allowed; do not re-apply a skipped commit unless asked. Kit **sync** is not `pnpm deploy:sync`. Never push `kit/*`.

## Product docs (humans)

End-user / operator docs live in `docs/framework/` (Fumadocs). Do not put agent workflows there.
