"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import {
    getUserById,
    listGroupIdsForUser,
    listGroups,
    listRoleIdsForUser,
    listSegmentRoles,
    setUserSegmentRoles,
    setUserGroups as storeSetUserGroups
} from "@/modules/segments/store"
import type {
    PrivilegeRole,
    SegmentCatalogItem
} from "@/modules/segments/types"

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error("Not authenticated")
    if (session.user.role !== "admin") throw new Error("Forbidden")
    return session
}

export type AdminUserRow = {
    id: string
    name: string
    email: string
    role: string | null
    banned: boolean | null
    createdAt: Date
}

export async function listAdminUsers(input?: {
    search?: string
    limit?: number
    offset?: number
}): Promise<{ users: AdminUserRow[]; total: number }> {
    await requireAdmin()
    const search = input?.search?.trim()
    const result = await auth.api.listUsers({
        headers: await headers(),
        query: {
            limit: input?.limit ?? 20,
            offset: input?.offset ?? 0,
            sortBy: "createdAt",
            sortDirection: "desc",
            ...(search
                ? {
                      searchValue: search,
                      searchField: search.includes(" ") ? "name" : "email",
                      searchOperator: "contains" as const
                  }
                : {})
        }
    })
    return {
        users: (result.users ?? []) as AdminUserRow[],
        total: result.total ?? 0
    }
}

export async function getAdminUser(userId: string): Promise<{
    user: AdminUserRow
    roles: SegmentCatalogItem[]
    groups: SegmentCatalogItem[]
    assignedRoleIds: string[]
    assignedGroupIds: string[]
} | null> {
    await requireAdmin()
    const user = await getUserById(userId)
    if (!user) return null
    const [roles, groups, assignedRoleIds, assignedGroupIds] =
        await Promise.all([
            listSegmentRoles(),
            listGroups(),
            listRoleIdsForUser(userId),
            listGroupIdsForUser(userId)
        ])
    return {
        user,
        roles,
        groups,
        assignedRoleIds,
        assignedGroupIds
    }
}

export async function setUserPrivilegeRole(
    userId: string,
    role: PrivilegeRole
) {
    const session = await requireAdmin()
    if (session.user.id === userId && role !== "admin") {
        throw new Error("You cannot remove your own admin privilege.")
    }
    await auth.api.setRole({
        headers: await headers(),
        body: { userId, role }
    })
}

export async function assignUserSegmentRoles(
    userId: string,
    roleIds: string[]
) {
    await requireAdmin()
    await setUserSegmentRoles(userId, roleIds)
}

export async function assignUserGroups(userId: string, groupIds: string[]) {
    await requireAdmin()
    await storeSetUserGroups(userId, groupIds)
}
