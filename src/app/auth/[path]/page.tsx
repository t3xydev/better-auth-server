import { authViewPaths } from "@daveyplate/better-auth-ui/server"
import { redirect } from "next/navigation"

import { AuthMain, authSearchString } from "@/components/auth-main"
import { legacyAuthRedirect } from "@/lib/oauth-resume"
import { preferredAuthViewPaths } from "@/modules/email-code-login"

export const dynamicParams = false

export function generateStaticParams() {
    const paths = new Set([
        ...Object.values({
            ...authViewPaths,
            ...preferredAuthViewPaths
        }),
        "signup"
    ])
    return [...paths].map((path) => ({ path }))
}

export default async function AuthPage({
    params,
    searchParams
}: {
    params: Promise<{ path: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const { path } = await params
    const search = await authSearchString(searchParams)
    const legacyPath = legacyAuthRedirect(`/auth/${path}`, search)
    if (legacyPath) redirect(legacyPath)

    return <AuthMain path={path} search={search} />
}
