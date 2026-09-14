"use client"

import { AuthView } from "@daveyplate/better-auth-ui"
import Link from "next/link"
import { Suspense, useEffect, useState } from "react"

import { Passkey2faButton } from "@/components/passkey-2fa-button"
import { TotpSetupKey } from "@/components/totp-setup-key"

export function TwoFactorView() {
    const [passkeyAvailable, setPasskeyAvailable] = useState(false)

    useEffect(() => {
        if (!window.PublicKeyCredential) return

        void fetch("/api/auth/passkey/two-factor-available", {
            credentials: "include"
        })
            .then(async (response) => {
                if (!response.ok) return false
                const data = (await response.json()) as { available?: boolean }
                return data.available === true
            })
            .then(setPasskeyAvailable)
            .catch(() => setPasskeyAvailable(false))
    }, [])

    return (
        <AuthView
            path="two-factor"
            classNames={{
                form: {
                    forgotPasswordLink: "hidden",
                    secondaryButton: "hidden",
                    qrCode: "mx-auto block",
                    primaryButton: "w-full",
                    otpInputContainer: "w-full justify-center"
                },
                footerLink: "inline-flex items-center gap-1.5"
            }}
            cardFooter={
                <div className="flex w-full flex-col items-center gap-2">
                    {passkeyAvailable ? <Passkey2faButton /> : null}
                    <Suspense>
                        <TotpSetupKey />
                    </Suspense>
                    <Link
                        className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                        href="/auth/recover-account"
                    >
                        Lost access to your authenticator?
                    </Link>
                </div>
            }
        />
    )
}
