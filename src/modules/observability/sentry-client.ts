import * as Sentry from "@sentry/nextjs"

import { scrubSentryEvent } from "./scrub"

let clientReady = false

function beforeSend(
    event: Parameters<NonNullable<Sentry.BrowserOptions["beforeSend"]>>[0]
) {
    return scrubSentryEvent(event)
}

export function initSentryClient() {
    if (clientReady) return
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
    if (!dsn) return
    clientReady = true
    Sentry.init({
        dsn,
        environment:
            process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
        beforeSend
    })
}
