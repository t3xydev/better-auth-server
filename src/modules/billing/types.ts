export type BillingInterval = "monthly" | "yearly"

export type BillingSubscriptionStatus =
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused"

export type EntitlementStatus = "active" | "grace" | "expired"

export type BillingPrice = {
    key: string
    interval: BillingInterval
}

export type BillingProduct = {
    key: string
    name: string
    description: string
    entitlementKey: string
    prices: BillingPrice[]
}

export type BillingCatalog = {
    enabled: boolean
    configured: boolean
    /** True when `next dev` is filling missing Price IDs with placeholders. */
    placeholders: boolean
    trialDays: number | null
    products: BillingProduct[]
}

export type BillingSubscription = {
    id: string
    productKey: string
    priceKey: string
    status: BillingSubscriptionStatus
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    canceledAt: string | null
    endedAt: string | null
}

export type BillingEntitlement = {
    key: string
    status: EntitlementStatus
    expiresAt: string | null
}

export type EntitlementClaims = {
    entitlements: string[]
    subscription: {
        status: EntitlementStatus
        product: string
        currentPeriodEnd: string | null
    } | null
}
