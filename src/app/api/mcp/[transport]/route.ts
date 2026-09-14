import { createResourceServerChallenge } from "@better-auth/oauth-provider"
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"

import { serverClient } from "@/lib/server-client"

const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"
const resource = (process.env.OAUTH_AUDIENCE || baseUrl).replace(/\/$/, "")

function unauthorized(error: unknown) {
    const challenge = createResourceServerChallenge(error, resource)
    if (challenge && typeof challenge === "object" && "status" in challenge) {
        return new Response(
            JSON.stringify(challenge.body ?? { error: "invalid_token" }),
            {
                status: Number(challenge.status) || 401,
                headers: {
                    "Content-Type": "application/json",
                    ...(challenge.headers instanceof Headers
                        ? Object.fromEntries(challenge.headers.entries())
                        : {})
                }
            }
        )
    }
    return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="${resource}", resource_metadata="${resource}/.well-known/oauth-protected-resource"`
        }
    })
}

async function handler(req: Request) {
    let jwt: { sub?: string } | undefined
    try {
        jwt = await serverClient.verifyAccessTokenRequest(req, {
            jwksUrl: `${baseUrl}/api/auth/jwks`,
            verifyOptions: {
                issuer: baseUrl,
                audience: resource
            }
        })
    } catch (error) {
        return unauthorized(error)
    }

    return createMcpHandler(
        (server) => {
            server.registerTool(
                "echo",
                {
                    description: "Echo a message back to the caller",
                    inputSchema: {
                        message: z.string()
                    }
                },
                async ({ message }) => ({
                    content: [
                        {
                            type: "text" as const,
                            text: `Echo: ${message}${jwt?.sub ? ` (user: ${jwt.sub})` : ""}`
                        }
                    ]
                })
            )
        },
        {
            serverInfo: {
                name: process.env.APPLICATION_NAME || "better-auth-mcp",
                version: "1.0.0"
            }
        },
        {
            basePath: "/api/mcp",
            maxDuration: 60
        }
    )(req)
}

export { handler as GET, handler as POST, handler as DELETE }
