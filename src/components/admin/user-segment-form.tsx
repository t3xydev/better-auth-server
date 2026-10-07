"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    type AdminUserRow,
    assignUserGroups,
    assignUserSegmentRoles,
    setUserPrivilegeRole
} from "@/lib/actions/admin-users"
import type {
    PrivilegeRole,
    SegmentCatalogItem
} from "@/modules/segments/types"

export function UserSegmentForm({
    user,
    roles,
    groups,
    assignedRoleIds,
    assignedGroupIds,
    isSelf
}: {
    user: AdminUserRow
    roles: SegmentCatalogItem[]
    groups: SegmentCatalogItem[]
    assignedRoleIds: string[]
    assignedGroupIds: string[]
    isSelf: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [privilege, setPrivilege] = useState<PrivilegeRole>(
        user.role === "admin" ? "admin" : "user"
    )
    const [roleIds, setRoleIds] = useState<string[]>(assignedRoleIds)
    const [groupIds, setGroupIds] = useState<string[]>(assignedGroupIds)

    function toggle(list: string[], id: string) {
        return list.includes(id)
            ? list.filter((item) => item !== id)
            : [...list, id]
    }

    function handleSave() {
        startTransition(async () => {
            try {
                await setUserPrivilegeRole(user.id, privilege)
                await assignUserSegmentRoles(user.id, roleIds)
                await assignUserGroups(user.id, groupIds)
                toast.success("User updated")
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to update user"
                )
            }
        })
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="font-semibold text-xl tracking-tight">
                    {user.name}
                </h2>
                <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>

            <div className="space-y-2">
                <Label>IdP privilege</Label>
                <Select
                    value={privilege}
                    onValueChange={(value) =>
                        setPrivilege(value as PrivilegeRole)
                    }
                    disabled={isPending || isSelf}
                >
                    <SelectTrigger className="w-56">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">user</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                    Controls access to this admin panel. Catalog roles below are
                    for segmentation only.
                </p>
            </div>

            <fieldset className="space-y-3">
                <legend className="font-medium text-sm">Catalog roles</legend>
                {roles.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No catalog roles yet. Create them under Admin → Roles.
                    </p>
                ) : (
                    roles.map((role) => (
                        <div
                            key={role.id}
                            className="flex items-start gap-3 text-sm"
                        >
                            <Checkbox
                                id={`role-${role.id}`}
                                checked={roleIds.includes(role.id)}
                                onCheckedChange={() =>
                                    setRoleIds((current) =>
                                        toggle(current, role.id)
                                    )
                                }
                                disabled={isPending}
                            />
                            <Label
                                htmlFor={`role-${role.id}`}
                                className="font-normal"
                            >
                                <span className="font-medium">{role.name}</span>
                                <span className="ml-2 font-mono text-muted-foreground text-xs">
                                    {role.slug}
                                </span>
                                {role.permissions.length > 0 ? (
                                    <span className="mt-0.5 block text-muted-foreground text-xs">
                                        {role.permissions.join(", ")}
                                    </span>
                                ) : null}
                                {role.description ? (
                                    <span className="mt-0.5 block text-muted-foreground text-xs">
                                        {role.description}
                                    </span>
                                ) : null}
                            </Label>
                        </div>
                    ))
                )}
            </fieldset>

            <fieldset className="space-y-3">
                <legend className="font-medium text-sm">Groups</legend>
                {groups.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No groups yet. Create them under Admin → Groups.
                    </p>
                ) : (
                    groups.map((group) => (
                        <div
                            key={group.id}
                            className="flex items-start gap-3 text-sm"
                        >
                            <Checkbox
                                id={`group-${group.id}`}
                                checked={groupIds.includes(group.id)}
                                onCheckedChange={() =>
                                    setGroupIds((current) =>
                                        toggle(current, group.id)
                                    )
                                }
                                disabled={isPending}
                            />
                            <Label
                                htmlFor={`group-${group.id}`}
                                className="font-normal"
                            >
                                <span className="font-medium">
                                    {group.name}
                                </span>
                                <span className="ml-2 font-mono text-muted-foreground text-xs">
                                    {group.slug}
                                </span>
                                {group.description ? (
                                    <span className="mt-0.5 block text-muted-foreground text-xs">
                                        {group.description}
                                    </span>
                                ) : null}
                            </Label>
                        </div>
                    ))
                )}
            </fieldset>

            <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
            </Button>
        </div>
    )
}
