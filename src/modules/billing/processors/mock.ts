import { findPrice, getTrialDays, priceIdForProcessor } from "../catalog"
import { processorLabel } from "../enabled"
import type { BillingProcessor, CheckoutInput } from "../processors"
import { authOrigin, periodForPrice } from "../shared"
import {
    assertCanStartCheckout,
    cancelSubscriptionInStore,
    upsertCustomer,
    upsertSubscriptionFromProvider,
    userHasSubscriptionHistory
} from "../store"
import type { BillingProcessorId } from "../types"

export function createMockProcessor(id: BillingProcessorId): BillingProcessor {
    return {
        id,
        label: processorLabel(id),
        configured: () => false,
        createCheckoutUrl: (input) => mockCheckout(id, input),
        cancel: (input) =>
            cancelSubscriptionInStore({
                userId: input.userId,
                provider: id,
                atPeriodEnd: input.atPeriodEnd
            })
    }
}

async function mockCheckout(id: BillingProcessorId, input: CheckoutInput) {
    const matched = findPrice(input.priceKey)
    if (!matched) {
        throw new Error("Unknown price")
    }
    await assertCanStartCheckout(input.userId)

    const customerId = `mock_cus_${id}_${input.userId.slice(0, 8)}`
    const subscriptionId = `mock_sub_${id}_${crypto.randomUUID()}`
    await upsertCustomer({
        userId: input.userId,
        provider: id,
        providerCustomerId: customerId
    })

    const hadHistory = await userHasSubscriptionHistory(input.userId)
    const trialDays = getTrialDays()
    const period = periodForPrice(matched.price.interval, trialDays, hadHistory)
    const providerPriceId =
        priceIdForProcessor(matched.price, id) ||
        `mock_price_${matched.price.key}`

    await upsertSubscriptionFromProvider({
        userId: input.userId,
        provider: id,
        providerSubscriptionId: subscriptionId,
        providerPriceId,
        productKey: matched.product.key,
        priceKey: matched.price.key,
        status: !hadHistory && trialDays ? "trialing" : "active",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        endedAt: null
    })

    return `${authOrigin()}/account/billing?checkout=success`
}
