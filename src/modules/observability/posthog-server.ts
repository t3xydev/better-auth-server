import { PostHog } from "posthog-node"

import { distinctIdFromCookie } from "./posthog-identity"
import { scrubError, scrubProperties } from "./scrub"

let client: PostHog | null | undefined

export function posthogServerHost() {
    return (
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
        "https://us.i.posthog.com"
    )
}

export function getPostHogServer() {
    if (client !== undefined) return client
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
    if (!key) {
        client = null
        return null
    }
    client = new PostHog(key, {
        host: posthogServerHost(),
        flushAt: 1,
        flushInterval: 0
    })
    return client
}

export async function captureServerEvent(
    event: string,
    distinctId: string,
    properties?: Record<string, unknown>
) {
    const posthog = getPostHogServer()
    if (!posthog) return
    try {
        posthog.capture({
            distinctId,
            event,
            properties: scrubProperties(properties)
        })
        await posthog.flush()
    } catch {
        // Analytics must not change auth responses.
    }
}

export async function isFeatureEnabled(flag: string, distinctId: string) {
    const posthog = getPostHogServer()
    if (!posthog) return false
    try {
        return (await posthog.isFeatureEnabled(flag, distinctId)) === true
    } catch {
        return false
    }
}

export async function capturePostHogRequestError(
    error: unknown,
    headers: { cookie?: string | string[] } | undefined
) {
    const posthog = getPostHogServer()
    if (!posthog) return
    try {
        const distinctId = distinctIdFromCookie(headers?.cookie) ?? undefined
        await posthog.captureExceptionImmediate(scrubError(error), distinctId)
    } catch {
        // Analytics must not change the error response.
    }
}
