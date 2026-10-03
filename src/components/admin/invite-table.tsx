"use client"

import { Ban, Check, Copy, Link2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { cancelInvite, type InviteRow } from "@/lib/actions/admin-invites"

function statusVariant(
    status: string
): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case "pending":
            return "default"
        case "used":
            return "secondary"
        case "rejected":
        case "canceled":
        case "expired":
            return "destructive"
        default:
            return "outline"
    }
}

function inviteLink(baseUrl: string, token: string) {
    return `${baseUrl}/invite/activate/${token}`
}

export function InviteTable({
    invites,
    inviteBaseUrl
}: {
    invites: InviteRow[]
    inviteBaseUrl: string
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [cancelTarget, setCancelTarget] = useState<InviteRow | null>(null)
    const [linkTarget, setLinkTarget] = useState<InviteRow | null>(null)
    const [copied, setCopied] = useState(false)

    const linkUrl = linkTarget
        ? inviteLink(inviteBaseUrl, linkTarget.token)
        : null

    async function copyLink(url: string) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success("Invite link copied")
        setTimeout(() => setCopied(false), 2000)
    }

    function handleCancel() {
        if (!cancelTarget) return

        startTransition(async () => {
            try {
                const result = await cancelInvite(cancelTarget.token)
                if (!result.status) {
                    toast.error(result.message || "Failed to cancel invite")
                    return
                }
                toast.success("Invite removed")
                setCancelTarget(null)
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to cancel invite"
                )
            }
        })
    }

    if (invites.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                No invites yet. Create one to get started.
            </p>
        )
    }

    return (
        <>
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Catalog</TableHead>
                            <TableHead>Uses</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead className="w-48 text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invites.map((invite) => {
                            const email =
                                invite.email ||
                                invite.emails?.join(", ") ||
                                "Public"
                            return (
                                <TableRow key={invite.id}>
                                    <TableCell className="font-medium">
                                        {email}
                                    </TableCell>
                                    <TableCell>{invite.role}</TableCell>
                                    <TableCell>
                                        <div className="flex max-w-56 flex-wrap gap-1">
                                            {invite.catalogRoles.map((role) => (
                                                <Badge
                                                    key={role.id}
                                                    variant="outline"
                                                >
                                                    {role.slug}
                                                </Badge>
                                            ))}
                                            {invite.catalogGroups.map(
                                                (group) => (
                                                    <Badge
                                                        key={group.id}
                                                        variant="secondary"
                                                    >
                                                        {group.slug}
                                                    </Badge>
                                                )
                                            )}
                                            {invite.catalogRoles.length === 0 &&
                                            invite.catalogGroups.length ===
                                                0 ? (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell>{invite.maxUses}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={statusVariant(
                                                invite.status
                                            )}
                                        >
                                            {invite.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(
                                            invite.expiresAt
                                        ).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {invite.status === "pending" ? (
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => {
                                                        setCopied(false)
                                                        setLinkTarget(invite)
                                                    }}
                                                >
                                                    <Link2 className="size-4" />
                                                    Link
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() =>
                                                        setCancelTarget(invite)
                                                    }
                                                >
                                                    <Ban className="size-4" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={!!linkTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setLinkTarget(null)
                        setCopied(false)
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite link</DialogTitle>
                        <DialogDescription>
                            Share this link for{" "}
                            <strong>
                                {linkTarget?.email ||
                                    linkTarget?.emails?.join(", ") ||
                                    "this public invite"}
                            </strong>
                            . It matches the URL sent in invite emails.
                        </DialogDescription>
                    </DialogHeader>
                    {linkUrl ? (
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={linkUrl}
                                className="font-mono text-xs"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => copyLink(linkUrl)}
                            >
                                {copied ? (
                                    <Check className="size-4" />
                                ) : (
                                    <Copy className="size-4" />
                                )}
                            </Button>
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button onClick={() => setLinkTarget(null)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!cancelTarget}
                onOpenChange={(open) => !open && setCancelTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel invite</DialogTitle>
                        <DialogDescription>
                            Cancel the invite for{" "}
                            <strong>
                                {cancelTarget?.email ||
                                    cancelTarget?.emails?.join(", ") ||
                                    "this public link"}
                            </strong>
                            ? It will be removed and can no longer be used.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCancelTarget(null)}
                            disabled={isPending}
                        >
                            Keep
                        </Button>
                        <Button onClick={handleCancel} disabled={isPending}>
                            {isPending ? "Canceling…" : "Cancel invite"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
