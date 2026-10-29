"use client"

import { AuthUIContext, AuthView } from "@daveyplate/better-auth-ui"
import Link from "next/link"
import { useContext, useEffect, useState } from "react"

import { AuthFormValidationToast } from "@/components/auth-form-validation-toast"
import { NostrSignInButton } from "@/components/nostr-sign-in-button"
import { Passkey2faButton } from "@/components/passkey-2fa-button"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { inviteOnly } from "@/lib/invite-only"

export function SignInView({
    mode = "sign-in",
    search = ""
}: {
    mode?: "sign-in" | "sign-up"
    /** Current query, including the leading `?`, so OAuth and redirectTo survive. */
    search?: string
}) {
    const { localization } = useContext(AuthUIContext)
    const [hasNostr, setHasNostr] = useState(false)
    const [passkeyAvailable, setPasskeyAvailable] = useState(false)
    const signingUp = mode === "sign-up"

    useEffect(() => {
        if (typeof window === "undefined") return
        if (window.nostr) setHasNostr(true)

        // WebAuthn may still use a roaming security key or another device when
        // no platform authenticator is available.
        setPasskeyAvailable(Boolean(window.PublicKeyCredential))
    }, [])

    const header = (
        <>
            <CardTitle className="text-lg md:text-xl">
                {signingUp ? localization.SIGN_UP : localization.SIGN_IN}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
                {signingUp
                    ? "Enter your email below to create an account"
                    : localization.SIGN_IN_DESCRIPTION}
            </CardDescription>
        </>
    )
    const footer = (
        <div className="flex w-full flex-col gap-4">
            {passkeyAvailable || hasNostr ? (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Separator className="!w-auto grow" />
                        <span className="shrink-0 text-muted-foreground text-sm">
                            {localization.OR_CONTINUE_WITH}
                        </span>
                        <Separator className="!w-auto grow" />
                    </div>
                    {passkeyAvailable ? <Passkey2faButton /> : null}
                    {hasNostr ? <NostrSignInButton /> : null}
                </div>
            ) : null}
            <p className="text-center text-muted-foreground text-sm">
                {signingUp ? (
                    <>
                        {localization.ALREADY_HAVE_AN_ACCOUNT}{" "}
                        <Link
                            className="text-foreground underline"
                            href={`/auth${search}`}
                        >
                            {localization.SIGN_IN}
                        </Link>
                    </>
                ) : (
                    <>
                        {localization.DONT_HAVE_AN_ACCOUNT}{" "}
                        <Link
                            className="text-foreground underline"
                            href={`/auth/signup${search}`}
                        >
                            {localization.SIGN_UP}
                        </Link>
                    </>
                )}
            </p>
            {inviteOnly ? (
                <p className="text-center text-muted-foreground text-sm">
                    New accounts need an invite link.
                </p>
            ) : null}
        </div>
    )

    return (
        <AuthFormValidationToast>
            <AuthView path="sign-in" cardHeader={header} cardFooter={footer} />
        </AuthFormValidationToast>
    )
}
