import { AuthView } from "@daveyplate/better-auth-ui"
import { authViewPaths } from "@daveyplate/better-auth-ui/server"
import { count } from "drizzle-orm"
import { cookies } from "next/headers"
import Link from "next/link"

import { AuthFormValidationToast } from "@/components/auth-form-validation-toast"
import { InviteOnlySignUpView } from "@/components/invite-only-sign-up-view"
import { SignInView } from "@/components/sign-in-view"
import { TwoFactorView } from "@/components/two-factor-view"
import { db } from "@/database/db"
import { users } from "@/database/schema"
import { inviteOnly } from "@/lib/invite-only"
import {
    getInviteTokenFromCookies,
    isUsableInviteToken
} from "@/lib/invite-only-server"
import { preferredAuthViewPaths } from "@/modules/email-code-login"

export const dynamicParams = false

const appName = process.env.APPLICATION_NAME || "Better Auth Server"

export function generateStaticParams() {
    return Object.values({
        ...authViewPaths,
        ...preferredAuthViewPaths
    }).map((path) => ({ path }))
}

export default async function AuthPage({
    params
}: {
    params: Promise<{ path: string }>
}) {
    const { path } = await params

    if (inviteOnly && path === "sign-up") {
        const cookieStore = await cookies()
        const token = await getInviteTokenFromCookies(cookieStore)
        const hasValidInvite = token ? await isUsableInviteToken(token) : false
        let bootstrap = false
        if (!hasValidInvite) {
            const [row] = await db.select({ value: count() }).from(users)
            bootstrap = (row?.value ?? 0) === 0
        }

        return (
            <main className="container flex w-full grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
                <InviteOnlySignUpView
                    allowed={hasValidInvite || bootstrap}
                    appName={appName}
                />
                <p className="w-full max-w-sm text-center text-muted-foreground text-xs">
                    By continuing, you agree to our{" "}
                    <Link className="text-primary" href="/terms">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link className="text-primary" href="/privacy">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </main>
        )
    }

    return (
        <main className="container flex w-full grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
            {path === "two-factor" ? (
                <AuthFormValidationToast>
                    <TwoFactorView />
                </AuthFormValidationToast>
            ) : path === "sign-in" ? (
                <SignInView appName={appName} />
            ) : (
                <AuthFormValidationToast>
                    <AuthView path={path} />
                </AuthFormValidationToast>
            )}

            {!["callback", "sign-out"].includes(path) && (
                <p className="w-full max-w-sm text-center text-muted-foreground text-xs">
                    By continuing, you agree to our{" "}
                    <Link className="text-primary" href="/terms">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link className="text-primary" href="/privacy">
                        Privacy Policy
                    </Link>
                    .
                </p>
            )}
        </main>
    )
}
