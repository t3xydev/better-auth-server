import type { BetterAuthClientPlugin } from "better-auth/client"

import type { segments } from "./plugin"

export function segmentsClient() {
    return {
        id: "segments",
        $InferServerPlugin: {} as ReturnType<typeof segments>
    } satisfies BetterAuthClientPlugin
}
