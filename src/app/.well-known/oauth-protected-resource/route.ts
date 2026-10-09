import {
    discoveryCorsHeaders,
    discoveryOptionsResponse
} from "@/lib/oauth-metadata"
import { serverClient } from "@/lib/server-client"

export const OPTIONS = discoveryOptionsResponse

export const GET = async (request: Request) => {
    const metadata = await serverClient.getProtectedResourceMetadata({
        resource: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        authorization_servers: [
            process.env.BETTER_AUTH_URL || "http://localhost:3000"
        ]
    })

    return new Response(JSON.stringify(metadata), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control":
                "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400",
            ...discoveryCorsHeaders(request)
        }
    })
}
