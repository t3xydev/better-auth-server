import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"

import { getCatalogProducts, getTrialDays } from "./catalog"
import { billingEnabled } from "./enabled"
import {
    getStripe,
    handleStripeEvent,
    syncStripeSubscription
} from "./processors/stripe"
import { upsertCustomer, userHasSubscriptionHistory } from "./store"
import { stripePlansFromCatalog } from "./stripe-plans"

const PLACEHOLDER_SECRET_KEY = "sk_test_placeholder"
const PLACEHOLDER_WEBHOOK_SECRET = "whsec_placeholder"

function env(name: string) {
    return process.env[name]?.trim() || ""
}

/** Live card billing, or schema generation so the plugin tables stay in the Drizzle schema. */
export function stripePluginActive() {
    if (process.env.AUTH_GENERATE === "1") return true
    return (
        billingEnabled &&
        Boolean(env("STRIPE_SECRET_KEY")) &&
        Boolean(env("STRIPE_WEBHOOK_SECRET"))
    )
}

export function stripeAuthPlugin() {
    if (!stripePluginActive()) return null

    const key = env("STRIPE_SECRET_KEY")
    const webhookSecret = env("STRIPE_WEBHOOK_SECRET")
    const stripeClient = key ? getStripe() : new Stripe(PLACEHOLDER_SECRET_KEY)

    return stripe({
        stripeClient,
        stripeWebhookSecret: webhookSecret || PLACEHOLDER_WEBHOOK_SECRET,
        createCustomerOnSignUp: false,
        onCustomerCreate: async ({ stripeCustomer, user }) => {
            await upsertCustomer({
                userId: user.id,
                provider: "stripe",
                providerCustomerId: stripeCustomer.id
            })
        },
        onEvent: async (event) => {
            if (
                event.type === "invoice.paid" ||
                event.type === "invoice.payment_failed"
            ) {
                await handleStripeEvent(event)
            }
        },
        subscription: {
            enabled: true,
            plans: () => stripePlansFromCatalog(getCatalogProducts()),
            getCheckoutSessionParams: async ({ user }) => {
                const trialDays = getTrialDays()
                if (!trialDays) return {}
                const hadSubscription = await userHasSubscriptionHistory(
                    user.id
                )
                if (hadSubscription) return {}
                return {
                    params: {
                        subscription_data: {
                            trial_period_days: trialDays
                        }
                    }
                }
            },
            onSubscriptionComplete: async ({
                stripeSubscription,
                subscription
            }) => {
                await syncStripeSubscription(
                    stripeSubscription,
                    subscription.referenceId
                )
            },
            onSubscriptionCreated: async ({
                stripeSubscription,
                subscription
            }) => {
                await syncStripeSubscription(
                    stripeSubscription,
                    subscription.referenceId
                )
            },
            onSubscriptionUpdate: async ({
                stripeSubscription,
                subscription
            }) => {
                await syncStripeSubscription(
                    stripeSubscription,
                    subscription.referenceId
                )
            },
            onSubscriptionCancel: async ({
                stripeSubscription,
                subscription
            }) => {
                await syncStripeSubscription(
                    stripeSubscription,
                    subscription.referenceId
                )
            },
            onSubscriptionDeleted: async ({
                stripeSubscription,
                subscription
            }) => {
                await syncStripeSubscription(
                    stripeSubscription,
                    subscription.referenceId
                )
            }
        }
    })
}
