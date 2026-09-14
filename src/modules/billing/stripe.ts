import { randomBytes } from "node:crypto"
import Stripe from "stripe"

import { findPrice, getTrialDays, isPlaceholderPriceId } from "./catalog"
import { billingConfigured } from "./enabled"
import {
    getCustomerByProviderId,
    getCustomerByUserId,
    getOpenSubscription,
    listLiveEntitlements,
    upsertCustomer,
    upsertSubscriptionFromProvider,
    userHasSubscriptionHistory
} from "./store"

const PROVIDER = "stripe"

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

function authOrigin() {
    return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(
        /\/$/,
        ""
    )
}

function randomLetters(length = 8) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz"
    return Array.from(randomBytes(length), (byte) => alphabet[byte % 26]).join(
        ""
    )
}

function unixToDate(value: number | null | undefined) {
    return typeof value === "number" ? new Date(value * 1000) : null
}

function customerIdOf(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
    if (!customer) return null
    return typeof customer === "string" ? customer : customer.id
}

function subscriptionIdOf(
    subscription: string | Stripe.Subscription | null | undefined
) {
    if (!subscription) return null
    return typeof subscription === "string" ? subscription : subscription.id
}

function periodFromSubscription(subscription: Stripe.Subscription) {
    const item = subscription.items.data[0]
    return {
        start: unixToDate(item?.current_period_start),
        end: unixToDate(item?.current_period_end)
    }
}

function priceIdFromSubscription(subscription: Stripe.Subscription) {
    const price = subscription.items.data[0]?.price
    if (!price) return null
    return typeof price === "string" ? price : price.id
}

export async function ensureStripeCustomer(input: {
    userId: string
    email: string
    name?: string | null
}) {
    const existing = await getCustomerByUserId(input.userId)
    if (existing?.provider === PROVIDER) {
        return existing.providerCustomerId
    }

    const stripe = getStripe()
    const customer = await stripe.customers.create({
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

export async function createCheckoutUrl(input: {
    userId: string
    email: string
    name?: string | null
    priceKey: string
}) {
    if (!billingConfigured()) {
        throw new Error("Billing is not configured")
    }
    const matched = findPrice(input.priceKey)
    if (!matched) {
        throw new Error("Unknown price")
    }
    if (isPlaceholderPriceId(matched.price.priceId)) {
        throw new Error(
            "This plan is a development placeholder. Set Stripe Price IDs to enable checkout."
        )
    }
    const open = await getOpenSubscription(input.userId)
    const live = await listLiveEntitlements(input.userId)
    if (open || live.length > 0) {
        throw new Error("An active subscription already exists")
    }

    const customerId = await ensureStripeCustomer(input)
    const trialDays = getTrialDays()
    const hadSubscription = await userHasSubscriptionHistory(input.userId)
    const stripe = getStripe()
    const origin = authOrigin()
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: input.userId,
        line_items: [{ price: matched.price.priceId, quantity: 1 }],
        success_url: `${origin}/account/billing?checkout=success`,
        cancel_url: `${origin}/account/billing?checkout=canceled`,
        metadata: { userId: input.userId },
        subscription_data: {
            metadata: { userId: input.userId },
            ...(!hadSubscription && trialDays
                ? { trial_period_days: trialDays }
                : {})
        },
        integration_identifier: `idp-billing-${randomLetters()}`
    })

    if (!session.url) {
        throw new Error("Stripe did not return a checkout URL")
    }
    return session.url
}

export async function createPortalUrl(userId: string) {
    if (!billingConfigured()) {
        throw new Error("Billing is not configured")
    }
    const customer = await getCustomerByUserId(userId)
    if (!customer) {
        throw new Error("No billing customer")
    }
    const stripe = getStripe()
    const origin = authOrigin()
    const session = await stripe.billingPortal.sessions.create({
        customer: customer.providerCustomerId,
        return_url: `${origin}/account/billing`
    })
    return session.url
}

async function syncStripeSubscription(
    subscription: Stripe.Subscription,
    fallbackUserId?: string | null
) {
    const customerId = customerIdOf(subscription.customer)
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
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await syncStripeSubscription(subscription, fallbackUserId)
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
    if (invoice.parent?.type !== "subscription_details") return null
    return subscriptionIdOf(invoice.parent.subscription_details?.subscription)
}

export async function handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session
            if (session.mode !== "subscription") return
            const subscriptionId = subscriptionIdOf(session.subscription)
            const userId =
                session.metadata?.userId || session.client_reference_id
            if (session.customer) {
                const customerId = customerIdOf(session.customer)
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
            return
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
            await syncStripeSubscription(
                event.data.object as Stripe.Subscription
            )
            return
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
            return
        }
        default:
            return
    }
}

export async function constructStripeEvent(payload: string, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    if (!secret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not set")
    }
    const stripe = getStripe()
    return stripe.webhooks.constructEventAsync(payload, signature, secret)
}
