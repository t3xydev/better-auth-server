import { asc, count, eq, inArray } from "drizzle-orm"

import { db } from "@/database/db"
import {
    groupMembers,
    groups,
    segmentRoleMembers,
    segmentRoles,
    users
} from "@/database/schema"

import { privilegeRoleOf, uniqueSlugs, validateCatalogSlug } from "./slugs"
import type { SegmentCatalogItem, UserSegments } from "./types"

export type SegmentRoleRow = typeof segmentRoles.$inferSelect
export type GroupRow = typeof groups.$inferSelect

function isUniqueViolation(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    )
}

function serializeCatalog(
    row: {
        id: string
        slug: string
        name: string
        description: string | null
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
}) {
    const slug = validateCatalogSlug(input.slug)
    const name = input.name.trim()
    if (!name) throw new Error("Name is required")
    const now = new Date()
    try {
        await db.insert(segmentRoles).values({
            id: crypto.randomUUID(),
            slug,
            name,
            description: input.description?.trim() || null,
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
    input: { name: string; description?: string | null }
) {
    const name = input.name.trim()
    if (!name) throw new Error("Name is required")
    const updated = await db
        .update(segmentRoles)
        .set({
            name,
            description: input.description?.trim() || null,
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
    const [members] = await db
        .select({ total: count() })
        .from(segmentRoleMembers)
        .where(eq(segmentRoleMembers.roleId, id))
    if (Number(members?.total ?? 0) > 0) {
        throw new Error("Remove all members before deleting this role.")
    }
    const deleted = await db
        .delete(segmentRoles)
        .where(eq(segmentRoles.id, id))
        .returning({ id: segmentRoles.id })
    if (deleted.length === 0) throw new Error("Role not found")
}

export async function deleteGroup(id: string) {
    const [members] = await db
        .select({ total: count() })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, id))
    if (Number(members?.total ?? 0) > 0) {
        throw new Error("Remove all members before deleting this group.")
    }
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
            .select({ slug: segmentRoles.slug })
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
        groups: uniqueSlugs(groupRows.map((row) => row.slug))
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
