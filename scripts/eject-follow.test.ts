import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "eject-test",
    GIT_AUTHOR_EMAIL: "eject-test@example.com",
    GIT_COMMITTER_NAME: "eject-test",
    GIT_COMMITTER_EMAIL: "eject-test@example.com",
    GIT_TERMINAL_PROMPT: "0"
}

function git(cwd: string, args: string[]): string {
    try {
        return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
            cwd,
            env: gitEnv,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        }).trim()
    } catch (error) {
        const err = error as {
            stderr?: Buffer | string
            stdout?: Buffer | string
            status?: number
        }
        const stderr = String(err.stderr ?? "")
        const stdout = String(err.stdout ?? "")
        throw new Error(
            `git ${args.join(" ")} failed (${err.status}): ${stderr || stdout}`
        )
    }
}

function refExists(cwd: string, ref: string): boolean {
    try {
        git(cwd, ["rev-parse", "--verify", "--quiet", ref])
        return true
    } catch {
        return false
    }
}

function tracked(cwd: string, rev: string, file: string): boolean {
    return refExists(cwd, `${rev}:${file}`)
}

function writeStarterTree(root: string) {
    mkdirSync(path.join(root, ".cursor/rules"), { recursive: true })
    mkdirSync(path.join(root, ".agents/skills/eject-and-follow"), {
        recursive: true
    })
    writeFileSync(
        path.join(root, ".cursor/rules/project-identity.mdc"),
        "starter identity\n"
    )
    writeFileSync(path.join(root, "AGENTS.md"), "# agents\n")
    writeFileSync(
        path.join(root, ".agents/skills/eject-and-follow/SKILL.md"),
        "# eject\n"
    )
}

function commitAll(cwd: string, message: string) {
    git(cwd, ["add", "-A"])
    git(cwd, ["commit", "-m", message])
}

function eject(cwd: string, kitRef: string) {
    git(cwd, ["checkout", "-B", "kit/main", kitRef])
    git(cwd, ["branch", "-f", "dev", "kit/main"])
    git(cwd, ["checkout", "-B", "main", "kit/main"])
    git(cwd, ["rm", ".cursor/rules/project-identity.mdc"])
    git(cwd, [
        "commit",
        "-m",
        "chore: drop starterkit project-identity rule after eject"
    ])
}

function assertEjected(cwd: string) {
    assert.equal(
        git(cwd, ["rev-parse", "dev"]),
        git(cwd, ["rev-parse", "kit/main"])
    )
    git(cwd, ["merge-base", "--is-ancestor", "dev", "main"])
    assert.equal(git(cwd, ["log", "--merges", "--oneline", "dev..main"]), "")
    assert.equal(git(cwd, ["log", "--oneline", "kit/main..dev"]), "")
    assert.deepEqual(
        git(cwd, ["diff", "--name-only", "dev", "main"])
            .split("\n")
            .filter(Boolean),
        [".cursor/rules/project-identity.mdc"]
    )
    assert.equal(
        tracked(cwd, "main", ".cursor/rules/project-identity.mdc"),
        false
    )
    assert.equal(
        tracked(cwd, "dev", ".cursor/rules/project-identity.mdc"),
        true
    )
    assert.equal(
        tracked(cwd, "kit/main", ".cursor/rules/project-identity.mdc"),
        true
    )
    assert.equal(tracked(cwd, "main", "AGENTS.md"), true)
    assert.equal(
        tracked(cwd, "main", ".agents/skills/eject-and-follow/SKILL.md"),
        true
    )
}

function ensureKitMain(cwd: string, kit: string) {
    if (!refExists(cwd, "refs/heads/kit/main")) {
        git(cwd, ["branch", "kit/main", kit])
        return
    }
    git(cwd, ["checkout", "kit/main"])
    git(cwd, ["merge", "--ff-only", kit])
}

function ensureDev(cwd: string) {
    if (refExists(cwd, "refs/heads/dev")) return
    if (refExists(cwd, "refs/remotes/origin/dev")) {
        git(cwd, ["branch", "dev", "origin/dev"])
        return
    }
    git(cwd, ["branch", "dev", "kit/main"])
}

function fastForwardDev(cwd: string) {
    git(cwd, ["checkout", "dev"])
    git(cwd, ["merge", "--ff-only", "kit/main"])
}

function fastForwardKit(cwd: string, kit: string) {
    git(cwd, ["checkout", "kit/main"])
    git(cwd, ["merge", "--ff-only", kit])
}

/** Fork bootstrap. `upstreamUrl` stands in for the starter remote so the test stays offline. */
function bootstrapFork(cwd: string, upstreamUrl: string) {
    const remotes = git(cwd, ["remote"]).split("\n").filter(Boolean)
    if (!remotes.includes("upstream")) {
        git(cwd, ["remote", "add", "upstream", upstreamUrl])
    }
    git(cwd, ["fetch", "upstream"])
    ensureKitMain(cwd, "upstream/main")
    ensureDev(cwd)
    fastForwardDev(cwd)
}

test("eject keeps agent follow docs and a fresh clone can suggest kit commits", () => {
    const root = mkdtempSync(path.join(tmpdir(), "eject-follow-"))
    try {
        const kit = path.join(root, "kit")
        const productBare = path.join(root, "product.git")
        const work = path.join(root, "work")
        const fresh = path.join(root, "fresh")

        git(root, ["init", "-b", "main", kit])
        writeStarterTree(kit)
        commitAll(kit, "starter")

        git(root, ["init", "--bare", "-b", "main", productBare])
        git(root, ["clone", kit, work])
        git(work, ["remote", "rename", "origin", "upstream"])
        git(work, ["remote", "add", "origin", productBare])
        git(work, ["fetch", "upstream"])
        eject(work, "upstream/main")
        assertEjected(work)

        git(work, ["push", "origin", "main"])
        git(work, ["push", "origin", "dev"])
        const heads = git(work, ["ls-remote", "--heads", "origin"])
        assert.equal(heads.includes("kit/main"), false)

        git(root, ["clone", productBare, fresh])
        assert.equal(refExists(fresh, "refs/heads/kit/main"), false)
        assert.equal(
            git(fresh, ["remote"]).split("\n").includes("upstream"),
            false
        )

        bootstrapFork(fresh, kit)
        assert.equal(
            git(fresh, ["rev-parse", "kit/main"]),
            git(fresh, ["rev-parse", "upstream/main"])
        )
        assert.equal(
            git(fresh, ["rev-parse", "dev"]),
            git(fresh, ["rev-parse", "kit/main"])
        )

        writeFileSync(path.join(kit, "kit-update.txt"), "from kit\n")
        commitAll(kit, "feat: kit update for follow")
        git(fresh, ["fetch", "upstream"])
        fastForwardKit(fresh, "upstream/main")
        fastForwardDev(fresh)

        const suggested = git(fresh, [
            "log",
            "--oneline",
            "--no-merges",
            "main..kit/main"
        ])
        assert.match(suggested, /feat: kit update for follow/)
        assert.equal(
            tracked(fresh, "main", ".cursor/rules/project-identity.mdc"),
            false
        )
        assert.equal(tracked(fresh, "main", "AGENTS.md"), true)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

test("in-place eject bootstraps kit/main from origin/dev without an upstream remote", () => {
    const root = mkdtempSync(path.join(tmpdir(), "eject-origin-dev-"))
    try {
        const repo = path.join(root, "repo")
        const bare = path.join(root, "origin.git")
        const fresh = path.join(root, "fresh")

        git(root, ["init", "-b", "main", repo])
        writeStarterTree(repo)
        commitAll(repo, "starter")
        eject(repo, "HEAD")
        assertEjected(repo)

        git(root, ["init", "--bare", "-b", "main", bare])
        git(repo, ["remote", "add", "origin", bare])
        git(repo, ["push", "origin", "main"])
        git(repo, ["push", "origin", "dev"])

        git(root, ["clone", bare, fresh])
        assert.equal(refExists(fresh, "refs/heads/kit/main"), false)
        assert.equal(
            git(fresh, ["remote"]).split("\n").includes("upstream"),
            false
        )

        git(fresh, ["fetch", "origin"])
        ensureKitMain(fresh, "origin/dev")
        ensureDev(fresh)
        fastForwardDev(fresh)
        assert.equal(
            git(fresh, ["rev-parse", "kit/main"]),
            git(fresh, ["rev-parse", "origin/dev"])
        )
        assert.equal(
            git(fresh, ["remote"]).split("\n").includes("upstream"),
            false
        )

        git(repo, ["checkout", "dev"])
        writeFileSync(path.join(repo, "starter-update.txt"), "starter\n")
        commitAll(repo, "fix: starter line update")
        git(repo, ["push", "origin", "dev"])

        git(fresh, ["fetch", "origin"])
        fastForwardKit(fresh, "origin/dev")
        fastForwardDev(fresh)
        const suggested = git(fresh, [
            "log",
            "--oneline",
            "--no-merges",
            "main..kit/main"
        ])
        assert.match(suggested, /fix: starter line update/)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})
