import { eq } from "drizzle-orm"
import Stripe from "stripe"

import { db } from "@/database/db"
import { users } from "@/database/schema"
import {
    findPrice,
    isPlaceholderPriceId,
    priceIdForProcessor
} from "../catalog"
import { isMockProviderId, processorLabel, stripeConfigured } from "../enabled"
import type {
    BillingProcessor,
    CheckoutInput,
    PortalInput
} from "../processors"
import {
    authOrigin,
    billingMirrorFromStripeSubscription,
    idOf
} from "../shared"
import {
    assertCanStartCheckout,
    getCustomerByProviderId,
    getCustomerByUserId,
    getOpenSubscription,
    recordWebhookEvent,
    upsertCustomer,
    upsertSubscriptionFromProvider,
    webhookEventSeen
} from "../store"
import { annualForInterval } from "../stripe-plans"

const PROVIDER = "stripe" as const

let stripeClient: Stripe | null = null

export function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY?.trim()
    if (!key) {
        throw new Error("STRIPE_SECRET_KEY is not set")
    }
    if (!stripeClient) {
        stripeClient = new Stripe(key)
    }
    return stripeClient
}

async function reuseStripeCustomerOnUser(userId: string) {
    const existing = await getCustomerByUserId(userId, PROVIDER)
    if (!existing || isMockProviderId(existing.providerCustomerId)) return
    await db
        .update(users)
        .set({ stripeCustomerId: existing.providerCustomerId })
        .where(eq(users.id, userId))
}

type CardSubscriptionApi = {
    upgradeSubscription: (input: {
        body: {
            plan: string
            annual: boolean
            successUrl: string
            cancelUrl: string
            disableRedirect: true
        }
        headers: Headers
        query: { disableCookieCache: true }
    }) => Promise<{ url?: string | null }>
    createBillingPortal: (input: {
        body: {
            returnUrl: string
            disableRedirect: true
        }
        headers: Headers
        query: { disableCookieCache: true }
    }) => Promise<{ url?: string | null }>
}

async function cardSubscriptionApi() {
    const { auth } = await import("@/lib/auth")
    return auth.api as typeof auth.api & CardSubscriptionApi
}

export async function createCheckoutUrl(input: CheckoutInput) {
    if (!stripeConfigured()) {
        throw new Error("Card billing is not configured")
    }
    const matched = findPrice(input.priceKey)
    if (!matched) {
        throw new Error("Unknown price")
    }
    const priceId = priceIdForProcessor(matched.price, PROVIDER)
    if (!priceId || isPlaceholderPriceId(priceId)) {
        throw new Error(
            "This plan is a development placeholder. Set Stripe Price IDs to enable checkout."
        )
    }
    if (!input.headers) {
        throw new Error("Missing session for card checkout")
    }
    await assertCanStartCheckout(input.userId)
    await reuseStripeCustomerOnUser(input.userId)

    const origin = authOrigin()
    const api = await cardSubscriptionApi()
    const result = await api.upgradeSubscription({
        body: {
            plan: matched.product.key,
            annual: annualForInterval(matched.price.interval),
            successUrl: `${origin}/account/billing?checkout=success`,
            cancelUrl: `${origin}/account/billing?checkout=canceled`,
            disableRedirect: true
        },
        headers: input.headers,
        query: { disableCookieCache: true }
    })
    if (!result.url) {
        throw new Error("Stripe did not return a checkout URL")
    }
    return result.url
}

export async function createPortalUrl(input: PortalInput) {
    if (!stripeConfigured()) {
        throw new Error("Card billing is not configured")
    }
    if (!input.headers) {
        throw new Error("Missing session for the billing portal")
    }
    const customer = await getCustomerByUserId(input.userId, PROVIDER)
    if (!customer || isMockProviderId(customer.providerCustomerId)) {
        throw new Error("No billing customer")
    }
    await reuseStripeCustomerOnUser(input.userId)

    const api = await cardSubscriptionApi()
    const result = await api.createBillingPortal({
        body: {
            returnUrl: `${authOrigin()}/account/billing`,
            disableRedirect: true
        },
        headers: input.headers,
        query: { disableCookieCache: true }
    })
    if (!result.url) {
        throw new Error("Stripe did not return a billing portal URL")
    }
    return result.url
}

async function cancelStripeSubscription(input: {
    userId: string
    atPeriodEnd: boolean
}) {
    const open = await getOpenSubscription(input.userId)
    if (!open || open.provider !== PROVIDER) {
        throw new Error("No matching subscription to cancel")
    }
    if (isMockProviderId(open.providerSubscriptionId)) {
        throw new Error("Mock subscriptions cannot be canceled through Stripe")
    }
    const stripe = getStripe()
    if (input.atPeriodEnd) {
        await stripe.subscriptions.update(open.providerSubscriptionId, {
            cancel_at_period_end: true
        })
        return
    }
    await stripe.subscriptions.cancel(open.providerSubscriptionId)
}

export async function syncStripeSubscription(
    subscription: Stripe.Subscription,
    fallbackUserId?: string | null
) {
    const mirrored = billingMirrorFromStripeSubscription(
        subscription,
        fallbackUserId
    )
    let userId = mirrored.userId
    if (!userId && mirrored.providerCustomerId) {
        const linked = await getCustomerByProviderId(
            PROVIDER,
            mirrored.providerCustomerId
        )
        userId = linked?.userId ?? null
    }
    if (!userId) return

    if (mirrored.providerCustomerId) {
        await upsertCustomer({
            userId,
            provider: PROVIDER,
            providerCustomerId: mirrored.providerCustomerId
        })
    }

    await upsertSubscriptionFromProvider({
        userId,
        provider: PROVIDER,
        providerSubscriptionId: mirrored.providerSubscriptionId,
        providerPriceId: mirrored.providerPriceId,
        status: mirrored.status,
        currentPeriodStart: mirrored.currentPeriodStart,
        currentPeriodEnd: mirrored.currentPeriodEnd,
        cancelAtPeriodEnd: mirrored.cancelAtPeriodEnd,
        canceledAt: mirrored.canceledAt,
        endedAt: mirrored.endedAt
    })
}

async function retrieveAndSyncSubscription(
    subscriptionId: string,
    fallbackUserId?: string | null
) {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await syncStripeSubscription(subscription, fallbackUserId)
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
    if (invoice.parent?.type !== "subscription_details") return null
    return idOf(invoice.parent.subscription_details?.subscription)
}

export async function handleStripeEvent(event: Stripe.Event) {
    if (await webhookEventSeen(PROVIDER, event.id)) return
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session
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
            await syncStripeSubscription(
                event.data.object as Stripe.Subscription
            )
            break
        }
        case "invoice.paid":
        case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice
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

export async function constructStripeEvent(payload: string, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    if (!secret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not set")
    }
    const stripe = getStripe()
    return stripe.webhooks.constructEventAsync(payload, signature, secret)
}

export const stripeProcessor: BillingProcessor = {
    id: PROVIDER,
    label: processorLabel(PROVIDER),
    configured: stripeConfigured,
    createCheckoutUrl,
    createPortalUrl,
    cancel: cancelStripeSubscription
}
