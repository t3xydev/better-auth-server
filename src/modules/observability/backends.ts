export type OtelEnv = Record<string, string | undefined>

export type OtelBackendConfig = {
    endpoint: string
    headers: Record<string, string>
    resourceAttributes: Record<string, string>
}

function trimSlash(value: string) {
    return value.replace(/\/+$/, "")
}

/** OTLP HTTP trace URLs are the full `/v1/traces` path. */
export function tracesUrl(raw: string | undefined) {
    const value = raw?.trim()
    if (!value) return null
    const base = trimSlash(value)
    if (base.endsWith("/v1/traces")) return base
    return `${base}/v1/traces`
}

/** `OTEL_EXPORTER_OTLP_HEADERS` is a comma-separated list of `key=value` pairs. */
export function parseOtelHeaders(header: string | undefined) {
    if (!header?.trim()) return {}
    const headers: Record<string, string> = {}
    for (const part of header.split(",")) {
        const eq = part.indexOf("=")
        if (eq <= 0) continue
        const key = part.slice(0, eq).trim()
        if (!key) continue
        const rawValue = part.slice(eq + 1).trim()
        try {
            headers[key] = decodeURIComponent(rawValue)
        } catch {
            headers[key] = rawValue
        }
    }
    return headers
}

export function traceSampleRate(env: OtelEnv) {
    const raw = env.OTEL_TRACES_SAMPLE_RATE?.trim()
    if (raw) {
        const value = Number(raw)
        if (Number.isFinite(value)) return Math.min(1, Math.max(0, value))
    }
    return env.NODE_ENV === "production" ? 0.1 : 1
}

function serviceAttributes(env: OtelEnv) {
    const attributes: Record<string, string> = {}
    const version = env.OTEL_SERVICE_VERSION?.trim()
    if (version) attributes["service.version"] = version
    return attributes
}

function gitlabBackend(env: OtelEnv): OtelBackendConfig | null {
    const projectId = env.GITLAB_PROJECT_ID?.trim()
    const token = env.GITLAB_OBSERVABILITY_TOKEN?.trim()
    const override = tracesUrl(env.GITLAB_OTEL_ENDPOINT)
    const host = trimSlash(env.GITLAB_HOST?.trim() || "https://gitlab.com")
    const endpoint =
        override ||
        (projectId
            ? `${host}/api/v4/projects/${encodeURIComponent(projectId)}/observability/v1/traces`
            : null)
    if (!endpoint || !token) return null
    const resourceAttributes = serviceAttributes(env)
    if (projectId) resourceAttributes["gitlab.project.id"] = projectId
    return {
        endpoint,
        headers: { "PRIVATE-TOKEN": token },
        resourceAttributes
    }
}

function signozBackend(env: OtelEnv): OtelBackendConfig | null {
    const endpoint = tracesUrl(env.SIGNOZ_INGEST_URL)
    if (!endpoint) return null
    const key = env.SIGNOZ_INGESTION_KEY?.trim()
    return {
        endpoint,
        headers: key ? { "signoz-ingestion-key": key } : {},
        resourceAttributes: serviceAttributes(env)
    }
}

function otlpBackend(env: OtelEnv): OtelBackendConfig | null {
    const endpoint = tracesUrl(env.OTEL_EXPORTER_OTLP_ENDPOINT)
    if (!endpoint) return null
    return {
        endpoint,
        headers: parseOtelHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
        resourceAttributes: serviceAttributes(env)
    }
}

/**
 * `OTEL_BACKEND` selects where traces go.
 * Unset or `off` disables tracing. Missing credentials also disable it.
 */
export function resolveOtelBackend(env: OtelEnv): OtelBackendConfig | null {
    const backend = (env.OTEL_BACKEND ?? "").trim().toLowerCase()
    if (!backend || backend === "off") return null
    if (backend === "gitlab") return gitlabBackend(env)
    if (backend === "signoz") return signozBackend(env)
    if (backend === "otlp") return otlpBackend(env)
    return null
}
