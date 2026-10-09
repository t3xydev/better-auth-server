import { corsAllowOrigin } from "@/lib/trusted-origins"

const PUBLIC_CLIENT_AUTH_METHOD = "none"

export function discoveryCorsHeaders(request: Request): Record<string, string> {
    const allowOrigin = corsAllowOrigin(request)
    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        Vary: "Origin"
    }
}

export function discoveryOptionsResponse(request: Request) {
    return new Response(null, {
        status: 204,
        headers: discoveryCorsHeaders(request)
    })
}

function withDiscoveryCors(headers: Headers, request: Request): Headers {
    const next = new Headers(headers)
    for (const [key, value] of Object.entries(discoveryCorsHeaders(request))) {
        next.set(key, value)
    }
    return next
}

export async function advertisePublicClientTokenAuth(
    response: Response,
    request: Request
): Promise<Response> {
    const metadata = (await response.json()) as Record<string, unknown>
    const configuredMethods = Array.isArray(
        metadata.token_endpoint_auth_methods_supported
    )
        ? metadata.token_endpoint_auth_methods_supported.filter(
              (method): method is string => typeof method === "string"
          )
        : []

    const tokenEndpointAuthMethods = [
        PUBLIC_CLIENT_AUTH_METHOD,
        ...configuredMethods.filter(
            (method) => method !== PUBLIC_CLIENT_AUTH_METHOD
        )
    ]

    return new Response(
        JSON.stringify({
            ...metadata,
            token_endpoint_auth_methods_supported: tokenEndpointAuthMethods
        }),
        {
            status: response.status,
            statusText: response.statusText,
            headers: withDiscoveryCors(response.headers, request)
        }
    )
}
