"use client"

import { Check, Copy, Eye, EyeOff, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/actions/admin-clients"
import {
    canSkipConsent,
    TRUST_TIER_LABELS,
    TRUST_TIERS,
    type TrustTier
} from "@/lib/client-trust"

export function CreateClientDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const nameId = useId()
    const redirectUrisId = useId()
    const postLogoutRedirectUrisId = useId()
    const skipConsentId = useId()
    const endSessionId = useId()

    const [name, setName] = useState("")
    const [redirectUri, setRedirectUri] = useState("")
    const [postLogoutRedirectUri, setPostLogoutRedirectUri] = useState("")
    const [trustTier, setTrustTier] = useState<TrustTier>("developer")
    const [skipConsent, setSkipConsent] = useState(false)
    const [enableEndSession, setEnableEndSession] = useState(true)

    const [created, setCreated] = useState<{
        clientId: string
        clientSecret: string | null
    } | null>(null)
    const [copiedField, setCopiedField] = useState<string | null>(null)
    const [secretVisible, setSecretVisible] = useState(false)

    function reset() {
        setName("")
        setRedirectUri("")
        setPostLogoutRedirectUri("")
        setTrustTier("developer")
        setSkipConsent(false)
        setEnableEndSession(true)
        setCreated(null)
        setCopiedField(null)
        setSecretVisible(false)
    }

    function handleOpenChange(next: boolean) {
        if (!next) reset()
        setOpen(next)
    }

    async function copyToClipboard(value: string, field: string) {
        await navigator.clipboard.writeText(value)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    function handleCreate() {
        if (!name.trim() || !redirectUri.trim()) {
            toast.error("Name and at least one redirect URI are required")
            return
        }

        const uris = redirectUri
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean)
        const postLogoutUris = postLogoutRedirectUri
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean)

        startTransition(async () => {
            try {
                const result = await createClient({
                    name: name.trim(),
                    redirectUris: uris,
                    postLogoutRedirectUris: postLogoutUris,
                    trustTier,
                    skipConsent: canSkipConsent(trustTier)
                        ? skipConsent
                        : false,
                    enableEndSession
                })
                setCreated({
                    clientId: result.clientId,
                    clientSecret: result.clientSecret
                })
                toast.success("Client created successfully")
                router.refresh()
            } catch (err) {
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to create client"
                )
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 size-4" />
                    New Client
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md">
                {created ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Client Created</DialogTitle>
                            <DialogDescription>
                                Save the client secret now — it cannot be
                                retrieved later.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Client ID</Label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
                                        {created.clientId}
                                    </code>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() =>
                                            copyToClipboard(
                                                created.clientId,
                                                "id"
                                            )
                                        }
                                    >
                                        {copiedField === "id" ? (
                                            <Check className="size-4" />
                                        ) : (
                                            <Copy className="size-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                            {created.clientSecret && (
                                <div className="space-y-2">
                                    <Label>Client Secret</Label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                                            {secretVisible
                                                ? created.clientSecret
                                                : "••••••••••••••••••••"}
                                        </code>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() =>
                                                setSecretVisible((v) => !v)
                                            }
                                        >
                                            {secretVisible ? (
                                                <EyeOff className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() =>
                                                copyToClipboard(
                                                    created.clientSecret!,
                                                    "secret"
                                                )
                                            }
                                        >
                                            {copiedField === "secret" ? (
                                                <Check className="size-4" />
                                            ) : (
                                                <Copy className="size-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                            >
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Create OAuth Client</DialogTitle>
                            <DialogDescription>
                                Register a new internal application as an OAuth
                                client.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor={nameId}>Application Name</Label>
                                <Input
                                    id={nameId}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="My Internal App"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={redirectUrisId}>
                                    Redirect URIs{" "}
                                    <span className="font-normal text-muted-foreground">
                                        (one per line)
                                    </span>
                                </Label>
                                <textarea
                                    id={redirectUrisId}
                                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={redirectUri}
                                    onChange={(e) =>
                                        setRedirectUri(e.target.value)
                                    }
                                    placeholder="http://localhost:3001/callback"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={postLogoutRedirectUrisId}>
                                    Post-logout redirect URIs{" "}
                                    <span className="font-normal text-muted-foreground">
                                        (one per line)
                                    </span>
                                </Label>
                                <textarea
                                    id={postLogoutRedirectUrisId}
                                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={postLogoutRedirectUri}
                                    onChange={(e) =>
                                        setPostLogoutRedirectUri(e.target.value)
                                    }
                                    placeholder="https://example.com/signed-out"
                                />
                                <p className="text-muted-foreground text-xs">
                                    Exact allowlist used by
                                    post_logout_redirect_uri after end session.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Trust tier</Label>
                                <Select
                                    value={trustTier}
                                    onValueChange={(v) => {
                                        const next = v as TrustTier
                                        setTrustTier(next)
                                        if (!canSkipConsent(next))
                                            setSkipConsent(false)
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TRUST_TIERS.filter(
                                            (t) => t !== "unknown"
                                        ).map((tier) => (
                                            <SelectItem key={tier} value={tier}>
                                                {TRUST_TIER_LABELS[tier]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor={skipConsentId}>
                                        Skip consent screen
                                    </Label>
                                    {!canSkipConsent(trustTier) && (
                                        <p className="text-muted-foreground text-xs">
                                            First-party only
                                        </p>
                                    )}
                                </div>
                                <Switch
                                    id={skipConsentId}
                                    checked={
                                        canSkipConsent(trustTier) && skipConsent
                                    }
                                    onCheckedChange={setSkipConsent}
                                    disabled={!canSkipConsent(trustTier)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor={endSessionId}>
                                    Enable end session
                                </Label>
                                <Switch
                                    id={endSessionId}
                                    checked={enableEndSession}
                                    onCheckedChange={setEnableEndSession}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={isPending}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={isPending}>
                                {isPending ? "Creating..." : "Create Client"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
