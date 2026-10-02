import { randomBytes } from "node:crypto"
import Stripe from "stripe"

import {
    findPrice,
    getTrialDays,
    isPlaceholderPriceId,
    priceIdForProcessor
} from "../catalog"
import { isMockProviderId, processorLabel, stripeConfigured } from "../enabled"
import type { BillingProcessor, CheckoutInput } from "../processors"
import {
    authOrigin,
    idOf,
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

function randomLetters(length = 8) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz"
    return Array.from(randomBytes(length), (byte) => alphabet[byte % 26]).join(
        ""
    )
}

export async function ensureStripeCustomer(input: {
    userId: string
    email: string
    name?: string | null
}) {
    const existing = await getCustomerByUserId(input.userId, PROVIDER)
    if (existing && !isMockProviderId(existing.providerCustomerId)) {
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
    await assertCanStartCheckout(input.userId)

    const customerId = await ensureStripeCustomer(input)
    const trialDays = getTrialDays()
    const hadSubscription = await userHasSubscriptionHistory(input.userId)
    const stripe = getStripe()
    const origin = authOrigin()
    const session = await stripe.checkout.sessions.create({
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
        },
        integration_identifier: `idp-billing-${randomLetters()}`
    })

    if (!session.url) {
        throw new Error("Stripe did not return a checkout URL")
    }
    return session.url
}

export async function createPortalUrl(userId: string) {
    if (!stripeConfigured()) {
        throw new Error("Card billing is not configured")
    }
    const customer = await getCustomerByUserId(userId, PROVIDER)
    if (!customer || isMockProviderId(customer.providerCustomerId)) {
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

async function syncStripeSubscription(
    subscription: Stripe.Subscription,
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
