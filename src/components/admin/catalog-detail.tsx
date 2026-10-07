"use client"

import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
    addCatalogGroupMember,
    addCatalogRoleMember,
    deleteCatalogGroup,
    deleteCatalogRole,
    removeCatalogGroupMember,
    removeCatalogRoleMember,
    updateCatalogGroup,
    updateCatalogRole
} from "@/lib/actions/admin-segments"
import { listAdminUsers } from "@/lib/actions/admin-users"
import { APP_PERMISSIONS } from "@/modules/segments/permissions"
import type {
    SegmentCatalogItem,
    SegmentMember
} from "@/modules/segments/types"

type Kind = "role" | "group"

export function CatalogDetail({
    kind,
    item,
    members
}: {
    kind: Kind
    item: SegmentCatalogItem
    members: SegmentMember[]
}) {
    const router = useRouter()
    const nameId = useId()
    const descriptionId = useId()
    const listHref = kind === "role" ? "/admin/roles" : "/admin/groups"
    const noun = kind === "role" ? "role" : "group"
    const [isPending, startTransition] = useTransition()
    const [name, setName] = useState(item.name)
    const [description, setDescription] = useState(item.description ?? "")
    const [permissions, setPermissions] = useState<string[]>(item.permissions)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<
        { id: string; name: string; email: string }[]
    >([])
    const [confirmDelete, setConfirmDelete] = useState(false)

    function togglePermission(key: string) {
        setPermissions((current) =>
            current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key]
        )
    }

    function save() {
        startTransition(async () => {
            try {
                if (kind === "role") {
                    await updateCatalogRole(item.id, {
                        name,
                        description,
                        permissions
                    })
                } else {
                    await updateCatalogGroup(item.id, { name, description })
                }
                toast.success(`${noun} updated`)
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : `Failed to update ${noun}`
                )
            }
        })
    }

    function search(event: FormEvent) {
        event.preventDefault()
        const term = query.trim()
        if (!term) {
            setResults([])
            return
        }
        startTransition(async () => {
            try {
                const { users } = await listAdminUsers({
                    search: term,
                    limit: 8
                })
                const memberIds = new Set(members.map((member) => member.id))
                setResults(users.filter((user) => !memberIds.has(user.id)))
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : "Search failed"
                )
            }
        })
    }

    function addMember(userId: string) {
        startTransition(async () => {
            try {
                if (kind === "role") {
                    await addCatalogRoleMember(item.id, userId)
                } else {
                    await addCatalogGroupMember(item.id, userId)
                }
                setResults((current) =>
                    current.filter((user) => user.id !== userId)
                )
                toast.success("Member added")
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to add member"
                )
            }
        })
    }

    function removeMember(userId: string) {
        startTransition(async () => {
            try {
                if (kind === "role") {
                    await removeCatalogRoleMember(item.id, userId)
                } else {
                    await removeCatalogGroupMember(item.id, userId)
                }
                toast.success("Member removed")
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to remove member"
                )
            }
        })
    }

    function removeCatalog() {
        startTransition(async () => {
            try {
                if (kind === "role") {
                    await deleteCatalogRole(item.id)
                } else {
                    await deleteCatalogGroup(item.id)
                }
                toast.success(`${noun} deleted`)
                router.push(listHref)
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : `Failed to delete ${noun}`
                )
            }
        })
    }

    return (
        <div className="space-y-8">
            <div>
                <Link
                    href={listHref}
                    className="text-muted-foreground text-sm hover:text-foreground"
                >
                    Back to {kind === "role" ? "roles" : "groups"}
                </Link>
                <h2 className="mt-2 font-semibold text-xl tracking-tight">
                    {item.name}
                </h2>
                <p className="text-muted-foreground text-sm">
                    Slug <Badge variant="outline">{item.slug}</Badge>
                </p>
            </div>

            <div className="max-w-lg space-y-4">
                <div className="space-y-2">
                    <Label htmlFor={nameId}>Name</Label>
                    <Input
                        id={nameId}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={isPending}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={descriptionId}>Description</Label>
                    <Textarea
                        id={descriptionId}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={isPending}
                    />
                </div>
                {kind === "role" ? (
                    <fieldset className="space-y-3">
                        <legend className="font-medium text-sm">
                            Permissions
                        </legend>
                        <p className="text-muted-foreground text-xs">
                            Granted to every member of this role. Admin
                            privilege is separate and is not implied here.
                        </p>
                        {APP_PERMISSIONS.map((permission) => (
                            <div
                                key={permission.key}
                                className="flex items-start gap-3 text-sm"
                            >
                                <Checkbox
                                    id={`permission-${permission.key}`}
                                    checked={permissions.includes(
                                        permission.key
                                    )}
                                    onCheckedChange={() =>
                                        togglePermission(permission.key)
                                    }
                                    disabled={isPending}
                                />
                                <Label
                                    htmlFor={`permission-${permission.key}`}
                                    className="font-normal"
                                >
                                    <span className="font-medium">
                                        {permission.label}
                                    </span>
                                    <span className="ml-2 font-mono text-muted-foreground text-xs">
                                        {permission.key}
                                    </span>
                                    <span className="mt-0.5 block text-muted-foreground text-xs">
                                        {permission.description}
                                    </span>
                                </Label>
                            </div>
                        ))}
                    </fieldset>
                ) : null}
                <Button onClick={save} disabled={isPending}>
                    {isPending ? "Saving…" : "Save"}
                </Button>
            </div>

            <div className="space-y-4">
                <div>
                    <h3 className="font-medium">Members</h3>
                    <p className="text-muted-foreground text-sm">
                        {members.length}{" "}
                        {members.length === 1 ? "member" : "members"}
                    </p>
                </div>
                <form onSubmit={search} className="flex max-w-lg gap-2">
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search name or email"
                        disabled={isPending}
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={isPending}
                    >
                        Search
                    </Button>
                </form>
                {results.length > 0 ? (
                    <ul className="max-w-lg divide-y rounded-md border">
                        {results.map((user) => (
                            <li
                                key={user.id}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                            >
                                <span>
                                    <span className="font-medium">
                                        {user.name}
                                    </span>
                                    <span className="ml-2 text-muted-foreground">
                                        {user.email}
                                    </span>
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending}
                                    onClick={() => addMember(user.id)}
                                >
                                    Add
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {members.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No members yet.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="w-16" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <Link
                                            href={`/admin/users/${member.id}`}
                                            className="font-medium hover:underline"
                                        >
                                            {member.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPending}
                                            aria-label={`Remove ${member.name}`}
                                            onClick={() =>
                                                removeMember(member.id)
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            <div className="space-y-2">
                <h3 className="font-medium text-destructive">Delete</h3>
                <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isPending}
                >
                    Delete {noun}
                </Button>
            </div>

            <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {noun}</DialogTitle>
                        <DialogDescription>
                            {item.memberCount === 0
                                ? `Delete “${item.name}”? This cannot be undone.`
                                : `Delete “${item.name}”? ${item.memberCount} ${
                                      item.memberCount === 1
                                          ? "member"
                                          : "members"
                                  } will lose this ${noun}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDelete(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={removeCatalog}
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
