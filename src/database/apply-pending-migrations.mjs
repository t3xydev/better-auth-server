import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** Postgres advisory lock so concurrent Node boots do not apply the same SQL twice. */
const MIGRATE_LOCK_KEY = 85432101

let inFlight = null

export function migrateSkipReason(env = process.env) {
    if (env.SKIP_DB_MIGRATE === "1") return "SKIP_DB_MIGRATE=1"
    if (env.AUTH_GENERATE === "1") return "AUTH_GENERATE=1"
    if (env.NEXT_PHASE === "phase-production-build") return "next build"
    if (env.NEXT_RUNTIME === "edge") return "edge"
    return null
}

export function resolveMigrationsFolder(
    cwd = process.cwd(),
    moduleDir = dirname(fileURLToPath(import.meta.url))
) {
    const candidates = [
        join(cwd, "migrations"),
        join(moduleDir, "..", "..", "migrations")
    ]
    for (const dir of candidates) {
        if (existsSync(join(dir, "meta", "_journal.json"))) return dir
    }
    throw new Error(
        `[db:migrate] migrations folder not found (cwd=${cwd}). The SQL under migrations/ must ship with the process.`
    )
}

/**
 * Apply committed Drizzle SQL against DATABASE_URL.
 * Safe to call from `pnpm start`, `pnpm dev`, and Next.js instrumentation
 * (covers hosts that run `next start` without the pnpm script).
 */
export function applyPendingMigrations(env = process.env) {
    if (!inFlight) {
        inFlight = runApplyPendingMigrations(env).catch((error) => {
            inFlight = null
            throw error
        })
    }
    return inFlight
}

async function runApplyPendingMigrations(env) {
    const skipped = migrateSkipReason(env)
    if (skipped) {
        console.log(`[db:migrate] skipped (${skipped})`)
        return { skipped: true, reason: skipped }
    }

    const connectionString = env.DATABASE_URL
    if (!connectionString) {
        throw new Error(
            "[db:migrate] DATABASE_URL is required. Copy .env.example to .env and set it."
        )
    }

    const migrationsFolder = resolveMigrationsFolder()
    const { drizzle } = await import("drizzle-orm/node-postgres")
    const { migrate } = await import("drizzle-orm/node-postgres/migrator")
    const { Client } = await import("pg")

    const attempts = Number(env.DB_MIGRATE_ATTEMPTS || 30)
    const delayMs = Number(env.DB_MIGRATE_RETRY_MS || 2000)

    await waitForPostgres(Client, connectionString, attempts, delayMs)

    const client = new Client({ connectionString })
    await client.connect()
    try {
        await client.query("SELECT pg_advisory_lock($1)", [MIGRATE_LOCK_KEY])
        const db = drizzle(client)
        await migrate(db, { migrationsFolder })
        console.log("[db:migrate] up to date")
        return { skipped: false }
    } finally {
        await client
            .query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK_KEY])
            .catch(() => {})
        await client.end().catch(() => {})
    }
}

async function waitForPostgres(Client, connectionString, attempts, delayMs) {
    for (let i = 1; i <= attempts; i++) {
        const client = new Client({ connectionString })
        try {
            await client.connect()
            await client.end()
            return
        } catch (error) {
            await client.end().catch(() => {})
            if (i === attempts) throw error
            console.log(`[db:migrate] waiting for postgres (${i}/${attempts})`)
            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
    }
}
