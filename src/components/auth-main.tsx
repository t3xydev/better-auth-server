import { AuthView } from "@daveyplate/better-auth-ui"
import Link from "next/link"

import { AuthFormValidationToast } from "@/components/auth-form-validation-toast"
import { ForgotPasswordView } from "@/components/forgot-password-view"
import { SignInView } from "@/components/sign-in-view"
import { TwoFactorView } from "@/components/two-factor-view"

export function AuthMain({
    path,
    search = ""
}: {
    /** `sign-in` is `/auth`. `signup` is `/auth/signup`. Other values are Auth UI paths. */
    path: string
    search?: string
}) {
    const account =
        path === "sign-in" || path === "signup" ? (
            <SignInView
                mode={path === "signup" ? "sign-up" : "sign-in"}
                search={search}
            />
        ) : null

    return (
        <main className="container flex w-full grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
            {path === "two-factor" ? (
                <AuthFormValidationToast>
                    <TwoFactorView />
                </AuthFormValidationToast>
            ) : account ? (
                account
            ) : path === "forgot-password" ? (
                <AuthFormValidationToast>
                    <ForgotPasswordView />
                </AuthFormValidationToast>
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

export async function authSearchString(
    searchParams: Promise<Record<string, string | string[] | undefined>>
) {
    const search = await searchParams
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
        if (typeof value === "string") params.append(key, value)
        else if (Array.isArray(value)) {
            for (const item of value) params.append(key, item)
        }
    }
    const query = params.toString()
    return query ? `?${query}` : ""
}
