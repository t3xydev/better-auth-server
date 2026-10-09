import assert from "node:assert/strict"
import { test } from "node:test"

import {
    followOAuthContinue,
    isAuthFlowNavigation,
    loggedInAuthRouteRedirect,
    oauthAuthorizeResumePath,
    oauthAwareDestination,
    signedOAuthQuery
} from "./oauth-resume"

const signedSearch =
    "?client_id=app&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback&response_type=code&scope=openid&ba_iat=1&ba_param=client_id&ba_param=redirect_uri&ba_param=response_type&ba_param=scope&ba_param=ba_iat&ba_param=ba_param&sig=abc"

test("signedOAuthQuery keeps only signed authorize params", () => {
    const query = signedOAuthQuery(
        `${signedSearch}&redirectTo=%2Faccount%2Fsettings`
    )
    assert.ok(query)
    const params = new URLSearchParams(query)
    assert.equal(params.get("client_id"), "app")
    assert.equal(params.get("sig"), "abc")
    assert.equal(params.get("redirectTo"), null)
})

test("signedOAuthQuery ignores unsigned pages", () => {
    assert.equal(signedOAuthQuery("?redirectTo=/admin"), null)
    assert.equal(signedOAuthQuery(""), null)
})

test("oauthAuthorizeResumePath points at the authorize endpoint", () => {
    assert.equal(
        oauthAuthorizeResumePath(signedSearch)?.startsWith(
            "/api/auth/oauth2/authorize?"
        ),
        true
    )
})

test("logged-in auth routes resume OIDC instead of account settings", () => {
    assert.equal(
        loggedInAuthRouteRedirect(signedSearch),
        oauthAuthorizeResumePath(signedSearch)
    )
    assert.equal(
        loggedInAuthRouteRedirect("?redirectTo=/admin"),
        "/account/settings"
    )
})

test("auth-flow navigations are not treated as post-login redirects", () => {
    assert.equal(isAuthFlowNavigation("/auth/two-factor?client_id=app"), true)
    assert.equal(isAuthFlowNavigation("/auth/password"), true)
    assert.equal(isAuthFlowNavigation("/consent"), true)
    assert.equal(isAuthFlowNavigation("/account/settings"), false)
    assert.equal(isAuthFlowNavigation("/admin"), false)
})

test("oauthAwareDestination resumes authorize for post-login paths", () => {
    assert.equal(
        oauthAwareDestination("/account/settings", signedSearch),
        oauthAuthorizeResumePath(signedSearch)
    )
    assert.equal(
        oauthAwareDestination("/auth/two-factor?client_id=app", signedSearch),
        "/auth/two-factor?client_id=app"
    )
    assert.equal(
        oauthAwareDestination("/account/settings", ""),
        "/account/settings"
    )
})

test("followOAuthContinue prefers the plugin redirect payload", () => {
    const original = globalThis.window
    const assigned: string[] = []
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            location: {
                assign: (url: string) => {
                    assigned.push(url)
                }
            }
        }
    })

    try {
        assert.equal(
            followOAuthContinue(
                { redirect: true, url: "/consent?client_id=app" },
                signedSearch
            ),
            true
        )
        assert.deepEqual(assigned, ["/consent?client_id=app"])

        assigned.length = 0
        assert.equal(
            followOAuthContinue({ session: {} } as never, signedSearch),
            true
        )
        assert.equal(
            assigned[0]?.startsWith("/api/auth/oauth2/authorize?"),
            true
        )

        assigned.length = 0
        assert.equal(followOAuthContinue({ session: {} } as never, ""), false)
        assert.deepEqual(assigned, [])
    } finally {
        if (original === undefined) {
            Reflect.deleteProperty(globalThis, "window")
        } else {
            Object.defineProperty(globalThis, "window", {
                configurable: true,
                value: original
            })
        }
    }
})
