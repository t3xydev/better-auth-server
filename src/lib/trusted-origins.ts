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
