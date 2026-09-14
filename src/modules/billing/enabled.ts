/** Opt-in account-scoped billing. Off in production unless explicitly enabled. */

function billingFlag() {
    return process.env.NEXT_PUBLIC_BILLING_ENABLED?.trim() ?? ""
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

export const billingProvider =
    (process.env.BILLING_PROVIDER || "stripe").trim() || "stripe"

export function hasStripePriceIds() {
    return Boolean(
        process.env.BILLING_STRIPE_PRICE_PREMIUM_MONTHLY?.trim() ||
            process.env.BILLING_STRIPE_PRICE_PREMIUM_YEARLY?.trim()
    )
}

export function billingConfigured() {
    return (
        billingEnabled &&
        billingProvider === "stripe" &&
        Boolean(process.env.STRIPE_SECRET_KEY?.trim()) &&
        Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()) &&
        hasStripePriceIds()
    )
}
