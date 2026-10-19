import "server-only"

import type { StudioConfig } from "better-auth-studio"

import { auth } from "@/lib/auth"

const config: StudioConfig = {
    auth,
    basePath: "/api/studio",
    access: {
        roles: ["admin"]
    },
    metadata: {
        title: "Better Auth Server Studio",
        theme: "dark"
    }
}

export default config
