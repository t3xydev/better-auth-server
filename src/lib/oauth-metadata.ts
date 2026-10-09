const PUBLIC_CLIENT_AUTH_METHOD = "none"

export const discoveryCorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
} as const

export function discoveryOptionsResponse() {
    return new Response(null, {
        status: 204,
        headers: discoveryCorsHeaders
    })
}

function withDiscoveryCors(headers: Headers): Headers {
    const next = new Headers(headers)
    next.set("Access-Control-Allow-Origin", "*")
    next.set("Access-Control-Allow-Methods", "GET, OPTIONS")
    return next
}

export async function advertisePublicClientTokenAuth(
    response: Response
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
            headers: withDiscoveryCors(response.headers)
        }
    )
}
