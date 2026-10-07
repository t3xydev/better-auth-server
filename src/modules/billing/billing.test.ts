import assert from "node:assert/strict"
import { test } from "node:test"

import { isPlaceholderPriceId } from "./catalog"
import { isMockProviderId, parseProcessorId } from "./enabled"
import {
    billingMirrorFromStripeSubscription,
    normalizeZonelessApiUrl,
    periodForPrice
} from "./shared"
import { mapEntitlementStatus } from "./store-status"
import { annualForInterval, stripePlanFromProduct } from "./stripe-plans"

test("parseProcessorId accepts stripe and zoneless", () => {
    assert.equal(parseProcessorId("stripe"), "stripe")
    assert.equal(parseProcessorId("zoneless"), "zoneless")
    assert.equal(parseProcessorId("paypal"), null)
    assert.equal(parseProcessorId(""), null)
})

test("mock provider ids are detected without colliding with live ids", () => {
    assert.equal(isMockProviderId("mock_cus_stripe_abc"), true)
    assert.equal(isMockProviderId("cus_123"), false)
    assert.equal(isPlaceholderPriceId("price_dev_premium_monthly"), true)
    assert.equal(isPlaceholderPriceId("price_live"), false)
})

test("periodForPrice uses trial then interval", () => {
    const now = new Date("2026-01-15T00:00:00.000Z")
    const trial = periodForPrice("monthly", 14, false, now)
    assert.equal(trial.end.toISOString(), "2026-01-29T00:00:00.000Z")
    const monthly = periodForPrice("monthly", 14, true, now)
    assert.equal(monthly.end.toISOString(), "2026-02-15T00:00:00.000Z")
    const yearly = periodForPrice("yearly", null, false, now)
    assert.equal(yearly.end.toISOString(), "2027-01-15T00:00:00.000Z")
})

test("entitlement mapping keeps past_due in grace and canceled until period end", () => {
    const future = new Date("2026-06-01T00:00:00.000Z")
    const now = new Date("2026-05-01T00:00:00.000Z")
    assert.equal(mapEntitlementStatus("active", future, now), "active")
    assert.equal(mapEntitlementStatus("past_due", future, now), "grace")
    assert.equal(mapEntitlementStatus("canceled", future, now), "active")
    assert.equal(mapEntitlementStatus("canceled", now, future), "expired")
    assert.equal(mapEntitlementStatus("unpaid", future, now), "expired")
})

test("stripe plans map monthly and yearly prices onto one product", () => {
    const plan = stripePlanFromProduct({
        key: "premium",
        prices: [
            {
                interval: "monthly",
                priceIds: { stripe: "price_month" }
            },
            {
                interval: "yearly",
                priceIds: { stripe: "price_year" }
            }
        ]
    })
    assert.equal(plan?.name, "premium")
    assert.equal(plan?.priceId, "price_month")
    assert.equal(plan?.annualDiscountPriceId, "price_year")
    assert.equal(annualForInterval("monthly"), false)
    assert.equal(annualForInterval("yearly"), true)
    assert.equal(
        stripePlanFromProduct({
            key: "premium",
            prices: [
                {
                    interval: "monthly",
                    priceIds: { stripe: "price_dev_premium_monthly" }
                }
            ]
        }),
        null
    )
})

test("stripe subscription hooks mirror into shared billing fields", () => {
    const mirrored = billingMirrorFromStripeSubscription(
        {
            id: "sub_123",
            status: "active",
            customer: "cus_123",
            metadata: { userId: "user_from_metadata" },
            cancel_at_period_end: true,
            canceled_at: 1_767_225_600,
            items: {
                data: [
                    {
                        price: "price_month",
                        current_period_start: 1_767_225_600,
                        current_period_end: 1_769_904_000
                    }
                ]
            }
        },
        "user_from_reference"
    )
    assert.equal(mirrored.userId, "user_from_metadata")
    assert.equal(mirrored.providerCustomerId, "cus_123")
    assert.equal(mirrored.providerSubscriptionId, "sub_123")
    assert.equal(mirrored.providerPriceId, "price_month")
    assert.equal(mirrored.status, "active")
    assert.equal(mirrored.cancelAtPeriodEnd, true)
    assert.equal(mirrored.canceledAt?.toISOString(), "2026-01-01T00:00:00.000Z")
    assert.equal(
        mirrored.currentPeriodEnd?.toISOString(),
        "2026-02-01T00:00:00.000Z"
    )

    const fromReference = billingMirrorFromStripeSubscription(
        {
            id: "sub_456",
            status: "trialing",
            customer: { id: "cus_456" }
        },
        "user_from_reference"
    )
    assert.equal(fromReference.userId, "user_from_reference")
    assert.equal(fromReference.providerCustomerId, "cus_456")
    assert.equal(fromReference.providerPriceId, null)
})

test("normalizeZonelessApiUrl strips trailing slash and /v1 for the SDK", () => {
    assert.equal(
        normalizeZonelessApiUrl("https://zoneless.example.com/v1/"),
        "https://zoneless.example.com"
    )
    assert.equal(
        normalizeZonelessApiUrl(" https://zoneless.example.com "),
        "https://zoneless.example.com"
    )
})
