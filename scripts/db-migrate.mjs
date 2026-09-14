/**
 * Apply committed Drizzle SQL (migrations/) against DATABASE_URL.
 * Retries while Postgres is still coming up so `pnpm dev` / `pnpm start` can
 * migrate without a separate step.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

try {
    await import("dotenv/config")
} catch {
    // Production images may omit dotenv; DATABASE_URL comes from the environment.
}

if (process.env.SKIP_DB_MIGRATE === "1") {
    console.log("[db:migrate] skipped (SKIP_DB_MIGRATE=1)")
    process.exit(0)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    console.error(
        "[db:migrate] DATABASE_URL is required. Copy .env.example to .env and set it."
    )
    process.exit(1)
}

const { drizzle } = await import("drizzle-orm/node-postgres")
const { migrate } = await import("drizzle-orm/node-postgres/migrator")
const { Client } = await import("pg")

const migrationsFolder = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "migrations"
)

const attempts = Number(process.env.DB_MIGRATE_ATTEMPTS || 30)
const delayMs = Number(process.env.DB_MIGRATE_RETRY_MS || 2000)

async function waitForPostgres() {
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

await waitForPostgres()
const db = drizzle(connectionString)
await migrate(db, { migrationsFolder })
console.log("[db:migrate] up to date")
process.exit(0)
