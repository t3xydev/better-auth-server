"use client"

import { AuthUIContext, SettingsCard } from "@daveyplate/better-auth-ui"
import { Fingerprint, KeyRound, Mail, Zap } from "lucide-react"
import {
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState
} from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import {
    type LinkedNostrKey,
    linkNostrKey,
    listNostrKeys,
    unlinkNostrKey
} from "@/lib/nostr-link-client"

function shortenKey(publicKey: string) {
    if (publicKey.length <= 16) return publicKey
    return `${publicKey.slice(0, 8)}…${publicKey.slice(-8)}`
}

function MethodRow({
    icon,
    title,
    description,
    action
}: {
    icon: ReactNode
    title: string
    description: string
    action: ReactNode
}) {
    return (
        <Card className="flex-row items-center gap-3 px-4 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{title}</p>
                <p className="truncate text-muted-foreground text-xs">
                    {description}
                </p>
            </div>
            <div className="shrink-0">{action}</div>
        </Card>
    )
}

export function SignInMethodsCard({ className }: { className?: string }) {
    const {
        authClient: uiAuthClient,
        basePath,
        baseURL,
        hooks: { useListAccounts, useListPasskeys, useSession },
        viewPaths
    } = useContext(AuthUIContext)

    const { data: sessionData } = useSession()
    const { data: accounts, isPending: accountsPending } = useListAccounts()
    const {
        data: passkeys,
        isPending: passkeysPending,
        refetch: refetchPasskeys
    } = useListPasskeys()

    const [nostrKeys, setNostrKeys] = useState<LinkedNostrKey[]>([])
    const [nostrPending, setNostrPending] = useState(true)
    const [actionPending, setActionPending] = useState<string | null>(null)
    const [hasExtension, setHasExtension] = useState(false)

    const refreshNostrKeys = useCallback(async () => {
        setNostrKeys(await listNostrKeys())
    }, [])

    useEffect(() => {
        if (window?.nostr) {
            setHasExtension(true)
        }
        void refreshNostrKeys()
            .catch((err) => {
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to load Nostr keys"
                )
            })
            .finally(() => setNostrPending(false))
    }, [refreshNostrKeys])

    const credentialsLinked = accounts?.some(
        (account) => account.providerId === "credential"
    )
    const passkeyCount = passkeys?.length ?? 0
    const isPending = accountsPending || passkeysPending || nostrPending

    async function handleSetPassword() {
        const email = sessionData?.user.email
        if (!email) return
        setActionPending("password")
        try {
            await uiAuthClient.requestPasswordReset({
                email,
                redirectTo: `${baseURL}${basePath}/${viewPaths.RESET_PASSWORD}`,
                fetchOptions: { throw: true }
            })
            toast.success("Check your email to set a password.")
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to send reset email"
            )
        } finally {
            setActionPending(null)
        }
    }

    async function handleAddPasskey() {
        setActionPending("passkey")
        try {
            await authClient.passkey.addPasskey({
                fetchOptions: { throw: true }
            })
            await refetchPasskeys?.()
            toast.success("Passkey added")
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to add passkey"
            )
        } finally {
            setActionPending(null)
        }
    }

    async function handleLinkNostr() {
        setActionPending("nostr")
        try {
            const { publicKey } = await linkNostrKey()
            setNostrKeys((current) =>
                current.some((key) => key.publicKey === publicKey)
                    ? current
                    : [
                          ...current,
                          {
                              publicKey,
                              createdAt: new Date().toISOString()
                          }
                      ]
            )
            toast.success("Nostr key linked")
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to link Nostr key"
            )
        } finally {
            setActionPending(null)
        }
    }

    async function handleUnlinkNostr(publicKey: string) {
        setActionPending(`unlink:${publicKey}`)
        try {
            await unlinkNostrKey(publicKey)
            setNostrKeys((current) =>
                current.filter((key) => key.publicKey !== publicKey)
            )
            toast.success("Nostr key unlinked")
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to unlink Nostr key"
            )
        } finally {
            setActionPending(null)
        }
    }

    return (
        <SettingsCard
            className={className}
            title="Sign-in methods"
            description="Link additional ways to sign in to this account."
            isPending={isPending}
        >
            <CardContent className="grid gap-3">
                <MethodRow
                    icon={<Mail className="size-4" />}
                    title="Email code"
                    description="A one-time code is sent to your email."
                    action={
                        <span className="text-muted-foreground text-xs">
                            Available
                        </span>
                    }
                />
                <MethodRow
                    icon={<KeyRound className="size-4" />}
                    title="Password"
                    description="Sign in with your email and password."
                    action={
                        credentialsLinked ? (
                            <span className="text-muted-foreground text-xs">
                                Linked
                            </span>
                        ) : (
                            <Button
                                disabled={actionPending !== null}
                                onClick={() => void handleSetPassword()}
                                size="sm"
                                variant="outline"
                            >
                                {actionPending === "password"
                                    ? "Sending…"
                                    : "Set password"}
                            </Button>
                        )
                    }
                />
                <MethodRow
                    icon={<Fingerprint className="size-4" />}
                    title="Passkey"
                    description={
                        passkeyCount > 0
                            ? `${passkeyCount} passkey${passkeyCount === 1 ? "" : "s"} on this account.`
                            : "Add a passkey for passwordless sign-in."
                    }
                    action={
                        <Button
                            disabled={actionPending !== null}
                            onClick={() => void handleAddPasskey()}
                            size="sm"
                            variant="outline"
                        >
                            {actionPending === "passkey"
                                ? "Adding…"
                                : passkeyCount > 0
                                  ? "Add another"
                                  : "Add"}
                        </Button>
                    }
                />
                {nostrKeys.length === 0 ? (
                    <MethodRow
                        icon={<Zap className="size-4" />}
                        title="Nostr"
                        description="Link a NIP-07 extension key to sign in with Nostr."
                        action={
                            hasExtension ? (
                                <Button
                                    disabled={actionPending !== null}
                                    onClick={() => void handleLinkNostr()}
                                    size="sm"
                                    variant="outline"
                                >
                                    {actionPending === "nostr"
                                        ? "Linking…"
                                        : "Link"}
                                </Button>
                            ) : (
                                <span className="text-muted-foreground text-xs">
                                    Extension required
                                </span>
                            )
                        }
                    />
                ) : (
                    nostrKeys.map((key) => (
                        <MethodRow
                            key={key.publicKey}
                            icon={<Zap className="size-4" />}
                            title="Nostr"
                            description={shortenKey(key.publicKey)}
                            action={
                                <Button
                                    disabled={actionPending !== null}
                                    onClick={() =>
                                        void handleUnlinkNostr(key.publicKey)
                                    }
                                    size="sm"
                                    variant="outline"
                                >
                                    {actionPending === `unlink:${key.publicKey}`
                                        ? "Unlinking…"
                                        : "Unlink"}
                                </Button>
                            }
                        />
                    ))
                )}
                {nostrKeys.length > 0 && hasExtension ? (
                    <div className="flex justify-end">
                        <Button
                            disabled={actionPending !== null}
                            onClick={() => void handleLinkNostr()}
                            size="sm"
                            variant="ghost"
                        >
                            {actionPending === "nostr"
                                ? "Linking…"
                                : "Link another Nostr key"}
                        </Button>
                    </div>
                ) : null}
            </CardContent>
        </SettingsCard>
    )
}
