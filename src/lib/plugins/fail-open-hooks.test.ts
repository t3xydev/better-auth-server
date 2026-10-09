import assert from "node:assert/strict"
import { test } from "node:test"

import type { BetterAuthPlugin } from "better-auth"

import { failOpenAfterHooks } from "./fail-open-hooks"

test("failOpenAfterHooks swallows after-hook throws so sign-in can succeed", async () => {
    const plugin: BetterAuthPlugin = {
        id: "test",
        hooks: {
            after: [
                {
                    matcher: () => true,
                    handler: async () => {
                        throw new Error("dbsc_sessions missing")
                    }
                }
            ]
        }
    }

    const wrapped = failOpenAfterHooks(plugin, "dbsc")
    const hook = wrapped.hooks?.after?.[0]
    assert.ok(hook)
    await assert.doesNotReject(() => hook.handler({} as never))
})

test("failOpenAfterHooks still returns a successful after-hook result", async () => {
    const plugin: BetterAuthPlugin = {
        id: "test",
        hooks: {
            after: [
                {
                    matcher: () => true,
                    handler: async () => ({ ok: true })
                }
            ]
        }
    }

    const wrapped = failOpenAfterHooks(plugin, "dbsc")
    const hook = wrapped.hooks?.after?.[0]
    assert.ok(hook)
    assert.deepEqual(await hook.handler({} as never), { ok: true })
})
