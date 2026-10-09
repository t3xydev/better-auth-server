import { dbsc } from "@dbsc-toolkit/better-auth"
import type { BetterAuthPlugin } from "better-auth"

import { failOpenAfterHooks } from "./fail-open-hooks"

export function dbscPlugin() {
    return failOpenAfterHooks(dbsc() as BetterAuthPlugin, "dbsc")
}
