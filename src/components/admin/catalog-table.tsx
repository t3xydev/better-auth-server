"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
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
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
    createCatalogGroup,
    createCatalogRole,
    deleteCatalogGroup,
    deleteCatalogRole,
    updateCatalogGroup,
    updateCatalogRole
} from "@/lib/actions/admin-segments"
import type { SegmentCatalogItem } from "@/modules/segments/types"

type Kind = "role" | "group"

const copy: Record<
    Kind,
    { title: string; empty: string; create: string; noun: string }
> = {
    role: {
        title: "Roles",
        empty: "No catalog roles yet. Create one to segment users.",
        create: "New role",
        noun: "role"
    },
    group: {
        title: "Groups",
        empty: "No groups yet. Create one to segment users.",
        create: "New group",
        noun: "group"
    }
}

export function CatalogTable({
    kind,
    items
}: {
    kind: Kind
    items: SegmentCatalogItem[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [editor, setEditor] = useState<
        { mode: "create" } | { mode: "edit"; item: SegmentCatalogItem } | null
    >(null)
    const [deleteTarget, setDeleteTarget] = useState<SegmentCatalogItem | null>(
        null
    )
    const [slug, setSlug] = useState("")
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const slugId = useId()
    const nameId = useId()
    const descriptionId = useId()

    function openCreate() {
        setSlug("")
        setName("")
        setDescription("")
        setEditor({ mode: "create" })
    }

    function openEdit(item: SegmentCatalogItem) {
        setSlug(item.slug)
        setName(item.name)
        setDescription(item.description ?? "")
        setEditor({ mode: "edit", item })
    }

    function handleSave() {
        if (!editor) return
        startTransition(async () => {
            try {
                if (editor.mode === "create") {
                    if (kind === "role") {
                        await createCatalogRole({ slug, name, description })
                    } else {
                        await createCatalogGroup({ slug, name, description })
                    }
                    toast.success(`${copy[kind].noun} created`)
                } else {
                    if (kind === "role") {
                        await updateCatalogRole(editor.item.id, {
                            name,
                            description
                        })
                    } else {
                        await updateCatalogGroup(editor.item.id, {
                            name,
                            description
                        })
                    }
                    toast.success(`${copy[kind].noun} updated`)
                }
                setEditor(null)
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : `Failed to save ${copy[kind].noun}`
                )
            }
        })
    }

    function handleDelete() {
        if (!deleteTarget) return
        startTransition(async () => {
            try {
                if (kind === "role") {
                    await deleteCatalogRole(deleteTarget.id)
                } else {
                    await deleteCatalogGroup(deleteTarget.id)
                }
                toast.success(`${copy[kind].noun} deleted`)
                setDeleteTarget(null)
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : `Failed to delete ${copy[kind].noun}`
                )
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-xl tracking-tight">
                        {copy[kind].title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {items.length}{" "}
                        {items.length === 1
                            ? copy[kind].noun
                            : `${copy[kind].noun}s`}
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="size-4" />
                    {copy[kind].create}
                </Button>
            </div>

            {items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {copy[kind].empty}
                </p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Members</TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <Link
                                            href={`/admin/${kind === "role" ? "roles" : "groups"}/${item.id}`}
                                            className="font-medium hover:underline"
                                        >
                                            {item.name}
                                        </Link>
                                        {item.description ? (
                                            <span className="text-muted-foreground text-xs">
                                                {item.description}
                                            </span>
                                        ) : null}
                                        {kind === "role" &&
                                        item.permissions.length > 0 ? (
                                            <span className="flex flex-wrap gap-1">
                                                {item.permissions.map(
                                                    (permission) => (
                                                        <Badge
                                                            key={permission}
                                                            variant="secondary"
                                                        >
                                                            {permission}
                                                        </Badge>
                                                    )
                                                )}
                                            </span>
                                        ) : null}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{item.slug}</Badge>
                                </TableCell>
                                <TableCell>{item.memberCount}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(item)}
                                            aria-label={`Edit ${item.name}`}
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setDeleteTarget(item)
                                            }
                                            aria-label={`Delete ${item.name}`}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Dialog
                open={editor !== null}
                onOpenChange={(open) => {
                    if (!open) setEditor(null)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editor?.mode === "edit"
                                ? `Edit ${copy[kind].noun}`
                                : copy[kind].create}
                        </DialogTitle>
                        <DialogDescription>
                            Slugs are used in OIDC claims and PostHog person
                            properties.
                            {editor?.mode === "edit"
                                ? " Slug cannot be changed after create."
                                : " Use lowercase kebab-case."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={slugId}>Slug</Label>
                            <Input
                                id={slugId}
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="beta"
                                disabled={isPending || editor?.mode === "edit"}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={nameId}>Name</Label>
                            <Input
                                id={nameId}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Beta testers"
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={descriptionId}>Description</Label>
                            <Textarea
                                id={descriptionId}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional"
                                disabled={isPending}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditor(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isPending}>
                            {isPending ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {copy[kind].noun}</DialogTitle>
                        <DialogDescription>
                            {deleteTarget
                                ? `Delete “${deleteTarget.name}” (${deleteTarget.slug})? ${
                                      deleteTarget.memberCount === 0
                                          ? "This cannot be undone."
                                          : `${deleteTarget.memberCount} ${
                                                deleteTarget.memberCount === 1
                                                    ? "member"
                                                    : "members"
                                            } will lose this ${copy[kind].noun}.`
                                  }`
                                : null}
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
                            {isPending ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
