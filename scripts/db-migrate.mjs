/**
 * CLI entry for `pnpm db:migrate`. Next.js also applies the same helper on
 * Node boot via `src/instrumentation.ts`, so `next start` cannot skip SQL.
 */
try {
    await import("dotenv/config")
} catch {
    // Production images may omit dotenv; DATABASE_URL comes from the environment.
}

const { applyPendingMigrations } = await import(
    "../src/database/apply-pending-migrations.mjs"
)

try {
    await applyPendingMigrations()
} catch (error) {
    console.error(error)
    process.exit(1)
}
process.exit(0)
