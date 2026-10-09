import type { BetterAuthPlugin } from "better-auth"

type AfterHook = NonNullable<
    NonNullable<BetterAuthPlugin["hooks"]>["after"]
>[number]

/**
 * Email/password and email-OTP return `{ token }`, which triggers DBSC's
 * after-hook. Passkey verify returns `{ session, user }` and skips it. If
 * `dbsc_sessions` is missing or the adapter throws, that hook 500s every
 * token-returning sign-in while passkeys keep working.
 */
export function failOpenAfterHooks(
    plugin: BetterAuthPlugin,
    label: string
): BetterAuthPlugin {
    const after = plugin.hooks?.after
    if (!after?.length) return plugin

    return {
        ...plugin,
        hooks: {
            ...plugin.hooks,
            after: after.map((hook) => failOpenHook(hook, label))
        }
    }
}

function failOpenHook(hook: AfterHook, label: string): AfterHook {
    const inner = hook.handler
    return {
        ...hook,
        handler: (async (ctx: never) => {
            try {
                return await (
                    inner as (ctx: never) => ReturnType<typeof inner>
                )(ctx)
            } catch (error) {
                console.error(`[${label}] after-hook failed:`, error)
            }
        }) as AfterHook["handler"]
    }
}
