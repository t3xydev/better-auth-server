export type BillingInterval = "monthly" | "yearly"

export type BillingProcessorId = "stripe" | "zoneless"

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

export type BillingMethod = {
    id: BillingProcessorId
    label: string
    configured: boolean
    mock: boolean
}

export type BillingCatalog = {
    enabled: boolean
    configured: boolean
    /** True when `next dev` is filling missing Price IDs with placeholders. */
    placeholders: boolean
    trialDays: number | null
    defaultProvider: BillingProcessorId
    methods: BillingMethod[]
    products: BillingProduct[]
}

export type BillingSubscription = {
    id: string
    provider: BillingProcessorId
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

export type BillingManageMode = "portal" | "cancel"
