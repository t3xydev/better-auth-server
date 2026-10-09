import { withSentryConfig } from "@sentry/nextjs/config"
import { createMDX } from "fumadocs-mdx/next"

import { posthogRewrites } from "./src/modules/observability/posthog-hosts.mjs"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
    images: {
        remotePatterns: [{ protocol: "https", hostname: "**" }]
    },
    transpilePackages: ["dbsc-toolkit", "@dbsc-toolkit/better-auth"],
    skipTrailingSlashRedirect: true,
    // Serverless / `next start` hosts must ship the SQL next to the process.
    outputFileTracingIncludes: {
        "/*": ["./migrations/**"]
    },
    serverExternalPackages: [
        "posthog-node",
        "@opentelemetry/sdk-trace-node",
        "@opentelemetry/sdk-trace-base",
        "@opentelemetry/exporter-trace-otlp-http",
        "@opentelemetry/instrumentation",
        "@opentelemetry/instrumentation-http",
        "@opentelemetry/instrumentation-undici",
        "@opentelemetry/instrumentation-pg",
        "@opentelemetry/resources"
    ],
    async rewrites() {
        return posthogRewrites(process.env.NEXT_PUBLIC_POSTHOG_HOST)
    }
}

export default withSentryConfig(withMDX(config), {
    silent: true,
    telemetry: false,
    buildTimeInstrumentation: false,
    sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN
    }
})
