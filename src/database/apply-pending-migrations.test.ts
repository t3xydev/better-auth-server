import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import {
    migrateSkipReason,
    resolveMigrationsFolder
} from "./apply-pending-migrations.mjs"

test("migrateSkipReason covers generate, edge, build, and explicit skip", () => {
    assert.equal(migrateSkipReason({}), null)
    assert.equal(
        migrateSkipReason({ SKIP_DB_MIGRATE: "1" }),
        "SKIP_DB_MIGRATE=1"
    )
    assert.equal(migrateSkipReason({ AUTH_GENERATE: "1" }), "AUTH_GENERATE=1")
    assert.equal(
        migrateSkipReason({ NEXT_PHASE: "phase-production-build" }),
        "next build"
    )
    assert.equal(migrateSkipReason({ NEXT_RUNTIME: "edge" }), "edge")
})

test("resolveMigrationsFolder finds the committed journal", () => {
    const folder = resolveMigrationsFolder()
    assert.equal(existsSync(join(folder, "meta", "_journal.json")), true)
    assert.equal(existsSync(join(folder, "0009_married_champions.sql")), true)
})
