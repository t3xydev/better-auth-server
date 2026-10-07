"use client"

import { AuthUIContext } from "@daveyplate/better-auth-ui"
import { ZapIcon } from "lucide-react"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "./ui/button"

export function NostrSignInButton() {
    const { navigate, redirectTo } = useContext(AuthUIContext)
    const [isPending, setIsPending] = useState(false)
    const [hasExtension, setHasExtension] = useState(false)

    useEffect(() => {
        if (typeof window !== "undefined" && window.nostr) {
            setHasExtension(true)
        }
    }, [])

    async function signIn() {
        setIsPending(true)

        try {
            const result = await authClient.signIn.nostr()

            if (result.error) {
                if (result.error.message?.includes("not registered")) {
                    toast.error(
                        "Nostr key not linked. Link your key from Account → Security first."
                    )
                } else {
                    toast.error(result.error.message || "Nostr sign-in failed")
                }
                setIsPending(false)
                return
            }

            navigate(redirectTo)
        } catch {
            toast.error("Nostr sign-in failed")
            setIsPending(false)
        }
    }

    if (!hasExtension) return null

    return (
        <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={signIn}
        >
            <ZapIcon />
            Sign in with Nostr
        </Button>
    )
}
