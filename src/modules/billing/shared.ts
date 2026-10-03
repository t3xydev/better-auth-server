import type { BillingInterval } from "./types"

export function authOrigin() {
    return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(
        /\/$/,
        ""
    )
}

export function normalizeZonelessApiUrl(value: string) {
    return value.trim().replace(/\/+$/, "").replace(/\/v1$/i, "")
}

export function unixToDate(value: number | null | undefined) {
    return typeof value === "number" ? new Date(value * 1000) : null
}

export function idOf(
    value: string | { id: string } | null | undefined
): string | null {
    if (!value) return null
    return typeof value === "string" ? value : value.id
}

export function periodForPrice(
    interval: BillingInterval,
    trialDays: number | null,
    hadHistory: boolean,
    now = new Date()
) {
    const start = now
    const end = new Date(now.getTime())
    if (!hadHistory && trialDays) {
        end.setUTCDate(end.getUTCDate() + trialDays)
    } else if (interval === "yearly") {
        end.setUTCFullYear(end.getUTCFullYear() + 1)
    } else {
        end.setUTCMonth(end.getUTCMonth() + 1)
    }
    return { start, end }
}

export type StripeShapedSubscription = {
    id: string
    status: string
    customer?: string | { id: string } | null
    metadata?: Record<string, string> | null
    cancel_at_period_end?: boolean | null
    canceled_at?: number | null
    ended_at?: number | null
    items?: {
        data?: Array<{
            current_period_start?: number | null
            current_period_end?: number | null
            price?: string | { id: string } | null
        }>
    }
}

export function periodFromSubscription(subscription: StripeShapedSubscription) {
    const item = subscription.items?.data?.[0]
    return {
        start: unixToDate(item?.current_period_start),
        end: unixToDate(item?.current_period_end)
    }
}

export function priceIdFromSubscription(
    subscription: StripeShapedSubscription
) {
    const price = subscription.items?.data?.[0]?.price
    if (!price) return null
    return typeof price === "string" ? price : price.id
}

/** Fields the card adapter writes into the shared billing tables. */
export function billingMirrorFromStripeSubscription(
    subscription: StripeShapedSubscription,
    fallbackUserId?: string | null
) {
    const period = periodFromSubscription(subscription)
    return {
        userId: subscription.metadata?.userId || fallbackUserId || null,
        providerCustomerId: idOf(subscription.customer),
        providerSubscriptionId: subscription.id,
        providerPriceId: priceIdFromSubscription(subscription),
        status: subscription.status,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        canceledAt: unixToDate(subscription.canceled_at),
        endedAt: unixToDate(subscription.ended_at)
    }
}
