const REDACTED = "[redacted]"

const EXACT_KEYS = new Set([
    "password",
    "newpassword",
    "currentpassword",
    "confirmpassword",
    "otp",
    "totp",
    "code",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "client_secret",
    "authorization",
    "cookie",
    "secret",
    "verificationcode",
    "backupcode",
    "backup_code"
])

export function isSensitiveKey(key: string) {
    const normalized = key.toLowerCase().replace(/-/g, "_")
    if (EXACT_KEYS.has(normalized)) return true
    return /password|secret|token|authorization|cookie|otp/.test(normalized)
}

export function scrubValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => scrubValue(entry))
    if (!value || typeof value !== "object") return value

    const record = value as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(record)) {
        next[key] = isSensitiveKey(key) ? REDACTED : scrubValue(entry)
    }
    return next
}

export function scrubProperties(
    properties: Record<string, unknown> | undefined
) {
    if (!properties) return undefined
    return scrubValue(properties) as Record<string, unknown>
}

/** Drop query strings on auth routes so codes and tokens are not recorded. */
export function scrubUrl(url: string) {
    try {
        const parsed = new URL(url, "http://localhost")
        const authPath =
            parsed.pathname.startsWith("/api/auth") ||
            parsed.pathname.startsWith("/oauth2")
        if (authPath) parsed.search = ""
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return `${parsed.origin}${parsed.pathname}${parsed.search}`
        }
        return `${parsed.pathname}${parsed.search}`
    } catch {
        return url.split("?")[0] || url
    }
}

export function scrubText(value: string) {
    return value
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/(\/api\/auth\S*?)\?\S*/g, "$1")
}

export function scrubError(error: unknown) {
    if (error instanceof Error) {
        const copy = new Error(scrubText(error.message))
        copy.name = error.name
        copy.stack = error.stack ? scrubText(error.stack) : undefined
        return copy
    }
    return new Error("request error")
}

type SentryLikeEvent = {
    request?: {
        url?: string
        query_string?: unknown
        cookies?: unknown
        data?: unknown
        headers?: Record<string, unknown>
    }
    extra?: Record<string, unknown>
}

export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
    const request = event.request
    if (request) {
        if (request.headers) {
            for (const key of Object.keys(request.headers)) {
                if (isSensitiveKey(key)) request.headers[key] = REDACTED
            }
        }
        delete request.cookies
        if (request.data && typeof request.data === "object") {
            request.data = scrubValue(request.data)
        }
        if (typeof request.url === "string") {
            const scrubbed = scrubUrl(request.url)
            if (scrubbed !== request.url) request.query_string = undefined
            request.url = scrubbed
        }
    }
    if (event.extra) {
        event.extra = scrubValue(event.extra) as Record<string, unknown>
    }
    return event
}
