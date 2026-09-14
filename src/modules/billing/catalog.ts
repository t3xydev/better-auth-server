import {
    billingConfigured,
    billingDevPlaceholders,
    billingEnabled,
    hasStripePriceIds
} from "./enabled"
import type { BillingCatalog, BillingInterval } from "./types"

export const DEV_PLACEHOLDER_MONTHLY = "price_dev_premium_monthly"
export const DEV_PLACEHOLDER_YEARLY = "price_dev_premium_yearly"

export function isPlaceholderPriceId(priceId: string) {
    return priceId.startsWith("price_dev_")
}

function env(name: string) {
    return process.env[name]?.trim() || ""
}

function trialDays() {
    const raw = env("BILLING_TRIAL_DAYS")
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export type CatalogPrice = {
    key: string
    interval: BillingInterval
    priceId: string
}

export type CatalogProduct = {
    key: string
    name: string
    description: string
    entitlementKey: string
    prices: CatalogPrice[]
}

/** Operator catalog. Stripe Dashboard owns Products/Prices; env holds Price IDs. */
export function getCatalogProducts(): CatalogProduct[] {
    const monthly =
        env("BILLING_STRIPE_PRICE_PREMIUM_MONTHLY") ||
        (billingDevPlaceholders ? DEV_PLACEHOLDER_MONTHLY : "")
    const yearly =
        env("BILLING_STRIPE_PRICE_PREMIUM_YEARLY") ||
        (billingDevPlaceholders ? DEV_PLACEHOLDER_YEARLY : "")
    const prices = [
        monthly
            ? {
                  key: "premium_monthly" as const,
                  interval: "monthly" as const,
                  priceId: monthly
              }
            : null,
        yearly
            ? {
                  key: "premium_yearly" as const,
                  interval: "yearly" as const,
                  priceId: yearly
              }
            : null
    ].filter((price): price is NonNullable<typeof price> => price != null)

    if (prices.length === 0) return []

    return [
        {
            key: "premium",
            name: "Premium",
            description: "Active subscription on this identity host.",
            entitlementKey: "premium",
            prices
        }
    ]
}

export function getPublishableCatalog(): BillingCatalog {
    const products = getCatalogProducts()
    return {
        enabled: billingEnabled,
        configured: billingConfigured() && products.length > 0,
        placeholders: billingDevPlaceholders && !hasStripePriceIds(),
        trialDays: trialDays(),
        products: products.map((product) => ({
            key: product.key,
            name: product.name,
            description: product.description,
            entitlementKey: product.entitlementKey,
            prices: product.prices.map((price) => ({
                key: price.key,
                interval: price.interval
            }))
        }))
    }
}

export function getTrialDays() {
    return trialDays()
}

export function findPrice(priceKey: string) {
    for (const product of getCatalogProducts()) {
        const price = product.prices.find((item) => item.key === priceKey)
        if (price) return { product, price }
    }
    return null
}

export function entitlementKeyForProduct(productKey: string) {
    const product = getCatalogProducts().find((item) => item.key === productKey)
    return product?.entitlementKey ?? productKey
}

export function findPriceByProviderId(priceId: string) {
    for (const product of getCatalogProducts()) {
        const price = product.prices.find((item) => item.priceId === priceId)
        if (price) return { product, price }
    }
    return null
}
