"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { runWithInviteGrants } from "@/modules/segments/invite-grants"
import {
    assertCatalogIds,
    listInviteGrantLabels
} from "@/modules/segments/store"

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error("Not authenticated")
    if (session.user.role !== "admin") throw new Error("Forbidden")
    return session
}

export type InviteRow = {
    id: string
    token: string
    email?: string | null
    emails?: string[] | null
    role: string
    status: string
    maxUses: number
    createdAt: Date
    expiresAt: Date
    catalogRoles: { id: string; slug: string; name: string }[]
    catalogGroups: { id: string; slug: string; name: string }[]
}

export async function listInvites(): Promise<InviteRow[]> {
    await requireAdmin()

    const result = await auth.api.listInvites({
        headers: await headers(),
        query: {
            limit: 100,
            sortBy: "createdAt",
            sortDirection: "desc"
        }
    })

    const invitations = (result.invitations ?? []) as Omit<
        InviteRow,
        "catalogRoles" | "catalogGroups"
    >[]
    const labels = await listInviteGrantLabels(
        invitations.map((invite) => invite.id)
    )
    return invitations.map((invite) => ({
        ...invite,
        catalogRoles: labels.get(invite.id)?.roles ?? [],
        catalogGroups: labels.get(invite.id)?.groups ?? []
    }))
}

export async function createInvite(data: {
    email?: string
    role: "user" | "admin"
    maxUses?: number
    expiresIn?: number
    shareInviterName?: boolean
    roleIds?: string[]
    groupIds?: string[]
}): Promise<{ status: boolean; message: string }> {
    await requireAdmin()

    const isPrivate = Boolean(data.email?.trim())
    const roleIds = [...new Set(data.roleIds ?? [])]
    const groupIds = [...new Set(data.groupIds ?? [])]
    await assertCatalogIds(roleIds, groupIds)

    return runWithInviteGrants({ roleIds, groupIds }, async () =>
        auth.api.createInvite({
            headers: await headers(),
            body: {
                role: data.role,
                ...(isPrivate ? { email: data.email!.trim() } : {}),
                ...(data.maxUses != null ? { maxUses: data.maxUses } : {}),
                ...(data.expiresIn != null
                    ? { expiresIn: data.expiresIn }
                    : {}),
                // Public invites never share; private only when explicitly enabled
                shareInviterName: isPrivate
                    ? Boolean(data.shareInviterName)
                    : false,
                senderResponse: "url"
            }
        })
    )
}

/** Soft-cancel a pending invite via the better-invite plugin. */
export async function cancelInvite(
    token: string
): Promise<{ status: boolean; message: string }> {
    await requireAdmin()

    return auth.api.cancelInvite({
        headers: await headers(),
        body: { token }
    })
}
