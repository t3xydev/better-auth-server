const DEFAULT_API_HOST = "https://us.i.posthog.com"

export function posthogApiHost(apiHost) {
    const host = (apiHost || DEFAULT_API_HOST).trim().replace(/\/+$/, "")
    return host || DEFAULT_API_HOST
}

export function posthogAssetHost(apiHost) {
    const host = posthogApiHost(apiHost)
    if (host.includes("eu.i.posthog.com") || host.includes("eu.posthog.com")) {
        return "https://eu-assets.i.posthog.com"
    }
    return "https://us-assets.i.posthog.com"
}

/** Next.js rewrites for the `/ingest` reverse proxy. Static and array rules must come first. */
export function posthogRewrites(apiHost) {
    const assets = posthogAssetHost(apiHost)
    const api = posthogApiHost(apiHost)
    return [
        {
            source: "/ingest/static/:path*",
            destination: `${assets}/static/:path*`
        },
        {
            source: "/ingest/array/:path*",
            destination: `${assets}/array/:path*`
        },
        {
            source: "/ingest/:path*",
            destination: `${api}/:path*`
        }
    ]
}
