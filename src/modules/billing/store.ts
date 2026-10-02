import { and, desc, eq } from "drizzle-orm"

import { db } from "@/database/db"
import {
    billingCustomers,
    billingEntitlements,
    billingSubscriptions,
    billingWebhookEvents
} from "@/database/schema"

import { entitlementKeyForProduct, findPriceByProviderId } from "./catalog"
import { isMockProviderId, parseProcessorId, stripeConfigured } from "./enabled"
import { mapEntitlementStatus } from "./store-status"
import type {
    BillingEntitlement,
    BillingManageMode,
    BillingSubscription,
    BillingSubscriptionStatus,
    EntitlementClaims,
    EntitlementStatus
} from "./types"

export type BillingCustomerRow = typeof billingCustomers.$inferSelect
export type BillingSubscriptionRow = typeof billingSubscriptions.$inferSelect
export type BillingEntitlementRow = typeof billingEntitlements.$inferSelect

const OPEN_STATUSES = new Set<BillingSubscriptionStatus>([
    "active",
    "trialing",
    "past_due"
])

function asStatus(value: string): BillingSubscriptionStatus {
    switch (value) {
        case "incomplete":
        case "incomplete_expired":
        case "trialing":
        case "active":
        case "past_due":
        case "canceled":
        case "unpaid":
        case "paused":
            return value
        default:
            return "incomplete"
    }
}

export { mapEntitlementStatus } from "./store-status"

function toIso(value: Date | null) {
    return value ? value.toISOString() : null
}

export function serializeSubscription(
    row: BillingSubscriptionRow
): BillingSubscription {
    return {
        id: row.id,
        provider: parseProcessorId(row.provider) ?? "stripe",
        productKey: row.productKey,
        priceKey: row.priceKey,
        status: asStatus(row.status),
        currentPeriodStart: toIso(row.currentPeriodStart),
        currentPeriodEnd: toIso(row.currentPeriodEnd),
        cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
        canceledAt: toIso(row.canceledAt),
        endedAt: toIso(row.endedAt)
    }
}

export function serializeEntitlement(
    row: BillingEntitlementRow
): BillingEntitlement {
    return {
        key: row.key,
        status: row.status as EntitlementStatus,
        expiresAt: toIso(row.expiresAt)
    }
}

export async function getCustomerByUserId(userId: string, provider: string) {
    const rows = await db
        .select()
        .from(billingCustomers)
        .where(
            and(
                eq(billingCustomers.userId, userId),
                eq(billingCustomers.provider, provider)
            )
        )
        .limit(1)
    return rows[0] ?? null
}

export async function getCustomerByProviderId(
    provider: string,
    providerCustomerId: string
) {
    const rows = await db
        .select()
        .from(billingCustomers)
        .where(
            and(
                eq(billingCustomers.provider, provider),
                eq(billingCustomers.providerCustomerId, providerCustomerId)
            )
        )
        .limit(1)
    return rows[0] ?? null
}

export async function upsertCustomer(input: {
    userId: string
    provider: string
    providerCustomerId: string
}) {
    const existing = await getCustomerByUserId(input.userId, input.provider)
    const now = new Date()
    if (existing) {
        if (existing.providerCustomerId !== input.providerCustomerId) {
            await db
                .update(billingCustomers)
                .set({
                    providerCustomerId: input.providerCustomerId,
                    updatedAt: now
                })
                .where(eq(billingCustomers.id, existing.id))
        }
        return existing.id
    }

    const id = crypto.randomUUID()
    await db.insert(billingCustomers).values({
        id,
        userId: input.userId,
        provider: input.provider,
        providerCustomerId: input.providerCustomerId,
        createdAt: now,
        updatedAt: now
    })
    return id
}

export async function listSubscriptions(userId: string) {
    return db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.userId, userId))
        .orderBy(desc(billingSubscriptions.updatedAt))
}

export async function getOpenSubscription(userId: string) {
    const rows = await listSubscriptions(userId)
    return rows.find((row) => OPEN_STATUSES.has(asStatus(row.status))) ?? null
}

export async function userHasSubscriptionHistory(userId: string) {
    const rows = await listSubscriptions(userId)
    return rows.length > 0
}

export async function getSubscriptionByProviderId(
    provider: string,
    providerSubscriptionId: string
) {
    const rows = await db
        .select()
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.provider, provider),
                eq(
                    billingSubscriptions.providerSubscriptionId,
                    providerSubscriptionId
                )
            )
        )
        .limit(1)
    return rows[0] ?? null
}

export async function upsertSubscriptionFromProvider(input: {
    userId: string
    provider: string
    providerSubscriptionId: string
    providerPriceId: string | null
    productKey?: string
    priceKey?: string
    status: string
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
    canceledAt: Date | null
    endedAt: Date | null
}) {
    const matched = input.providerPriceId
        ? findPriceByProviderId(input.provider, input.providerPriceId)
        : null
    const productKey = input.productKey ?? matched?.product.key ?? "premium"
    const priceKey =
        input.priceKey ??
        matched?.price.key ??
        input.providerPriceId ??
        "unknown"
    const now = new Date()
    const existing = await getSubscriptionByProviderId(
        input.provider,
        input.providerSubscriptionId
    )

    const values = {
        userId: input.userId,
        provider: input.provider,
        providerSubscriptionId: input.providerSubscriptionId,
        productKey,
        priceKey,
        status: asStatus(input.status),
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        canceledAt: input.canceledAt,
        endedAt: input.endedAt,
        updatedAt: now
    }

    let id = existing?.id
    if (existing) {
        await db
            .update(billingSubscriptions)
            .set(values)
            .where(eq(billingSubscriptions.id, existing.id))
    } else {
        id = crypto.randomUUID()
        await db.insert(billingSubscriptions).values({
            id,
            ...values,
            createdAt: now
        })
    }

    await recomputeEntitlements(input.userId)
    return id
}

export async function recomputeEntitlements(userId: string) {
    const now = new Date()
    const subscriptions = await listSubscriptions(userId)
    const next = new Map<
        string,
        {
            status: EntitlementStatus
            expiresAt: Date | null
            sourceSubscriptionId: string
        }
    >()

    for (const subscription of subscriptions) {
        const entitlementKey = entitlementKeyForProduct(subscription.productKey)
        const status = mapEntitlementStatus(
            subscription.status,
            subscription.currentPeriodEnd,
            now
        )
        if (status === "expired") continue
        const current = next.get(entitlementKey)
        if (!current || (current.status === "grace" && status === "active")) {
            next.set(entitlementKey, {
                status,
                expiresAt: subscription.currentPeriodEnd,
                sourceSubscriptionId: subscription.id
            })
        }
    }

    const existing = await db
        .select()
        .from(billingEntitlements)
        .where(eq(billingEntitlements.userId, userId))

    const seen = new Set<string>()
    for (const [key, value] of next) {
        seen.add(key)
        const row = existing.find((item) => item.key === key)
        const payload = {
            status: value.status,
            expiresAt: value.expiresAt,
            sourceSubscriptionId: value.sourceSubscriptionId,
            updatedAt: now
        }
        if (row) {
            await db
                .update(billingEntitlements)
                .set(payload)
                .where(eq(billingEntitlements.id, row.id))
        } else {
            await db.insert(billingEntitlements).values({
                id: crypto.randomUUID(),
                userId,
                key,
                ...payload,
                createdAt: now
            })
        }
    }

    for (const row of existing) {
        if (seen.has(row.key)) continue
        await db
            .update(billingEntitlements)
            .set({
                status: "expired",
                updatedAt: now
            })
            .where(eq(billingEntitlements.id, row.id))
    }
}

export async function listLiveEntitlements(userId: string) {
    const now = new Date()
    const rows = await db
        .select()
        .from(billingEntitlements)
        .where(eq(billingEntitlements.userId, userId))

    return rows.filter((row) => {
        if (row.status !== "active" && row.status !== "grace") return false
        if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
            return false
        }
        return true
    })
}

export async function getEntitlementClaims(
    userId: string
): Promise<EntitlementClaims> {
    try {
        const entitlements = await listLiveEntitlements(userId)
        const keys = entitlements.map((row) => row.key)
        const primary = entitlements[0]
        return {
            entitlements: keys,
            subscription: primary
                ? {
                      status: primary.status as EntitlementStatus,
                      product: primary.key,
                      currentPeriodEnd: toIso(primary.expiresAt)
                  }
                : null
        }
    } catch {
        return { entitlements: [], subscription: null }
    }
}

export async function getAccountBilling(userId: string) {
    const [subscriptionRows, entitlementRows] = await Promise.all([
        listSubscriptions(userId),
        listLiveEntitlements(userId)
    ])
    const current =
        subscriptionRows.find((row) =>
            OPEN_STATUSES.has(asStatus(row.status))
        ) ??
        subscriptionRows.find(
            (row) =>
                mapEntitlementStatus(row.status, row.currentPeriodEnd) !==
                "expired"
        ) ??
        null

    return {
        subscription: current ? serializeSubscription(current) : null,
        entitlements: entitlementRows.map(serializeEntitlement),
        manageMode: manageModeForSubscription(current)
    }
}

export function manageModeForSubscription(
    row: BillingSubscriptionRow | null
): BillingManageMode | null {
    if (!row || !OPEN_STATUSES.has(asStatus(row.status))) return null
    if (
        row.provider === "stripe" &&
        stripeConfigured() &&
        !isMockProviderId(row.providerSubscriptionId)
    ) {
        return "portal"
    }
    return "cancel"
}

export async function assertCanStartCheckout(userId: string) {
    const open = await getOpenSubscription(userId)
    const live = await listLiveEntitlements(userId)
    if (open || live.length > 0) {
        throw new Error("An active subscription already exists")
    }
}

export async function cancelSubscriptionInStore(input: {
    userId: string
    provider: string
    atPeriodEnd: boolean
}) {
    const open = await getOpenSubscription(input.userId)
    if (!open || open.provider !== input.provider) {
        throw new Error("No matching subscription to cancel")
    }
    const now = new Date()
    if (input.atPeriodEnd) {
        await db
            .update(billingSubscriptions)
            .set({
                cancelAtPeriodEnd: true,
                canceledAt: now,
                updatedAt: now
            })
            .where(eq(billingSubscriptions.id, open.id))
    } else {
        await db
            .update(billingSubscriptions)
            .set({
                status: "canceled",
                cancelAtPeriodEnd: false,
                canceledAt: now,
                endedAt: now,
                currentPeriodEnd: now,
                updatedAt: now
            })
            .where(eq(billingSubscriptions.id, open.id))
    }
    await recomputeEntitlements(input.userId)
}

export async function webhookEventSeen(provider: string, eventId: string) {
    const rows = await db
        .select({ id: billingWebhookEvents.id })
        .from(billingWebhookEvents)
        .where(
            and(
                eq(billingWebhookEvents.provider, provider),
                eq(billingWebhookEvents.eventId, eventId)
            )
        )
        .limit(1)
    return rows.length > 0
}

export async function recordWebhookEvent(provider: string, eventId: string) {
    if (await webhookEventSeen(provider, eventId)) return
    await db.insert(billingWebhookEvents).values({
        id: crypto.randomUUID(),
        provider,
        eventId,
        createdAt: new Date()
    })
}
