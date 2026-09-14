import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

const appName = process.env.APPLICATION_NAME || "Better Auth Server"

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: appName
        },
        links: [
            {
                text: "Sign in",
                url: "/auth/sign-in",
                active: "nested-url"
            },
            {
                text: "GitHub",
                url: "https://github.com/t3xydev/better-auth-server",
                external: true
            }
        ]
    }
}
