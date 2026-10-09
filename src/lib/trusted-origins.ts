export type OriginEnv = Record<string, string | undefined>

const DEFAULT_AUTH_ORIGIN = "http://localhost:3000"

export function authBaseOrigin(env: OriginEnv = process.env): string {
    return (env.BETTER_AUTH_URL || DEFAULT_AUTH_ORIGIN).replace(/\/$/, "")
}

export function trustedOrigins(env: OriginEnv = process.env): string[] {
    const extras = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter((origin) => origin && origin !== "*")

    return [...new Set([authBaseOrigin(env), ...extras])]
}

export function isTrustedOrigin(
    origin: string,
    env: OriginEnv = process.env
): boolean {
    const candidate = origin.trim().replace(/\/$/, "")
    if (!candidate) return false
    return trustedOrigins(env).some((pattern) =>
        originMatchesPattern(candidate, pattern)
    )
}

export function corsAllowOrigin(
    request: Request,
    env: OriginEnv = process.env
): string {
    const origin = request.headers.get("origin")
    if (origin && isTrustedOrigin(origin, env)) return origin
    return "*"
}

export function originMatchesPattern(origin: string, pattern: string): boolean {
    if (pattern === "*") return true
    if (origin === pattern) return true
    if (pattern.endsWith("://") && origin.startsWith(pattern)) return true
    if (!pattern.includes("*")) return false

    try {
        const originUrl = new URL(origin)

        if (pattern.startsWith("*.") && !pattern.includes("://")) {
            const suffix = pattern.slice(1).toLowerCase()
            return originUrl.hostname.toLowerCase().endsWith(suffix)
        }

        const protocolWildcard = /^([a-z][a-z0-9+.-]*):\/\/\*\.(.+)$/i.exec(
            pattern
        )
        if (protocolWildcard) {
            const [, protocol, domain] = protocolWildcard
            return (
                originUrl.protocol === `${protocol.toLowerCase()}:` &&
                (originUrl.hostname.toLowerCase() === domain.toLowerCase() ||
                    originUrl.hostname
                        .toLowerCase()
                        .endsWith(`.${domain.toLowerCase()}`))
            )
        }
    } catch {
        // Fall through to glob matching for custom schemes.
    }

    return globToRegExp(pattern).test(origin)
}

function globToRegExp(pattern: string): RegExp {
    let output = "^"
    for (let index = 0; index < pattern.length; index++) {
        if (pattern.startsWith("**", index)) {
            output += ".*"
            index += 1
            continue
        }
        const character = pattern[index]
        if (character === "*") {
            output += "[^/]*"
            continue
        }
        output += character.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    }
    return new RegExp(`${output}$`, "i")
}
