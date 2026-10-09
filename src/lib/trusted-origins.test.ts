import assert from "node:assert/strict"
import { test } from "node:test"

import {
    authBaseOrigin,
    corsAllowOrigin,
    isTrustedOrigin,
    originMatchesPattern,
    trustedOrigins
} from "./trusted-origins"

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

test("originMatchesPattern supports protocol wildcards and custom schemes", () => {
    assert.equal(
        originMatchesPattern(
            "https://app.example.com",
            "https://*.example.com"
        ),
        true
    )
    assert.equal(
        originMatchesPattern("http://app.example.com", "https://*.example.com"),
        false
    )
    assert.equal(
        originMatchesPattern("https://app.example.com", "*.example.com"),
        true
    )
    assert.equal(originMatchesPattern("myapp://callback", "myapp://"), true)
})

test("isTrustedOrigin matches extras and wildcards", () => {
    const env = {
        BETTER_AUTH_URL: "https://auth.example.com",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://*.app.example.com"
    }
    assert.equal(isTrustedOrigin("https://auth.example.com", env), true)
    assert.equal(isTrustedOrigin("https://web.app.example.com", env), true)
    assert.equal(isTrustedOrigin("https://evil.example.net", env), false)
})

test("corsAllowOrigin echoes a trusted Origin and falls back to *", () => {
    const env = {
        BETTER_AUTH_URL: "https://auth.example.com",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example.com"
    }
    const trusted = new Request(
        "https://auth.example.com/.well-known/openid-configuration",
        {
            headers: { origin: "https://app.example.com" }
        }
    )
    const unknown = new Request(
        "https://auth.example.com/.well-known/openid-configuration",
        {
            headers: { origin: "https://evil.example.net" }
        }
    )
    assert.equal(corsAllowOrigin(trusted, env), "https://app.example.com")
    assert.equal(corsAllowOrigin(unknown, env), "*")
})
