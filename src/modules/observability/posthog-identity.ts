/** Read the browser distinct id PostHog stores in its project cookie. */
export function distinctIdFromCookie(cookie: string | string[] | undefined) {
    if (!cookie) return null
    const raw = Array.isArray(cookie) ? cookie.join("; ") : cookie
    const match = raw.match(/(?:^|;\s*)ph_[^=;]+_posthog=([^;]+)/)
    if (!match?.[1]) return null
    try {
        const parsed = JSON.parse(decodeURIComponent(match[1])) as {
            distinct_id?: unknown
        }
        return typeof parsed.distinct_id === "string" && parsed.distinct_id
            ? parsed.distinct_id
            : null
    } catch {
        return null
    }
}
