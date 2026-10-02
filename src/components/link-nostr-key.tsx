"use client"

import { ZapIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
    linkNostrKey,
    listNostrKeys,
    unlinkNostrKey
} from "@/lib/nostr-link-client"
import { Button } from "./ui/button"

function shortenKey(publicKey: string) {
    if (publicKey.length <= 16) return publicKey
    return `${publicKey.slice(0, 8)}…${publicKey.slice(-8)}`
}

export function LinkNostrKey() {
    const [isPending, setIsPending] = useState(false)
    const [keys, setKeys] = useState<string[]>([])
    const [hasExtension, setHasExtension] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const refreshKeys = useCallback(async () => {
        const linked = await listNostrKeys()
        setKeys(linked.map((key) => key.publicKey))
    }, [])

    useEffect(() => {
        if (window?.nostr) {
            setHasExtension(true)
        }
        void refreshKeys()
            .catch((err) => {
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to load Nostr keys"
                )
            })
            .finally(() => setIsLoading(false))
    }, [refreshKeys])

    async function handleLink() {
        setIsPending(true)
        try {
            const { publicKey } = await linkNostrKey()
            setKeys((current) =>
                current.includes(publicKey) ? current : [...current, publicKey]
            )
            toast.success("Nostr key linked successfully")
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to link Nostr key"
            )
        } finally {
            setIsPending(false)
        }
    }

    async function handleUnlink(publicKey: string) {
        setIsPending(true)
        try {
            await unlinkNostrKey(publicKey)
            setKeys((current) => current.filter((key) => key !== publicKey))
            toast.success("Nostr key unlinked")
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to unlink Nostr key"
            )
        } finally {
            setIsPending(false)
        }
    }

    if (isLoading) {
        return (
            <p className="text-muted-foreground text-sm">Loading Nostr keys…</p>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {keys.length > 0 ? (
                <ul className="flex flex-col gap-2">
                    {keys.map((publicKey) => (
                        <li
                            key={publicKey}
                            className="flex items-center justify-between gap-3"
                        >
                            <code className="break-all rounded bg-muted px-2 py-1 text-xs">
                                {shortenKey(publicKey)}
                            </code>
                            <Button
                                disabled={isPending}
                                onClick={() => void handleUnlink(publicKey)}
                                size="sm"
                                variant="outline"
                            >
                                Unlink
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : null}

            {!hasExtension ? (
                <p className="text-muted-foreground text-sm">
                    Install a Nostr browser extension (NIP-07) to link your key.
                </p>
            ) : (
                <Button disabled={isPending} onClick={() => void handleLink()}>
                    <ZapIcon />
                    {isPending ? "Linking..." : "Link Nostr Key"}
                </Button>
            )}
        </div>
    )
}
