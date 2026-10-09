import assert from "node:assert/strict"
import { test } from "node:test"

import { authBaseOrigin, trustedOrigins } from "./trusted-origins"

test("authBaseOrigin strips a trailing slash", () => {
    assert.equal(
        authBaseOrigin({ BETTER_AUTH_URL: "https://auth.example.com/" }),
        "https://auth.example.com"
    )
})

test("trustedOrigins always includes BETTER_AUTH_URL and extras", () => {
    assert.deepEqual(
        trustedOrigins({
            BETTER_AUTH_URL: "https://auth.example.com",
            BETTER_AUTH_TRUSTED_ORIGINS:
                "https://app.example.com, https://admin.example.com/"
        }),
        [
            "https://auth.example.com",
            "https://app.example.com",
            "https://admin.example.com"
        ]
    )
})

test("trustedOrigins ignores a bare * so CSRF is not opened", () => {
    assert.deepEqual(
        trustedOrigins({
            BETTER_AUTH_URL: "https://auth.example.com",
            BETTER_AUTH_TRUSTED_ORIGINS: "*"
        }),
        ["https://auth.example.com"]
    )
})
