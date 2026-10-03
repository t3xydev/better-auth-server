import { capturePostHogRequestError } from "./posthog-server"

export { resolveOtelBackend, traceSampleRate } from "./backends"
export { captureOAuthOutcome } from "./oauth-capture"
export { oauthOutcomeProperties } from "./oauth-events"
export { distinctIdFromCookie } from "./posthog-identity"
export {
    captureServerEvent,
    getPostHogServer,
    isFeatureEnabled
} from "./posthog-server"

export async function captureRequestErrors(
    error: unknown,
    request: {
        path: string
        method: string
        headers: Record<string, string | string[] | undefined>
    },
    context: {
        routerKind: string
        routePath: string
        routeType: string
    }
) {
    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
        const Sentry = await import("@sentry/nextjs")
        Sentry.captureRequestError(error, request, context)
    }
    await capturePostHogRequestError(error, request.headers)
}
