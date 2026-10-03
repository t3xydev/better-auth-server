const OAUTH_EVENTS: Record<string, string> = {
    "/oauth2/authorize": "oauth_authorize",
    "/oauth2/consent": "oauth_consent",
    "/oauth2/token": "oauth_token"
}

function isErrorCode(value: string) {
    return value.length > 0 && value.length <= 64 && !/\s/.test(value)
}

export function oauthEventName(path: string) {
    return OAUTH_EVENTS[path] ?? null
}

export function readClientId(body: unknown, query: unknown) {
    for (const source of [body, query]) {
        if (!source || typeof source !== "object") continue
        const record = source as Record<string, unknown>
        const value = record.client_id ?? record.clientId
        if (
            typeof value === "string" &&
            value.length > 0 &&
            value.length <= 256
        ) {
            return value
        }
    }
    return undefined
}

/** Short OAuth or HTTP error codes only. Token bodies are never copied. */
export function outcomeErrorCode(returned: unknown) {
    if (!returned || typeof returned !== "object") return undefined
    const record = returned as Record<string, unknown>
    if (typeof record.error === "string" && isErrorCode(record.error)) {
        return record.error
    }
    const statusCode = record.statusCode ?? record.status
    if (typeof statusCode === "number" && statusCode >= 400) {
        return String(statusCode)
    }
    if (
        typeof record.status === "string" &&
        isErrorCode(record.status) &&
        record.status.toUpperCase() !== "OK"
    ) {
        return record.status
    }
    return undefined
}

export type OAuthOutcomeInput = {
    path: string
    body: unknown
    query: unknown
    returned: unknown
    userId: string | null
}

export function oauthOutcomeProperties(input: OAuthOutcomeInput) {
    const event = oauthEventName(input.path)
    if (!event) return null
    const clientId = readClientId(input.body, input.query)
    const distinctId = input.userId || (clientId ? `client:${clientId}` : null)
    if (!distinctId) return null
    const error = outcomeErrorCode(input.returned)
    return {
        event,
        distinctId,
        properties: {
            ...(clientId ? { client_id: clientId } : {}),
            ...(input.userId ? { user_id: input.userId } : {}),
            success: !error,
            ...(error ? { error } : {})
        }
    }
}
