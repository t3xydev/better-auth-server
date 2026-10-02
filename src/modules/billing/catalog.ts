import {
    billingConfigured,
    billingDevPlaceholders,
    billingEnabled,
    billingProvider,
    getPublishableMethods
} from "./enabled"
import type {
    BillingCatalog,
    BillingInterval,
    BillingProcessorId
} from "./types"

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
    priceIds: Partial<Record<BillingProcessorId, string>>
}

export type CatalogProduct = {
    key: string
    name: string
    description: string
    entitlementKey: string
    prices: CatalogPrice[]
}

function stripePrice(name: "MONTHLY" | "YEARLY", placeholder: string) {
    return (
        env(`BILLING_STRIPE_PRICE_PREMIUM_${name}`) ||
        (billingDevPlaceholders ? placeholder : "")
    )
}

/** Operator catalog. Each processor Dashboard owns Prices; env holds Price IDs. */
export function getCatalogProducts(): CatalogProduct[] {
    const monthlyStripe = stripePrice("MONTHLY", DEV_PLACEHOLDER_MONTHLY)
    const yearlyStripe = stripePrice("YEARLY", DEV_PLACEHOLDER_YEARLY)
    const monthlyZoneless = env("BILLING_ZONELESS_PRICE_PREMIUM_MONTHLY")
    const yearlyZoneless = env("BILLING_ZONELESS_PRICE_PREMIUM_YEARLY")

    const prices = [
        monthlyStripe || monthlyZoneless || billingDevPlaceholders
            ? {
                  key: "premium_monthly" as const,
                  interval: "monthly" as const,
                  priceIds: {
                      ...(monthlyStripe ? { stripe: monthlyStripe } : {}),
                      ...(monthlyZoneless ? { zoneless: monthlyZoneless } : {})
                  }
              }
            : null,
        yearlyStripe || yearlyZoneless || billingDevPlaceholders
            ? {
                  key: "premium_yearly" as const,
                  interval: "yearly" as const,
                  priceIds: {
                      ...(yearlyStripe ? { stripe: yearlyStripe } : {}),
                      ...(yearlyZoneless ? { zoneless: yearlyZoneless } : {})
                  }
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
    const methods = getPublishableMethods()
    return {
        enabled: billingEnabled,
        configured: billingConfigured() && products.length > 0,
        placeholders: billingDevPlaceholders && !billingConfigured(),
        trialDays: trialDays(),
        defaultProvider: billingProvider,
        methods,
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

export function findPriceByProviderId(provider: string, priceId: string) {
    const id = provider as BillingProcessorId
    for (const product of getCatalogProducts()) {
        const price = product.prices.find(
            (item) => item.priceIds[id] === priceId
        )
        if (price) return { product, price }
    }
    return null
}

export function priceIdForProcessor(
    price: CatalogPrice,
    provider: BillingProcessorId
) {
    return price.priceIds[provider] || ""
}
