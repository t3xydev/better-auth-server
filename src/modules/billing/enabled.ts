import type { BillingMethod, BillingProcessorId } from "./types"

/** Opt-in account-scoped billing. Off in production unless explicitly enabled. */

function billingFlag() {
    return process.env.NEXT_PUBLIC_BILLING_ENABLED?.trim() ?? ""
}

function env(name: string) {
    return process.env[name]?.trim() || ""
}

/** Catalog placeholders and default-on UI. Never used in production builds. */
export const billingDevPlaceholders = process.env.NODE_ENV !== "production"

/**
 * Production: `NEXT_PUBLIC_BILLING_ENABLED=true`.
 * `next dev`: on unless set to `"false"`.
 */
export const billingEnabled =
    billingFlag() === "true" ||
    (billingDevPlaceholders && billingFlag() !== "false")

const PROCESSOR_LABELS: Record<BillingProcessorId, string> = {
    stripe: "Card",
    zoneless: "USDC"
}

export function parseProcessorId(value: string | null | undefined) {
    if (value === "stripe" || value === "zoneless") return value
    return null
}

/** Preferred checkout method when the UI has not stored a choice. */
export const billingProvider: BillingProcessorId =
    parseProcessorId(env("BILLING_PROVIDER")) ?? "stripe"

export function hasStripePriceIds() {
    return Boolean(
        env("BILLING_STRIPE_PRICE_PREMIUM_MONTHLY") ||
            env("BILLING_STRIPE_PRICE_PREMIUM_YEARLY")
    )
}

export function hasZonelessPriceIds() {
    return Boolean(
        env("BILLING_ZONELESS_PRICE_PREMIUM_MONTHLY") ||
            env("BILLING_ZONELESS_PRICE_PREMIUM_YEARLY")
    )
}

export function stripeConfigured() {
    return (
        billingEnabled &&
        Boolean(env("STRIPE_SECRET_KEY")) &&
        Boolean(env("STRIPE_WEBHOOK_SECRET")) &&
        hasStripePriceIds()
    )
}

export function zonelessConfigured() {
    return (
        billingEnabled &&
        Boolean(env("ZONELESS_API_KEY")) &&
        Boolean(env("ZONELESS_API_URL")) &&
        Boolean(env("ZONELESS_WEBHOOK_SECRET")) &&
        hasZonelessPriceIds()
    )
}

export function processorConfigured(id: BillingProcessorId) {
    return id === "stripe" ? stripeConfigured() : zonelessConfigured()
}

/** True when at least one live processor has secrets and Price IDs. Mock does not count. */
export function billingConfigured() {
    return stripeConfigured() || zonelessConfigured()
}

export function processorAvailable(id: BillingProcessorId) {
    return processorConfigured(id) || billingDevPlaceholders
}

export function processorLabel(id: BillingProcessorId) {
    return PROCESSOR_LABELS[id]
}

export function getPublishableMethods(): BillingMethod[] {
    const methods: BillingMethod[] = [
        {
            id: "stripe",
            label: PROCESSOR_LABELS.stripe,
            configured: stripeConfigured(),
            mock: billingDevPlaceholders && !stripeConfigured()
        },
        {
            id: "zoneless",
            label: PROCESSOR_LABELS.zoneless,
            configured: zonelessConfigured(),
            mock: billingDevPlaceholders && !zonelessConfigured()
        }
    ]
    if (billingDevPlaceholders) return methods
    return methods.filter((method) => method.configured)
}

export function isMockProviderId(value: string) {
    return value.startsWith("mock_")
}
