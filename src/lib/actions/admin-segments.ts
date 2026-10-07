"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import {
    addGroupMember,
    addRoleMember,
    createGroup,
    createSegmentRole,
    deleteGroup,
    deleteSegmentRole,
    getGroup,
    getSegmentRole,
    listGroupMembers,
    listGroups,
    listRoleMembers,
    listSegmentRoles,
    removeGroupMember,
    removeRoleMember,
    updateGroup,
    updateSegmentRole
} from "@/modules/segments/store"
import type {
    SegmentCatalogItem,
    SegmentMember
} from "@/modules/segments/types"

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error("Not authenticated")
    if (session.user.role !== "admin") throw new Error("Forbidden")
    return session
}

export async function listCatalogRoles(): Promise<SegmentCatalogItem[]> {
    await requireAdmin()
    return listSegmentRoles()
}

export async function listCatalogGroups(): Promise<SegmentCatalogItem[]> {
    await requireAdmin()
    return listGroups()
}

export async function createCatalogRole(data: {
    slug: string
    name: string
    description?: string | null
    permissions?: string[]
}) {
    await requireAdmin()
    await createSegmentRole(data)
}

export async function createCatalogGroup(data: {
    slug: string
    name: string
    description?: string | null
}) {
    await requireAdmin()
    await createGroup(data)
}

export async function updateCatalogRole(
    id: string,
    data: {
        name: string
        description?: string | null
        permissions?: string[]
    }
) {
    await requireAdmin()
    await updateSegmentRole(id, data)
}

export async function updateCatalogGroup(
    id: string,
    data: { name: string; description?: string | null }
) {
    await requireAdmin()
    await updateGroup(id, data)
}

export async function deleteCatalogRole(id: string) {
    await requireAdmin()
    await deleteSegmentRole(id)
}

export async function deleteCatalogGroup(id: string) {
    await requireAdmin()
    await deleteGroup(id)
}

export async function getCatalogRole(id: string) {
    await requireAdmin()
    return getSegmentRole(id)
}

export async function getCatalogGroup(id: string) {
    await requireAdmin()
    return getGroup(id)
}

export async function listCatalogRoleMembers(
    roleId: string
): Promise<SegmentMember[]> {
    await requireAdmin()
    return listRoleMembers(roleId)
}

export async function listCatalogGroupMembers(
    groupId: string
): Promise<SegmentMember[]> {
    await requireAdmin()
    return listGroupMembers(groupId)
}

export async function addCatalogRoleMember(roleId: string, userId: string) {
    await requireAdmin()
    await addRoleMember(roleId, userId)
}

export async function removeCatalogRoleMember(roleId: string, userId: string) {
    await requireAdmin()
    await removeRoleMember(roleId, userId)
}

export async function addCatalogGroupMember(groupId: string, userId: string) {
    await requireAdmin()
    await addGroupMember(groupId, userId)
}

export async function removeCatalogGroupMember(
    groupId: string,
    userId: string
) {
    await requireAdmin()
    await removeGroupMember(groupId, userId)
}
