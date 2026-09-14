"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import {
    createGroup,
    createSegmentRole,
    deleteGroup,
    deleteSegmentRole,
    listGroups,
    listSegmentRoles,
    updateGroup,
    updateSegmentRole
} from "@/modules/segments/store"
import type { SegmentCatalogItem } from "@/modules/segments/types"

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
    data: { name: string; description?: string | null }
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
