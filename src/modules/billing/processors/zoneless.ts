import {
    type CheckoutSession,
    type Invoice,
    type Subscription,
    Zoneless,
    type Event as ZonelessEvent
} from "@zoneless/node"

import { findPrice, getTrialDays, priceIdForProcessor } from "../catalog"
import {
    isMockProviderId,
    processorLabel,
    zonelessConfigured
} from "../enabled"
import type { BillingProcessor, CheckoutInput } from "../processors"
import {
    authOrigin,
    idOf,
    normalizeZonelessApiUrl,
    periodFromSubscription,
    priceIdFromSubscription,
    unixToDate
} from "../shared"
import {
    assertCanStartCheckout,
    getCustomerByProviderId,
    getCustomerByUserId,
    getOpenSubscription,
    recordWebhookEvent,
    upsertCustomer,
    upsertSubscriptionFromProvider,
    userHasSubscriptionHistory,
    webhookEventSeen
} from "../store"

const PROVIDER = "zoneless" as const

let zonelessClient: Zoneless | null = null
let cachedApiKey = ""
let cachedApiUrl = ""

export function zonelessApiUrl() {
    const url = normalizeZonelessApiUrl(
        process.env.ZONELESS_API_URL?.trim() || ""
    )
    if (!url) {
        throw new Error("ZONELESS_API_URL is not set")
    }
    return url
}

export function getZoneless() {
    const key = process.env.ZONELESS_API_KEY?.trim()
    if (!key) {
        throw new Error("ZONELESS_API_KEY is not set")
    }
    const url = zonelessApiUrl()
    if (!zonelessClient || cachedApiKey !== key || cachedApiUrl !== url) {
        zonelessClient = new Zoneless(key, url)
        cachedApiKey = key
        cachedApiUrl = url
    }
    return zonelessClient
}

export async function ensureZonelessCustomer(input: {
    userId: string
    email: string
    name?: string | null
}) {
    const existing = await getCustomerByUserId(input.userId, PROVIDER)
    if (existing && !isMockProviderId(existing.providerCustomerId)) {
        return existing.providerCustomerId
    }

    const zoneless = getZoneless()
    const customer = await zoneless.customers.create({
        email: input.email,
        name: input.name || undefined,
        metadata: { userId: input.userId }
    })
    await upsertCustomer({
        userId: input.userId,
        provider: PROVIDER,
        providerCustomerId: customer.id
    })
    return customer.id
}

export async function createCheckoutUrl(input: CheckoutInput) {
    if (!zonelessConfigured()) {
        throw new Error("USDC billing is not configured")
    }
    const matched = findPrice(input.priceKey)
    if (!matched) {
        throw new Error("Unknown price")
    }
    const priceId = priceIdForProcessor(matched.price, PROVIDER)
    if (!priceId) {
        throw new Error("Set Zoneless Price IDs to enable USDC checkout.")
    }
    await assertCanStartCheckout(input.userId)

    const customerId = await ensureZonelessCustomer(input)
    const trialDays = getTrialDays()
    const hadSubscription = await userHasSubscriptionHistory(input.userId)
    const zoneless = getZoneless()
    const origin = authOrigin()
    const session = await zoneless.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: input.userId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/account/billing?checkout=success`,
        cancel_url: `${origin}/account/billing?checkout=canceled`,
        metadata: { userId: input.userId },
        subscription_data: {
            metadata: { userId: input.userId },
            ...(!hadSubscription && trialDays
                ? { trial_period_days: trialDays }
                : {})
        }
    })

    if (!session.url) {
        throw new Error("Zoneless did not return a checkout URL")
    }
    return session.url
}

async function cancelZonelessSubscription(input: {
    userId: string
    atPeriodEnd: boolean
}) {
    const open = await getOpenSubscription(input.userId)
    if (!open || open.provider !== PROVIDER) {
        throw new Error("No matching subscription to cancel")
    }
    if (isMockProviderId(open.providerSubscriptionId)) {
        throw new Error(
            "Mock subscriptions cannot be canceled through Zoneless"
        )
    }
    const zoneless = getZoneless()
    if (input.atPeriodEnd) {
        await zoneless.subscriptions.update(open.providerSubscriptionId, {
            cancel_at_period_end: true
        })
        return
    }
    await zoneless.subscriptions.cancel(open.providerSubscriptionId)
}

async function syncZonelessSubscription(
    subscription: Subscription,
    fallbackUserId?: string | null
) {
    const customerId = idOf(subscription.customer)
    const metadataUserId = subscription.metadata?.userId || fallbackUserId
    let userId = metadataUserId || null
    if (!userId && customerId) {
        const linked = await getCustomerByProviderId(PROVIDER, customerId)
        userId = linked?.userId ?? null
    }
    if (!userId) return

    if (customerId) {
        await upsertCustomer({
            userId,
            provider: PROVIDER,
            providerCustomerId: customerId
        })
    }

    const period = periodFromSubscription(subscription)
    await upsertSubscriptionFromProvider({
        userId,
        provider: PROVIDER,
        providerSubscriptionId: subscription.id,
        providerPriceId: priceIdFromSubscription(subscription),
        status: subscription.status,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        canceledAt: unixToDate(subscription.canceled_at),
        endedAt: unixToDate(subscription.ended_at)
    })
}

async function retrieveAndSyncSubscription(
    subscriptionId: string,
    fallbackUserId?: string | null
) {
    const zoneless = getZoneless()
    const subscription = await zoneless.subscriptions.retrieve(subscriptionId)
    await syncZonelessSubscription(subscription, fallbackUserId)
}

function subscriptionIdFromInvoice(invoice: Invoice) {
    if (invoice.parent?.type !== "subscription_details") return null
    return idOf(invoice.parent.subscription_details?.subscription)
}

export async function handleZonelessEvent(event: ZonelessEvent) {
    if (await webhookEventSeen(PROVIDER, event.id)) return
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as CheckoutSession
            if (session.mode !== "subscription") break
            const subscriptionId = idOf(session.subscription)
            const userId =
                session.metadata?.userId || session.client_reference_id
            if (session.customer) {
                const customerId = idOf(session.customer)
                if (customerId && userId) {
                    await upsertCustomer({
                        userId,
                        provider: PROVIDER,
                        providerCustomerId: customerId
                    })
                }
            }
            if (subscriptionId) {
                await retrieveAndSyncSubscription(subscriptionId, userId)
            }
            break
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
            await syncZonelessSubscription(event.data.object as Subscription)
            break
        }
        case "invoice.paid":
        case "invoice.payment_failed": {
            const invoice = event.data.object as Invoice
            const subscriptionId = subscriptionIdFromInvoice(invoice)
            const userId =
                invoice.parent?.subscription_details?.metadata?.userId
            if (subscriptionId) {
                await retrieveAndSyncSubscription(subscriptionId, userId)
            }
            break
        }
        default:
            break
    }
    await recordWebhookEvent(PROVIDER, event.id)
}

export function constructZonelessEvent(payload: string, signature: string) {
    const secret = process.env.ZONELESS_WEBHOOK_SECRET?.trim()
    if (!secret) {
        throw new Error("ZONELESS_WEBHOOK_SECRET is not set")
    }
    const zoneless = getZoneless()
    return zoneless.webhooks.constructEvent(payload, signature, secret)
}

export const zonelessProcessor: BillingProcessor = {
    id: PROVIDER,
    label: processorLabel(PROVIDER),
    configured: zonelessConfigured,
    createCheckoutUrl,
    cancel: cancelZonelessSubscription
}
