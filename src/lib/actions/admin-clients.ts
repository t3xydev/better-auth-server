"use server"

import { desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { db } from "@/database/db"
import { oauthClients } from "@/database/schema"
import { auth } from "@/lib/auth"
import {
    assertScopesForTier,
    canSkipConsent,
    canUseClientCredentials,
    filterScopesForTier,
    getTrustTier,
    isTrustTier,
    mergeTrustMetadata,
    type TrustTier
} from "@/lib/client-trust"

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error("Not authenticated")
    if (session.user.role !== "admin") throw new Error("Forbidden")
    return session
}

export type OAuthClientRow = typeof oauthClients.$inferSelect

export async function getClients(): Promise<OAuthClientRow[]> {
    await requireAdmin()
    return db.select().from(oauthClients).orderBy(desc(oauthClients.createdAt))
}

export async function getClient(id: string): Promise<OAuthClientRow | null> {
    await requireAdmin()
    const rows = await db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.id, id))
        .limit(1)
    return rows[0] ?? null
}

export async function createClient(data: {
    name: string
    redirectUris: string[]
    postLogoutRedirectUris?: string[]
    scopes?: string[]
    skipConsent?: boolean
    enableEndSession?: boolean
    type?: string
    uri?: string
    trustTier?: TrustTier
}) {
    const session = await requireAdmin()
    const trustTier: TrustTier = data.trustTier ?? "developer"

    if (data.skipConsent && !canSkipConsent(trustTier)) {
        throw new Error(
            "Consent bypass is only allowed for first-party clients"
        )
    }

    const scopes = filterScopesForTier(
        data.scopes ?? ["openid", "profile", "email"],
        trustTier
    )
    assertScopesForTier(scopes, trustTier)

    const result = await auth.api.adminCreateOAuthClient({
        headers: await headers(),
        body: {
            redirect_uris: data.redirectUris,
            ...(data.postLogoutRedirectUris?.length && {
                post_logout_redirect_uris: data.postLogoutRedirectUris
            }),
            client_name: data.name,
            scope: scopes.join(" ") || "openid profile email",
            skip_consent:
                data.skipConsent === true && canSkipConsent(trustTier),
            enable_end_session: data.enableEndSession ?? true,
            client_secret_expires_at: 0,
            require_pkce: true,
            metadata: mergeTrustMetadata(
                {},
                {
                    trustTier,
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: session.user.id
                }
            ),
            ...(data.uri && { client_uri: data.uri }),
            ...(data.type === "public" && {
                token_endpoint_auth_method: "none"
            })
        }
    })

    return {
        clientId: result.client_id,
        clientSecret: result.client_secret ?? null,
        name: result.client_name ?? null
    }
}

export async function updateClient(
    id: string,
    data: {
        name?: string | null
        uri?: string | null
        icon?: string | null
        redirectUris?: string[]
        postLogoutRedirectUris?: string[] | null
        scopes?: string[] | null
        skipConsent?: boolean | null
        enableEndSession?: boolean | null
        requirePKCE?: boolean | null
        disabled?: boolean | null
        grantTypes?: string[] | null
        responseTypes?: string[] | null
        contacts?: string[] | null
        tos?: string | null
        policy?: string | null
        isPublic?: boolean | null
        trustTier?: TrustTier
    }
) {
    const session = await requireAdmin()

    const existing = await getClient(id)
    if (!existing) throw new Error("Client not found")

    const trustTier = data.trustTier ?? getTrustTier(existing.metadata)

    if (data.skipConsent === true && !canSkipConsent(trustTier)) {
        throw new Error(
            "Consent bypass is only allowed for first-party clients"
        )
    }

    if (
        data.grantTypes?.includes("client_credentials") &&
        !canUseClientCredentials(trustTier)
    ) {
        throw new Error(
            "client_credentials requires partner or first-party trust"
        )
    }

    if (data.scopes !== undefined && data.scopes !== null) {
        assertScopesForTier(data.scopes, trustTier)
    }

    const metadata =
        data.trustTier !== undefined
            ? mergeTrustMetadata(existing.metadata, {
                  trustTier: data.trustTier,
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: session.user.id
              })
            : undefined

    await db
        .update(oauthClients)
        .set({
            ...(data.name !== undefined && { name: data.name }),
            ...(data.uri !== undefined && { uri: data.uri }),
            ...(data.icon !== undefined && { icon: data.icon }),
            ...(data.redirectUris !== undefined && {
                redirectUris: data.redirectUris
            }),
            ...(data.postLogoutRedirectUris !== undefined && {
                postLogoutRedirectUris: data.postLogoutRedirectUris
            }),
            ...(data.scopes !== undefined && { scopes: data.scopes }),
            ...(data.skipConsent !== undefined && {
                skipConsent:
                    data.skipConsent === true
                        ? canSkipConsent(trustTier)
                        : data.skipConsent
            }),
            ...(data.enableEndSession !== undefined && {
                enableEndSession: data.enableEndSession
            }),
            ...(data.requirePKCE !== undefined && {
                requirePKCE: data.requirePKCE
            }),
            ...(data.disabled !== undefined && { disabled: data.disabled }),
            ...(data.grantTypes !== undefined && {
                grantTypes: data.grantTypes
            }),
            ...(data.responseTypes !== undefined && {
                responseTypes: data.responseTypes
            }),
            ...(data.contacts !== undefined && { contacts: data.contacts }),
            ...(data.tos !== undefined && { tos: data.tos }),
            ...(data.policy !== undefined && { policy: data.policy }),
            ...(data.isPublic !== undefined && {
                tokenEndpointAuthMethod: data.isPublic
                    ? "none"
                    : "client_secret_basic"
            }),
            ...(metadata !== undefined && { metadata }),
            updatedAt: new Date()
        })
        .where(eq(oauthClients.id, id))

    return { success: true }
}

export async function promoteClientTrustTier(id: string, trustTier: TrustTier) {
    if (!isTrustTier(trustTier)) throw new Error("Invalid trust tier")
    const session = await requireAdmin()

    const existing = await getClient(id)
    if (!existing) throw new Error("Client not found")

    const metadata = mergeTrustMetadata(existing.metadata, {
        trustTier,
        reviewedAt: new Date().toISOString(),
        reviewedBy: session.user.id
    })

    const nextScopes = filterScopesForTier(existing.scopes, trustTier)
    const nextGrantTypes = (existing.grantTypes ?? []).filter((gt) => {
        if (gt === "client_credentials")
            return canUseClientCredentials(trustTier)
        return true
    })

    await db
        .update(oauthClients)
        .set({
            metadata,
            scopes: nextScopes,
            grantTypes: nextGrantTypes,
            skipConsent: canSkipConsent(trustTier)
                ? existing.skipConsent
                : false,
            updatedAt: new Date()
        })
        .where(eq(oauthClients.id, id))

    return { success: true, trustTier }
}

export async function deleteClient(id: string) {
    await requireAdmin()
    await db.delete(oauthClients).where(eq(oauthClients.id, id))
    return { success: true }
}

export async function toggleClient(id: string, disabled: boolean) {
    await requireAdmin()
    await db
        .update(oauthClients)
        .set({ disabled, updatedAt: new Date() })
        .where(eq(oauthClients.id, id))
    return { success: true }
}

async function hashSecret(value: string): Promise<string> {
    const data = new TextEncoder().encode(value)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const bytes = new Uint8Array(hashBuffer)
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

export async function rotateClientSecret(clientId: string) {
    await requireAdmin()

    const { randomBytes } = await import("node:crypto")
    const newSecret = randomBytes(32).toString("base64url")
    const hashed = await hashSecret(newSecret)

    await db
        .update(oauthClients)
        .set({ clientSecret: hashed, updatedAt: new Date() })
        .where(eq(oauthClients.clientId, clientId))

    return { clientSecret: newSecret }
}
