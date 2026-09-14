"use client"

import { AuthForm, AuthUIContext, AuthView } from "@daveyplate/better-auth-ui"
import { useContext, useEffect, useState } from "react"

import { AuthFormValidationToast } from "@/components/auth-form-validation-toast"
import { NostrSignInButton } from "@/components/nostr-sign-in-button"
import { Passkey2faButton } from "@/components/passkey-2fa-button"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { inviteOnly } from "@/lib/invite-only"

export function SignInView({ appName }: { appName?: string }) {
    const { localization, navigate } = useContext(AuthUIContext)
    const [hasNostr, setHasNostr] = useState(false)
    const [passkeyAvailable, setPasskeyAvailable] = useState(false)
    const brand = appName || "Better Auth Server"

    useEffect(() => {
        if (typeof window === "undefined") return
        if (window.nostr) setHasNostr(true)

        // WebAuthn may still use a roaming security key or another device when
        // no platform authenticator is available.
        setPasskeyAvailable(Boolean(window.PublicKeyCredential))
    }, [])

    if (inviteOnly) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <p className="font-medium text-muted-foreground text-sm">
                        {brand}
                    </p>
                    <CardTitle>{localization.SIGN_IN}</CardTitle>
                    <CardDescription>
                        {localization.SIGN_IN_DESCRIPTION}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AuthFormValidationToast>
                        <AuthForm
                            localization={{}}
                            view="EMAIL_OTP"
                            classNames={{
                                otpInputContainer: "w-full justify-center"
                            }}
                        />
                    </AuthFormValidationToast>
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() =>
                            navigate(`/auth/password${window.location.search}`)
                        }
                    >
                        Sign in with Password
                    </Button>
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
                </CardContent>
                <CardFooter className="justify-center">
                    <p className="text-center text-muted-foreground text-sm">
                        Have an invite? Use the link or code to sign up.
                    </p>
                </CardFooter>
            </Card>
        )
    }

    const footer =
        passkeyAvailable || hasNostr ? (
            <div className="flex w-full flex-col gap-4">
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
        ) : undefined
    const header = (
        <>
            <CardTitle className="text-lg md:text-xl">
                {localization.SIGN_IN}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
                {localization.SIGN_IN_DESCRIPTION}
            </CardDescription>
        </>
    )

    return (
        <AuthFormValidationToast>
            <AuthView path="sign-in" cardHeader={header} cardFooter={footer} />
        </AuthFormValidationToast>
    )
}
