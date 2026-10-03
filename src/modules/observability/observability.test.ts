import assert from "node:assert/strict"
import { test } from "node:test"

import {
    parseOtelHeaders,
    resolveOtelBackend,
    traceSampleRate,
    tracesUrl
} from "./backends"
import {
    oauthOutcomeProperties,
    outcomeErrorCode,
    readClientId
} from "./oauth-events"
import { posthogAssetHost, posthogRewrites } from "./posthog-hosts.mjs"
import { distinctIdFromCookie } from "./posthog-identity"
import {
    isSensitiveKey,
    scrubSentryEvent,
    scrubText,
    scrubUrl,
    scrubValue
} from "./scrub"

test("otel backend stays off without a selection", () => {
    assert.equal(resolveOtelBackend({}), null)
    assert.equal(resolveOtelBackend({ OTEL_BACKEND: "off" }), null)
    assert.equal(resolveOtelBackend({ OTEL_BACKEND: "other" }), null)
})

test("gitlab preset builds the project traces URL and token header", () => {
    const backend = resolveOtelBackend({
        OTEL_BACKEND: "gitlab",
        GITLAB_PROJECT_ID: "42",
        GITLAB_OBSERVABILITY_TOKEN: "glpat-test",
        OTEL_SERVICE_VERSION: "abc123"
    })
    assert.ok(backend)
    assert.equal(
        backend.endpoint,
        "https://gitlab.com/api/v4/projects/42/observability/v1/traces"
    )
    assert.equal(backend.headers["PRIVATE-TOKEN"], "glpat-test")
    assert.equal(backend.resourceAttributes["gitlab.project.id"], "42")
    assert.equal(backend.resourceAttributes["service.version"], "abc123")
})

test("gitlab preset honors a custom host and endpoint override", () => {
    const derived = resolveOtelBackend({
        OTEL_BACKEND: "gitlab",
        GITLAB_HOST: "https://gitlab.example.com/",
        GITLAB_PROJECT_ID: "7",
        GITLAB_OBSERVABILITY_TOKEN: "token"
    })
    assert.equal(
        derived?.endpoint,
        "https://gitlab.example.com/api/v4/projects/7/observability/v1/traces"
    )

    const override = resolveOtelBackend({
        OTEL_BACKEND: "gitlab",
        GITLAB_OTEL_ENDPOINT: "http://o11y.internal:4318",
        GITLAB_OBSERVABILITY_TOKEN: "token",
        GITLAB_PROJECT_ID: "7"
    })
    assert.equal(override?.endpoint, "http://o11y.internal:4318/v1/traces")
    assert.equal(resolveOtelBackend({ OTEL_BACKEND: "gitlab" }), null)
})

test("signoz preset appends the traces path and optional ingestion key", () => {
    const cloud = resolveOtelBackend({
        OTEL_BACKEND: "signoz",
        SIGNOZ_INGEST_URL: "https://ingest.us.signoz.cloud:443/",
        SIGNOZ_INGESTION_KEY: "key"
    })
    assert.equal(
        cloud?.endpoint,
        "https://ingest.us.signoz.cloud:443/v1/traces"
    )
    assert.equal(cloud?.headers["signoz-ingestion-key"], "key")

    const selfHosted = resolveOtelBackend({
        OTEL_BACKEND: "signoz",
        SIGNOZ_INGEST_URL: "http://signoz:4318/v1/traces"
    })
    assert.equal(selfHosted?.endpoint, "http://signoz:4318/v1/traces")
    assert.deepEqual(selfHosted?.headers, {})
    assert.equal(resolveOtelBackend({ OTEL_BACKEND: "signoz" }), null)
})

test("generic otlp preset parses headers and requires an endpoint", () => {
    assert.equal(resolveOtelBackend({ OTEL_BACKEND: "otlp" }), null)
    const backend = resolveOtelBackend({
        OTEL_BACKEND: "otlp",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer%20abc,x-team=auth"
    })
    assert.equal(backend?.endpoint, "http://collector:4318/v1/traces")
    assert.equal(backend?.headers.Authorization, "Bearer abc")
    assert.equal(backend?.headers["x-team"], "auth")
    assert.deepEqual(parseOtelHeaders(undefined), {})
    assert.equal(
        tracesUrl("http://collector:4318/v1/traces"),
        "http://collector:4318/v1/traces"
    )
})

test("trace sample rate defaults to 1 in development and 0.1 in production", () => {
    assert.equal(traceSampleRate({ NODE_ENV: "development" }), 1)
    assert.equal(traceSampleRate({ NODE_ENV: "production" }), 0.1)
    assert.equal(
        traceSampleRate({
            NODE_ENV: "production",
            OTEL_TRACES_SAMPLE_RATE: "0.5"
        }),
        0.5
    )
    assert.equal(
        traceSampleRate({ OTEL_TRACES_SAMPLE_RATE: "nope", NODE_ENV: "test" }),
        1
    )
})

test("scrubber redacts secrets and keeps client ids", () => {
    assert.equal(isSensitiveKey("client_id"), false)
    assert.equal(isSensitiveKey("Authorization"), true)
    assert.equal(isSensitiveKey("access_token"), true)
    const scrubbed = scrubValue({
        client_id: "app",
        password: "hunter2",
        code: "123456",
        nested: { refresh_token: "rt" }
    }) as Record<string, unknown>
    assert.equal(scrubbed.client_id, "app")
    assert.equal(scrubbed.password, "[redacted]")
    assert.equal(scrubbed.code, "[redacted]")
    assert.equal(
        (scrubbed.nested as Record<string, unknown>).refresh_token,
        "[redacted]"
    )
})

test("auth urls lose their query string", () => {
    assert.equal(
        scrubUrl("/api/auth/oauth2/token?code=secret&client_id=app"),
        "/api/auth/oauth2/token"
    )
    assert.equal(
        scrubUrl("/account/settings?tab=security"),
        "/account/settings?tab=security"
    )
    assert.equal(
        scrubText("failed Bearer abc.def /api/auth/callback?code=1"),
        "failed Bearer [redacted] /api/auth/callback"
    )
})

test("sentry events drop cookies and auth query strings", () => {
    const event = scrubSentryEvent({
        request: {
            url: "https://auth.example.com/api/auth/sign-in?token=abc",
            query_string: "token=abc",
            cookies: { session: "secret" },
            headers: {
                authorization: "Bearer abc",
                "content-type": "application/json"
            },
            data: { password: "hunter2", email: "a@b.c" }
        },
        extra: { client_secret: "hide" }
    })
    assert.equal(
        event.request?.url,
        "https://auth.example.com/api/auth/sign-in"
    )
    assert.equal(event.request?.query_string, undefined)
    assert.equal(event.request?.cookies, undefined)
    assert.equal(event.request?.headers?.authorization, "[redacted]")
    assert.equal(event.request?.headers?.["content-type"], "application/json")
    assert.equal(
        (event.request?.data as Record<string, unknown>).password,
        "[redacted]"
    )
    assert.equal(event.extra?.client_secret, "[redacted]")
})

test("oauth outcomes keep client id and error codes, not tokens", () => {
    assert.equal(readClientId({ client_id: "app" }, {}), "app")
    assert.equal(
        outcomeErrorCode({
            access_token: "secret",
            refresh_token: "secret",
            error: "invalid_grant"
        }),
        "invalid_grant"
    )
    assert.equal(
        outcomeErrorCode({ access_token: "secret", token_type: "Bearer" }),
        undefined
    )

    const token = oauthOutcomeProperties({
        path: "/oauth2/token",
        body: { client_id: "app", client_secret: "hide", code: "otp" },
        query: {},
        returned: { error: "invalid_client" },
        userId: null
    })
    assert.equal(token?.event, "oauth_token")
    assert.equal(token?.distinctId, "client:app")
    assert.deepEqual(token?.properties, {
        client_id: "app",
        success: false,
        error: "invalid_client"
    })

    const consent = oauthOutcomeProperties({
        path: "/oauth2/consent",
        body: { client_id: "app" },
        query: {},
        returned: { ok: true },
        userId: "user_1"
    })
    assert.equal(consent?.distinctId, "user_1")
    assert.equal(consent?.properties.success, true)
    assert.equal(
        oauthOutcomeProperties({
            path: "/sign-in/email",
            body: {},
            query: {},
            returned: {},
            userId: "user_1"
        }),
        null
    )
})

test("posthog cookie yields the distinct id", () => {
    const payload = encodeURIComponent(
        JSON.stringify({ distinct_id: "user_1" })
    )
    assert.equal(
        distinctIdFromCookie(`ph_phc_test_posthog=${payload}`),
        "user_1"
    )
    assert.equal(distinctIdFromCookie(undefined), null)
})

test("posthog ingest rewrites follow the configured region", () => {
    const us = posthogRewrites("https://us.i.posthog.com")
    assert.equal(
        us[0]?.destination,
        "https://us-assets.i.posthog.com/static/:path*"
    )
    assert.equal(
        us[1]?.destination,
        "https://us-assets.i.posthog.com/array/:path*"
    )
    assert.equal(us[2]?.destination, "https://us.i.posthog.com/:path*")
    assert.equal(
        posthogAssetHost("https://eu.i.posthog.com"),
        "https://eu-assets.i.posthog.com"
    )
})
