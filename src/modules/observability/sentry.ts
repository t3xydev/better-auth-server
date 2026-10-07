import * as Sentry from "@sentry/nextjs"

import { scrubSentryEvent } from "./scrub"

let serverReady = false
let edgeReady = false

export function sentryDsn() {
    return (
        process.env.SENTRY_DSN?.trim() ||
        process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
        ""
    )
}

function beforeSend(
    event: Parameters<NonNullable<Sentry.NodeOptions["beforeSend"]>>[0]
) {
    return scrubSentryEvent(event)
}

export function initSentryEdge() {
    if (edgeReady) return
    const dsn = sentryDsn()
    if (!dsn) return
    edgeReady = true
    Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
        release: process.env.SENTRY_RELEASE,
        enableOpenTelemetrySetup: false,
        beforeSend
    })
}

export function initSentryServer(otelActive: boolean) {
    if (serverReady) return
    const dsn = sentryDsn()
    if (!dsn) return
    serverReady = true
    Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
        release: process.env.SENTRY_RELEASE,
        enableOpenTelemetrySetup: false,
        integrations: (defaults) =>
            otelActive
                ? [...defaults, Sentry.openTelemetryIntegration()]
                : defaults,
        beforeSend
    })
}
