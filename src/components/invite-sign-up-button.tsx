"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

/** Sets the better-invite cookie, then sends the user to sign in. */
export function InviteSignUpButton({ token }: { token: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const signInPath = `/auth?redirectTo=${encodeURIComponent(`/invite/activate/${token}`)}`

    async function prepareSignIn() {
        setLoading(true)
        setError(null)

        const { error: activateError } = await authClient.invite.activate({
            token,
            callbackURL: "/auth"
        })

        if (activateError) {
            setError(
                activateError.message ?? "Failed to prepare invite for sign-in."
            )
            setLoading(false)
            return
        }

        router.push(signInPath)
    }

    return (
        <div className="w-full space-y-2">
            <Button
                className="w-full"
                disabled={loading}
                onClick={prepareSignIn}
            >
                {loading ? "Preparing…" : "Continue to sign in"}
            </Button>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
    )
}
