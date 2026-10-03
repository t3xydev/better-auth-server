import { and, asc, count, eq, inArray } from "drizzle-orm"

import { db } from "@/database/db"
import {
    groupMembers,
    groups,
    inviteSegmentGrants,
    segmentRoleMembers,
    segmentRoles,
    users
} from "@/database/schema"

import {
    type AppPermission,
    filterKnownPermissions,
    parsePermissionKeys,
    unionRolePermissions
} from "./permissions"
import { privilegeRoleOf, uniqueSlugs, validateCatalogSlug } from "./slugs"
import type { SegmentCatalogItem, SegmentMember, UserSegments } from "./types"

export type SegmentRoleRow = typeof segmentRoles.$inferSelect
export type GroupRow = typeof groups.$inferSelect

function isUniqueViolation(error: unknown): boolean {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    ) {
        return true
    }
    if (typeof error === "object" && error !== null && "cause" in error) {
        return isUniqueViolation((error as { cause?: unknown }).cause)
    }
    return false
}

function serializeCatalog(
    row: {
        id: string
        slug: string
        name: string
        description: string | null
        permissions?: string[] | null
        createdAt: Date
        updatedAt: Date
    },
    memberCount: number
): SegmentCatalogItem {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        permissions: filterKnownPermissions(row.permissions ?? []),
        memberCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    }
}

async function memberCounts(
    table: typeof segmentRoleMembers | typeof groupMembers,
    key: "roleId" | "groupId",
    ids: string[]
) {
    if (ids.length === 0) return new Map<string, number>()
    const rows = await db
        .select({
            id:
                key === "roleId"
                    ? segmentRoleMembers.roleId
                    : groupMembers.groupId,
            total: count()
        })
        .from(table)
        .where(
            inArray(
                key === "roleId"
                    ? segmentRoleMembers.roleId
                    : groupMembers.groupId,
                ids
            )
        )
        .groupBy(
            key === "roleId" ? segmentRoleMembers.roleId : groupMembers.groupId
        )
    return new Map(rows.map((row) => [row.id, Number(row.total)]))
}

export async function listSegmentRoles(): Promise<SegmentCatalogItem[]> {
    const rows = await db
        .select()
        .from(segmentRoles)
        .orderBy(asc(segmentRoles.slug))
    const counts = await memberCounts(
        segmentRoleMembers,
        "roleId",
        rows.map((row) => row.id)
    )
    return rows.map((row) => serializeCatalog(row, counts.get(row.id) ?? 0))
}

export async function listGroups(): Promise<SegmentCatalogItem[]> {
    const rows = await db.select().from(groups).orderBy(asc(groups.slug))
    const counts = await memberCounts(
        groupMembers,
        "groupId",
        rows.map((row) => row.id)
    )
    return rows.map((row) => serializeCatalog(row, counts.get(row.id) ?? 0))
}

export async function createSegmentRole(input: {
    slug: string
    name: string
    description?: string | null
    permissions?: string[]
}) {
    const slug = validateCatalogSlug(input.slug)
    const name = input.name.trim()
    if (!name) throw new Error("Name is required")
    const permissions = parsePermissionKeys(input.permissions ?? [])
    const now = new Date()
    try {
        await db.insert(segmentRoles).values({
            id: crypto.randomUUID(),
            slug,
            name,
            description: input.description?.trim() || null,
            permissions,
            createdAt: now,
            updatedAt: now
        })
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new Error(`Role slug "${slug}" already exists.`)
        }
        throw error
    }
}

export async function createGroup(input: {
    slug: string
    name: string
    description?: string | null
}) {
    const slug = validateCatalogSlug(input.slug)
    const name = input.name.trim()
    if (!name) throw new Error("Name is required")
    const now = new Date()
    try {
        await db.insert(groups).values({
            id: crypto.randomUUID(),
            slug,
            name,
            description: input.description?.trim() || null,
            createdAt: now,
            updatedAt: now
        })
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new Error(`Group slug "${slug}" already exists.`)
        }
        throw error
    }
}

export async function updateSegmentRole(
    id: string,
    input: {
        name: string
        description?: string | null
        permissions?: string[]
    }
) {
    const name = input.name.trim()
    if (!name) throw new Error("Name is required")
    const permissions =
        input.permissions === undefined
            ? undefined
            : parsePermissionKeys(input.permissions)
    const updated = await db
        .update(segmentRoles)
        .set({
            name,
            description: input.description?.trim() || null,
            ...(permissions === undefined ? {} : { permissions }),
            updatedAt: new Date()
        })
        .where(eq(segmentRoles.id, id))
        .returning({ id: segmentRoles.id })
    if (updated.length === 0) throw new Error("Role not found")
}

export async function updateGroup(
    id: string,
    input: { name: string; description?: string | null }
) {
    const name = input.name.trim()
    if (!name) throw new Error("Name is required")
    const updated = await db
        .update(groups)
        .set({
            name,
            description: input.description?.trim() || null,
            updatedAt: new Date()
        })
        .where(eq(groups.id, id))
        .returning({ id: groups.id })
    if (updated.length === 0) throw new Error("Group not found")
}

export async function deleteSegmentRole(id: string) {
    const deleted = await db
        .delete(segmentRoles)
        .where(eq(segmentRoles.id, id))
        .returning({ id: segmentRoles.id })
    if (deleted.length === 0) throw new Error("Role not found")
}

export async function deleteGroup(id: string) {
    const deleted = await db
        .delete(groups)
        .where(eq(groups.id, id))
        .returning({ id: groups.id })
    if (deleted.length === 0) throw new Error("Group not found")
}

export async function listRoleIdsForUser(userId: string) {
    const rows = await db
        .select({ roleId: segmentRoleMembers.roleId })
        .from(segmentRoleMembers)
        .where(eq(segmentRoleMembers.userId, userId))
    return rows.map((row) => row.roleId)
}

export async function listGroupIdsForUser(userId: string) {
    const rows = await db
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(eq(groupMembers.userId, userId))
    return rows.map((row) => row.groupId)
}

export async function setUserSegmentRoles(userId: string, roleIds: string[]) {
    const uniqueIds = [...new Set(roleIds)]
    if (uniqueIds.length > 0) {
        const found = await db
            .select({ id: segmentRoles.id })
            .from(segmentRoles)
            .where(inArray(segmentRoles.id, uniqueIds))
        if (found.length !== uniqueIds.length) {
            throw new Error("One or more roles were not found.")
        }
    }
    await db
        .delete(segmentRoleMembers)
        .where(eq(segmentRoleMembers.userId, userId))
    if (uniqueIds.length === 0) return
    const now = new Date()
    await db.insert(segmentRoleMembers).values(
        uniqueIds.map((roleId) => ({
            id: crypto.randomUUID(),
            userId,
            roleId,
            createdAt: now
        }))
    )
}

export async function setUserGroups(userId: string, groupIds: string[]) {
    const uniqueIds = [...new Set(groupIds)]
    if (uniqueIds.length > 0) {
        const found = await db
            .select({ id: groups.id })
            .from(groups)
            .where(inArray(groups.id, uniqueIds))
        if (found.length !== uniqueIds.length) {
            throw new Error("One or more groups were not found.")
        }
    }
    await db.delete(groupMembers).where(eq(groupMembers.userId, userId))
    if (uniqueIds.length === 0) return
    const now = new Date()
    await db.insert(groupMembers).values(
        uniqueIds.map((groupId) => ({
            id: crypto.randomUUID(),
            userId,
            groupId,
            createdAt: now
        }))
    )
}

export async function getUserSegments(
    userId: string,
    privilegeRole?: string | null
): Promise<UserSegments> {
    let roleValue = privilegeRole
    if (roleValue === undefined) {
        const [row] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
        roleValue = row?.role
    }

    const [roleRows, groupRows] = await Promise.all([
        db
            .select({
                slug: segmentRoles.slug,
                permissions: segmentRoles.permissions
            })
            .from(segmentRoleMembers)
            .innerJoin(
                segmentRoles,
                eq(segmentRoleMembers.roleId, segmentRoles.id)
            )
            .where(eq(segmentRoleMembers.userId, userId)),
        db
            .select({ slug: groups.slug })
            .from(groupMembers)
            .innerJoin(groups, eq(groupMembers.groupId, groups.id))
            .where(eq(groupMembers.userId, userId))
    ])

    return {
        privilegeRole: privilegeRoleOf(roleValue),
        roles: uniqueSlugs(roleRows.map((row) => row.slug)),
        groups: uniqueSlugs(groupRows.map((row) => row.slug)),
        permissions: unionRolePermissions(roleRows)
    }
}

export async function userHasRole(userId: string, slug: string) {
    const segments = await getUserSegments(userId)
    return segments.roles.includes(slug)
}

export async function userInGroup(userId: string, slug: string) {
    const segments = await getUserSegments(userId)
    return segments.groups.includes(slug)
}

export async function getUserById(userId: string) {
    const [row] = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            banned: users.banned,
            createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    return row ?? null
}

export async function getSegmentRole(
    id: string
): Promise<SegmentCatalogItem | null> {
    const [row] = await db
        .select()
        .from(segmentRoles)
        .where(eq(segmentRoles.id, id))
        .limit(1)
    if (!row) return null
    const counts = await memberCounts(segmentRoleMembers, "roleId", [id])
    return serializeCatalog(row, counts.get(id) ?? 0)
}

export async function getGroup(id: string): Promise<SegmentCatalogItem | null> {
    const [row] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, id))
        .limit(1)
    if (!row) return null
    const counts = await memberCounts(groupMembers, "groupId", [id])
    return serializeCatalog(row, counts.get(id) ?? 0)
}

async function listMembers(
    table: typeof segmentRoleMembers | typeof groupMembers,
    key: "roleId" | "groupId",
    id: string
): Promise<SegmentMember[]> {
    const column =
        key === "roleId" ? segmentRoleMembers.roleId : groupMembers.groupId
    const userColumn =
        key === "roleId" ? segmentRoleMembers.userId : groupMembers.userId
    return db
        .select({
            id: users.id,
            name: users.name,
            email: users.email
        })
        .from(table)
        .innerJoin(users, eq(userColumn, users.id))
        .where(eq(column, id))
        .orderBy(asc(users.email))
}

export function listRoleMembers(roleId: string) {
    return listMembers(segmentRoleMembers, "roleId", roleId)
}

export function listGroupMembers(groupId: string) {
    return listMembers(groupMembers, "groupId", groupId)
}

export async function addRoleMember(roleId: string, userId: string) {
    const role = await getSegmentRole(roleId)
    if (!role) throw new Error("Role not found")
    const user = await getUserById(userId)
    if (!user) throw new Error("User not found")
    try {
        await db.insert(segmentRoleMembers).values({
            id: crypto.randomUUID(),
            userId,
            roleId,
            createdAt: new Date()
        })
    } catch (error) {
        if (!isUniqueViolation(error)) throw error
    }
}

export async function removeRoleMember(roleId: string, userId: string) {
    await db
        .delete(segmentRoleMembers)
        .where(
            and(
                eq(segmentRoleMembers.roleId, roleId),
                eq(segmentRoleMembers.userId, userId)
            )
        )
}

export async function addGroupMember(groupId: string, userId: string) {
    const group = await getGroup(groupId)
    if (!group) throw new Error("Group not found")
    const user = await getUserById(userId)
    if (!user) throw new Error("User not found")
    try {
        await db.insert(groupMembers).values({
            id: crypto.randomUUID(),
            userId,
            groupId,
            createdAt: new Date()
        })
    } catch (error) {
        if (!isUniqueViolation(error)) throw error
    }
}

export async function removeGroupMember(groupId: string, userId: string) {
    await db
        .delete(groupMembers)
        .where(
            and(
                eq(groupMembers.groupId, groupId),
                eq(groupMembers.userId, userId)
            )
        )
}

export async function addUserSegmentRoles(userId: string, roleIds: string[]) {
    const uniqueIds = [...new Set(roleIds)]
    if (uniqueIds.length === 0) return
    const found = await db
        .select({ id: segmentRoles.id })
        .from(segmentRoles)
        .where(inArray(segmentRoles.id, uniqueIds))
    const existing = new Set(found.map((row) => row.id))
    const now = new Date()
    const values = uniqueIds
        .filter((roleId) => existing.has(roleId))
        .map((roleId) => ({
            id: crypto.randomUUID(),
            userId,
            roleId,
            createdAt: now
        }))
    if (values.length === 0) return
    try {
        await db.insert(segmentRoleMembers).values(values)
    } catch (error) {
        if (!isUniqueViolation(error)) throw error
        for (const value of values) {
            try {
                await db.insert(segmentRoleMembers).values(value)
            } catch (insertError) {
                if (!isUniqueViolation(insertError)) throw insertError
            }
        }
    }
}

export async function addUserGroups(userId: string, groupIds: string[]) {
    const uniqueIds = [...new Set(groupIds)]
    if (uniqueIds.length === 0) return
    const found = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.id, uniqueIds))
    const existing = new Set(found.map((row) => row.id))
    const now = new Date()
    const values = uniqueIds
        .filter((groupId) => existing.has(groupId))
        .map((groupId) => ({
            id: crypto.randomUUID(),
            userId,
            groupId,
            createdAt: now
        }))
    if (values.length === 0) return
    try {
        await db.insert(groupMembers).values(values)
    } catch (error) {
        if (!isUniqueViolation(error)) throw error
        for (const value of values) {
            try {
                await db.insert(groupMembers).values(value)
            } catch (insertError) {
                if (!isUniqueViolation(insertError)) throw insertError
            }
        }
    }
}

export type UserSegmentBadges = {
    roles: string[]
    groups: string[]
}

export async function listSegmentBadgesForUsers(userIds: string[]) {
    const badges = new Map<string, UserSegmentBadges>()
    if (userIds.length === 0) return badges
    for (const userId of userIds) {
        badges.set(userId, { roles: [], groups: [] })
    }
    const [roleRows, groupRows] = await Promise.all([
        db
            .select({
                userId: segmentRoleMembers.userId,
                slug: segmentRoles.slug
            })
            .from(segmentRoleMembers)
            .innerJoin(
                segmentRoles,
                eq(segmentRoleMembers.roleId, segmentRoles.id)
            )
            .where(inArray(segmentRoleMembers.userId, userIds)),
        db
            .select({
                userId: groupMembers.userId,
                slug: groups.slug
            })
            .from(groupMembers)
            .innerJoin(groups, eq(groupMembers.groupId, groups.id))
            .where(inArray(groupMembers.userId, userIds))
    ])
    for (const row of roleRows) {
        badges.get(row.userId)?.roles.push(row.slug)
    }
    for (const row of groupRows) {
        badges.get(row.userId)?.groups.push(row.slug)
    }
    for (const badge of badges.values()) {
        badge.roles = uniqueSlugs(badge.roles)
        badge.groups = uniqueSlugs(badge.groups)
    }
    return badges
}

export async function assertCatalogIds(roleIds: string[], groupIds: string[]) {
    if (roleIds.length > 0) {
        const found = await db
            .select({ id: segmentRoles.id })
            .from(segmentRoles)
            .where(inArray(segmentRoles.id, roleIds))
        if (found.length !== roleIds.length) {
            throw new Error("One or more roles were not found.")
        }
    }
    if (groupIds.length > 0) {
        const found = await db
            .select({ id: groups.id })
            .from(groups)
            .where(inArray(groups.id, groupIds))
        if (found.length !== groupIds.length) {
            throw new Error("One or more groups were not found.")
        }
    }
}

export async function saveInviteGrants(
    inviteIds: string[],
    grants: { roleIds: string[]; groupIds: string[] }
) {
    const roleIds = [...new Set(grants.roleIds)]
    const groupIds = [...new Set(grants.groupIds)]
    if (inviteIds.length === 0) return
    if (roleIds.length === 0 && groupIds.length === 0) return
    await assertCatalogIds(roleIds, groupIds)
    await db.insert(inviteSegmentGrants).values(
        inviteIds.map((inviteId) => ({
            id: crypto.randomUUID(),
            inviteId,
            roleIds,
            groupIds
        }))
    )
}

export async function applyInviteGrants(inviteId: string, userId: string) {
    const [grant] = await db
        .select({
            roleIds: inviteSegmentGrants.roleIds,
            groupIds: inviteSegmentGrants.groupIds
        })
        .from(inviteSegmentGrants)
        .where(eq(inviteSegmentGrants.inviteId, inviteId))
        .limit(1)
    if (!grant) return
    await addUserSegmentRoles(userId, grant.roleIds)
    await addUserGroups(userId, grant.groupIds)
}

export type InviteGrantLabels = {
    roles: { id: string; slug: string; name: string }[]
    groups: { id: string; slug: string; name: string }[]
}

export async function listInviteGrantLabels(inviteIds: string[]) {
    const labels = new Map<string, InviteGrantLabels>()
    if (inviteIds.length === 0) return labels
    const grants = await db
        .select({
            inviteId: inviteSegmentGrants.inviteId,
            roleIds: inviteSegmentGrants.roleIds,
            groupIds: inviteSegmentGrants.groupIds
        })
        .from(inviteSegmentGrants)
        .where(inArray(inviteSegmentGrants.inviteId, inviteIds))
    const roleIds = [...new Set(grants.flatMap((grant) => grant.roleIds))]
    const groupIds = [...new Set(grants.flatMap((grant) => grant.groupIds))]
    const [roleRows, groupRows] = await Promise.all([
        roleIds.length === 0
            ? []
            : db
                  .select({
                      id: segmentRoles.id,
                      slug: segmentRoles.slug,
                      name: segmentRoles.name
                  })
                  .from(segmentRoles)
                  .where(inArray(segmentRoles.id, roleIds)),
        groupIds.length === 0
            ? []
            : db
                  .select({
                      id: groups.id,
                      slug: groups.slug,
                      name: groups.name
                  })
                  .from(groups)
                  .where(inArray(groups.id, groupIds))
    ])
    const rolesById = new Map(roleRows.map((row) => [row.id, row]))
    const groupsById = new Map(groupRows.map((row) => [row.id, row]))
    for (const grant of grants) {
        labels.set(grant.inviteId, {
            roles: grant.roleIds.flatMap((id) => {
                const role = rolesById.get(id)
                return role ? [role] : []
            }),
            groups: grant.groupIds.flatMap((id) => {
                const group = groupsById.get(id)
                return group ? [group] : []
            })
        })
    }
    return labels
}

export async function userHasPermission(
    userId: string,
    key: AppPermission
): Promise<boolean> {
    const segments = await getUserSegments(userId)
    return segments.permissions.includes(key)
}

export async function requirePermission(userId: string, key: AppPermission) {
    if (await userHasPermission(userId, key)) return
    throw new Error(`Missing permission ${key}`)
}
