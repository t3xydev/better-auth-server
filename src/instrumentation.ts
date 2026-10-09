export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { applyPendingMigrations } = await import(
            "@/database/apply-pending-migrations.mjs"
        )
        await applyPendingMigrations()

        const { registerNodeObservability } = await import(
            "@/modules/observability/register-node"
        )
        registerNodeObservability()
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        const { initSentryEdge } = await import(
            "@/modules/observability/sentry"
        )
        initSentryEdge()
    }
}

export async function onRequestError(
    error: unknown,
    request: {
        path: string
        method: string
        headers: Record<string, string | string[] | undefined>
    },
    context: {
        routerKind: string
        routePath: string
        routeType: string
    }
) {
    const { captureRequestErrors } = await import("@/modules/observability")
    await captureRequestErrors(error, request, context)
}
