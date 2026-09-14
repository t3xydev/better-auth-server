/**
 * Cloudflare Containers entry: proxies all HTTP traffic to the Next.js container.
 * Used when deployConfig.cloudflare.runtime === "containers".
 */

import { env } from "cloudflare:workers"
import { Container, getContainer } from "@cloudflare/containers"

function stringEnvVars(
    bindings: Record<string, unknown>
): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(bindings)) {
        if (typeof value === "string") out[key] = value
    }
    return out
}

export class AuthServerContainer extends Container {
    defaultPort = 3000
    sleepAfter = "10m"
    envVars = stringEnvVars(env as Record<string, unknown>)
}

export default {
    async fetch(
        request: Request,
        workerEnv: { AUTH_SERVER: DurableObjectNamespace }
    ): Promise<Response> {
        const container = getContainer(workerEnv.AUTH_SERVER, "main")
        return container.fetch(request)
    }
}
