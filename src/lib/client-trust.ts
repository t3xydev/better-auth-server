/**
 * Client privilege and trust model.
 * @see docs/framework/client-trust-model.mdx
 */

export const TRUST_TIERS = [
    "unknown",
    "developer",
    "verified",
    "partner",
    "first_party"
] as const

export type TrustTier = (typeof TRUST_TIERS)[number]

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
    unknown: "Unverified application",
    developer: "Registered developer",
    verified: "Verified application",
    partner: "Trusted partner",
    first_party: "First-party"
}

/** Higher number = more privilege. */
export const TRUST_TIER_RANK: Record<TrustTier, number> = {
    unknown: 0,
    developer: 1,
    verified: 2,
    partner: 3,
    first_party: 4
}

/** Scopes advertised / enforceable by this auth server today. */
export const PROVIDER_SCOPES = [
    "openid",
    "profile",
    "email",
    "entitlements",
    "offline_access"
] as const

export type ProviderScope = (typeof PROVIDER_SCOPES)[number]

/**
 * Minimum trust tier required for a client to be *assigned* the scope.
 * Runtime still requires user consent (except first-party skipConsent).
 */
export const SCOPE_MIN_TIER: Record<ProviderScope, TrustTier> = {
    openid: "unknown",
    profile: "unknown",
    email: "unknown",
    entitlements: "unknown",
    offline_access: "verified"
}

/** Safe for dynamic client registration (Tier 0). */
export const PUBLIC_SCOPES = PROVIDER_SCOPES.filter(
    (s) => TRUST_TIER_RANK[SCOPE_MIN_TIER[s]] <= TRUST_TIER_RANK.unknown
)

export const DCR_DEFAULT_SCOPES = ["openid", "profile"] as const

export type ClientTrustMetadata = {
    trustTier: TrustTier
    verifiedDomain?: string
    reviewedAt?: string
    reviewedBy?: string
    riskLevel?: "standard" | "elevated" | "restricted"
}

export function isTrustTier(value: unknown): value is TrustTier {
    return (
        typeof value === "string" &&
        (TRUST_TIERS as readonly string[]).includes(value)
    )
}

export function parseClientMetadata(raw: unknown): Record<string, unknown> {
    if (raw == null) return {}
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw) as unknown
            return parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {}
        } catch {
            return {}
        }
    }
    if (typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Record<string, unknown>
    }
    return {}
}

export function getTrustTier(metadata: unknown): TrustTier {
    const tier = parseClientMetadata(metadata).trustTier
    return isTrustTier(tier) ? tier : "unknown"
}

export function isUnverifiedClient(tier: TrustTier): boolean {
    return TRUST_TIER_RANK[tier] < TRUST_TIER_RANK.verified
}

export function canSkipConsent(tier: TrustTier): boolean {
    return tier === "first_party"
}

export function canUseClientCredentials(tier: TrustTier): boolean {
    return TRUST_TIER_RANK[tier] >= TRUST_TIER_RANK.partner
}

export function scopesAllowedForTier(tier: TrustTier): ProviderScope[] {
    const rank = TRUST_TIER_RANK[tier]
    return PROVIDER_SCOPES.filter(
        (s) => TRUST_TIER_RANK[SCOPE_MIN_TIER[s]] <= rank
    )
}

export function filterScopesForTier(
    scopes: string[] | null | undefined,
    tier: TrustTier
): string[] {
    const allowed = new Set(scopesAllowedForTier(tier))
    return (scopes ?? []).filter((s) => allowed.has(s as ProviderScope))
}

export function assertScopesForTier(
    scopes: string[] | null | undefined,
    tier: TrustTier
): void {
    const allowed = new Set(scopesAllowedForTier(tier))
    for (const scope of scopes ?? []) {
        if (!allowed.has(scope as ProviderScope)) {
            throw new Error(
                `Scope "${scope}" requires trust tier "${SCOPE_MIN_TIER[scope as ProviderScope] ?? "higher"}" (client is "${tier}")`
            )
        }
    }
}

export function unknownClientMetadata(
    extras?: Partial<ClientTrustMetadata>
): ClientTrustMetadata {
    return {
        trustTier: "unknown",
        riskLevel: "standard",
        ...extras
    }
}

export function mergeTrustMetadata(
    existing: unknown,
    patch: Partial<ClientTrustMetadata>
): ClientTrustMetadata {
    const current = parseClientMetadata(existing)
    const tier = isTrustTier(patch.trustTier)
        ? patch.trustTier
        : getTrustTier(current)

    return {
        trustTier: tier,
        verifiedDomain:
            patch.verifiedDomain !== undefined
                ? patch.verifiedDomain
                : typeof current.verifiedDomain === "string"
                  ? current.verifiedDomain
                  : undefined,
        reviewedAt:
            patch.reviewedAt !== undefined
                ? patch.reviewedAt
                : typeof current.reviewedAt === "string"
                  ? current.reviewedAt
                  : undefined,
        reviewedBy:
            patch.reviewedBy !== undefined
                ? patch.reviewedBy
                : typeof current.reviewedBy === "string"
                  ? current.reviewedBy
                  : undefined,
        riskLevel:
            patch.riskLevel !== undefined
                ? patch.riskLevel
                : current.riskLevel === "elevated" ||
                    current.riskLevel === "restricted" ||
                    current.riskLevel === "standard"
                  ? current.riskLevel
                  : "standard"
    }
}
