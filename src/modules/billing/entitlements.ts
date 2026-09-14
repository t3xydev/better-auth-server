import { billingEnabled } from "./enabled"
import type { EntitlementClaims } from "./types"

export async function entitlementClaimsForUser(
    userId: string | undefined,
    scopes?: string[] | null
): Promise<Partial<EntitlementClaims>> {
    if (!billingEnabled || !userId) return {}
    if (scopes && !scopes.includes("entitlements")) return {}
    const { getEntitlementClaims } = await import("./store")
    return getEntitlementClaims(userId)
}
