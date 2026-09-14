import type { BetterAuthClientPlugin } from "better-auth/client"

import type { billing } from "./plugin"

export function billingClient() {
    return {
        id: "billing",
        $InferServerPlugin: {} as ReturnType<typeof billing>
    } satisfies BetterAuthClientPlugin
}
