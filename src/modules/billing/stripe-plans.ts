import { isPlaceholderPriceId } from "./catalog"
import type { BillingInterval, BillingProcessorId } from "./types"

export type StripePlanMapping = {
    name: string
    priceId?: string
    annualDiscountPriceId?: string
}

type PlanSource = {
    key: string
    prices: Array<{
        interval: BillingInterval
        priceIds: Partial<Record<BillingProcessorId, string>>
    }>
}

function liveStripePriceId(priceId: string | undefined) {
    if (!priceId || isPlaceholderPriceId(priceId)) return undefined
    return priceId
}

/** One Better Auth Stripe plan per catalog product. Monthly is `priceId`; yearly is the annual price. */
export function stripePlanFromProduct(
    product: PlanSource
): StripePlanMapping | null {
    const monthly = product.prices.find((price) => price.interval === "monthly")
    const yearly = product.prices.find((price) => price.interval === "yearly")
    const priceId = liveStripePriceId(monthly?.priceIds.stripe)
    const annualDiscountPriceId = liveStripePriceId(yearly?.priceIds.stripe)
    if (!priceId && !annualDiscountPriceId) return null
    return {
        name: product.key,
        ...(priceId ? { priceId } : {}),
        ...(annualDiscountPriceId ? { annualDiscountPriceId } : {})
    }
}

export function stripePlansFromCatalog(products: PlanSource[]) {
    return products.flatMap((product) => {
        const plan = stripePlanFromProduct(product)
        return plan ? [plan] : []
    })
}

export function annualForInterval(interval: BillingInterval) {
    return interval === "yearly"
}
