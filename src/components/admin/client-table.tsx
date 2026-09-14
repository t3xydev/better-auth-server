"use client"

import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"
import { toast } from "sonner"
import {
    MoreHorizontal,
    Pencil,
    Trash2,
    Power,
    PowerOff,
    Copy,
    Check,
} from "lucide-react"
import Link from "next/link"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteClient, toggleClient } from "@/lib/actions/admin-clients"
import type { OAuthClientRow } from "@/lib/actions/admin-clients"
import { isPublicOAuthClient } from "@/lib/oauth-client"
import { TRUST_TIER_LABELS, getTrustTier } from "@/lib/client-trust"

export function ClientTable({ clients }: { clients: OAuthClientRow[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [deleteTarget, setDeleteTarget] = useState<OAuthClientRow | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    function handleToggle(client: OAuthClientRow) {
        startTransition(async () => {
            try {
                await toggleClient(client.id, !client.disabled)
                toast.success(
                    client.disabled ? "Client enabled" : "Client disabled",
                )
                router.refresh()
            } catch {
                toast.error("Failed to update client")
            }
        })
    }

    function handleDelete() {
        if (!deleteTarget) return
        startTransition(async () => {
            try {
                await deleteClient(deleteTarget.id)
                toast.success("Client deleted")
                setDeleteTarget(null)
                router.refresh()
            } catch {
                toast.error("Failed to delete client")
            }
        })
    }

    async function handleCopyId(clientId: string) {
        await navigator.clipboard.writeText(clientId)
        setCopiedId(clientId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    if (clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
                <p className="text-muted-foreground">No OAuth clients yet</p>
                <p className="text-sm text-muted-foreground">
                    Create one to get started.
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Client ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Trust</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client) => (
                            <TableRow key={client.id}>
                                <TableCell className="font-medium">
                                    <Link
                                        href={`/admin/clients/${client.id}`}
                                        className="hover:underline"
                                    >
                                        {client.name || "Unnamed"}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <code className="max-w-[180px] truncate text-xs text-muted-foreground">
                                            {client.clientId}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyId(client.clientId)}
                                            className="shrink-0 text-muted-foreground hover:text-foreground"
                                        >
                                            {copiedId === client.clientId ? (
                                                <Check className="size-3.5" />
                                            ) : (
                                                <Copy className="size-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {isPublicOAuthClient(client) ? "Public" : "Confidential"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {TRUST_TIER_LABELS[getTrustTier(client.metadata)]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {client.disabled ? (
                                        <Badge variant="destructive">Disabled</Badge>
                                    ) : (
                                        <Badge variant="secondary">Active</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {client.createdAt
                                        ? new Date(client.createdAt).toLocaleDateString()
                                        : "—"}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="size-8">
                                                <MoreHorizontal className="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/clients/${client.id}`}>
                                                    <Pencil className="mr-2 size-4" />
                                                    Edit
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleToggle(client)}
                                                disabled={isPending}
                                            >
                                                {client.disabled ? (
                                                    <>
                                                        <Power className="mr-2 size-4" />
                                                        Enable
                                                    </>
                                                ) : (
                                                    <>
                                                        <PowerOff className="mr-2 size-4" />
                                                        Disable
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setDeleteTarget(client)}
                                            >
                                                <Trash2 className="mr-2 size-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={!!deleteTarget}
                onOpenChange={(v) => !v && setDeleteTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Client</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete{" "}
                            <strong>{deleteTarget?.name || "this client"}</strong>? This action
                            cannot be undone and will revoke all associated tokens.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            {isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
