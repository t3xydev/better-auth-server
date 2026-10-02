import assert from "node:assert/strict"
import { test } from "node:test"

import { isPlaceholderPriceId } from "./catalog"
import { isMockProviderId, parseProcessorId } from "./enabled"
import { normalizeZonelessApiUrl, periodForPrice } from "./shared"
import { mapEntitlementStatus } from "./store-status"

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
