"use client"

import { AuthForm, AuthUIContext } from "@daveyplate/better-auth-ui"
import { ArrowLeftIcon } from "lucide-react"
import { useContext, useEffect, useState } from "react"

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

export function ForgotPasswordView() {
    const { localization, navigate } = useContext(AuthUIContext)
    const [passkeyAvailable, setPasskeyAvailable] = useState(false)

    useEffect(() => {
        // WebAuthn may still use a roaming security key or another device when
        // no platform authenticator is available.
        setPasskeyAvailable(Boolean(window.PublicKeyCredential))
    }, [])

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle className="text-lg md:text-xl">
                    {localization.FORGOT_PASSWORD}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                    Sign in with an email code or a passkey, then set a new
                    password from account security.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
                <AuthForm
                    localization={{}}
                    view="EMAIL_OTP"
                    classNames={{
                        otpInputContainer: "w-full justify-center"
                    }}
                />
                {passkeyAvailable ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <Separator className="!w-auto grow" />
                            <span className="shrink-0 text-muted-foreground text-sm">
                                {localization.OR_CONTINUE_WITH}
                            </span>
                            <Separator className="!w-auto grow" />
                        </div>
                        <Passkey2faButton />
                    </div>
                ) : null}
            </CardContent>
            <CardFooter className="justify-center gap-1.5 text-muted-foreground text-sm">
                <ArrowLeftIcon className="size-3" />
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0 text-foreground underline"
                    onClick={() =>
                        navigate(`/auth/password${window.location.search}`)
                    }
                >
                    {localization.GO_BACK}
                </Button>
            </CardFooter>
        </Card>
    )
}
