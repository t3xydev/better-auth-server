"use client"

import { AuthUIContext } from "@daveyplate/better-auth-ui"
import { FingerprintIcon } from "lucide-react"
import { useContext, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { followOAuthContinue } from "@/lib/oauth-resume"
import { Button } from "./ui/button"

export function Passkey2faButton() {
    const { localization, navigate, redirectTo } = useContext(AuthUIContext)
    const [isPending, setIsPending] = useState(false)

    async function verify() {
        setIsPending(true)

        try {
            const response = await authClient.signIn.passkey()

            if (response.error) {
                toast.error(
                    response.error.message || "Passkey verification failed"
                )
                return
            }

            if (followOAuthContinue(response.data)) return

            navigate(redirectTo)
        } catch {
            toast.error("Passkey verification failed")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={verify}
        >
            <FingerprintIcon />
            {localization.SIGN_IN_WITH} {localization.PASSKEY}
        </Button>
    )
}
