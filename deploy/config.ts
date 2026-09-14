/**
 * Single source of truth for deployment targets.
 * Edit this file, then run `pnpm deploy:sync` to regenerate platform configs.
 */

export type CloudflareRuntime = "containers" | "workers"

/** Cloudflare Containers instance size. Default omitted by Wrangler is `lite` (256 MiB). */
export type CloudflareInstanceType =
    | "lite"
    | "basic"
    | "standard-1"
    | "standard-2"
    | "standard-3"
    | "standard-4"

export const deployConfig = {
    /** Service / image name used across platforms */
    name: "better-auth-server",

    /** App listen port */
    port: 3000,

    /**
     * Deploy / liveness probe path. Must return 2xx when the process is up
     * (Railway fails the deploy on non-2xx). Use `?ready=1` for DB readiness.
     */
    healthcheckPath: "/api/health",

    /** Seconds Railway waits for a 2xx from healthcheckPath */
    healthcheckTimeout: 300,

    /** Image build (no database required) */
    buildCommand: "pnpm build",

    /** Apply committed Drizzle migrations (`scripts/db-migrate.mjs`) */
    migrateCommand: "pnpm db:migrate",

    /**
     * Process start. `pnpm start` already migrates, then serves Next.js.
     * DATABASE_URL is needed when the process starts, not when the image builds.
     */
    startCommand: "pnpm start",

    /** Container entrypoint — same as start (migrate is inside `pnpm start`). */
    get containerStartCommand() {
        return this.startCommand
    },

    /** Required production env vars */
    requiredEnv: [
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL"
    ] as const,

    /**
     * Railway Infrastructure as Code (`.railway/railway.ts`).
     * `railway.toml` Config as Code is deprecated (cutoff 2026-12-01).
     */
    railway: {
        /** Canvas / IaC project name */
        projectName: "BetterAuth Server",
        /** App service name on the Railway canvas */
        serviceName: "Better-Auth Server",
        /** GitHub `owner/repo` for the app service source */
        githubRepo: "t3xydev/better-auth-server",
        /** Branch Railway deploys from */
        branch: "main",
        /** Postgres service name on the canvas */
        postgresName: "Postgres",
        /** Redis service name on the canvas */
        redisName: "Redis",
        /** Region for managed DB volumes / replicas */
        region: "us-east4-eqdc4a"
    },

    cloudflare: {
        /**
         * `containers` (default) — shared Dockerfile via Cloudflare Containers.
         * `workers` — OpenNext on Workers; needs @opennextjs/cloudflare + Hyperdrive.
         */
        runtime: "containers" as CloudflareRuntime,

        /** Worker entry for Containers mode */
        containerWorker: "deploy/cloudflare/container-worker.ts",

        /** Durable Object / Container class name */
        containerClassName: "AuthServerContainer",

        /**
         * Container memory/CPU/disk. Wrangler defaults to `lite` (256 MiB),
         * which is too small for this Next.js image.
         */
        instanceType: "basic" as CloudflareInstanceType
    },

    dokploy: {
        /**
         * Replace with your public hostname before deploying Compose to Dokploy.
         * Used in Traefik Host() rules.
         */
        domain: "auth.example.com",

        /** Traefik router/service name prefix (must be unique on the host) */
        routerName: "better-auth-server"
    }
} as const

export type DeployConfig = typeof deployConfig
