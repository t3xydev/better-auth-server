import type { BetterAuthPlugin } from "better-auth"
import {
    APIError,
    createAuthEndpoint,
    sessionMiddleware
} from "better-auth/api"
import { z } from "zod"

import { getPublishableCatalog } from "./catalog"
import {
    billingConfigured,
    billingEnabled,
    parseProcessorId,
    processorAvailable,
    processorLabel,
    stripeConfigured
} from "./enabled"
import { resolveProcessor, resolveProcessorForSubscription } from "./processors"

function requireEnabled() {
    if (!billingEnabled) {
        throw new APIError("BAD_REQUEST", {
            message: "Billing is not enabled"
        })
    }
}

function requireProcessor(id: ReturnType<typeof parseProcessorId>) {
    requireEnabled()
    if (!id || !processorAvailable(id)) {
        throw new APIError("BAD_REQUEST", {
            message: id
                ? `${processorLabel(id)} billing is not configured`
                : "Unknown billing provider"
        })
    }
    return id
}

export function billing() {
    return {
        id: "billing",
        schema: {
            billingCustomer: {
                fields: {
                    userId: {
                        type: "string",
                        references: {
                            model: "user",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    provider: {
                        type: "string"
                    },
                    providerCustomerId: {
                        type: "string"
                    },
                    createdAt: {
                        type: "date"
                    },
                    updatedAt: {
                        type: "date"
                    }
                },
                indexes: [
                    {
                        fields: ["userId", "provider"],
                        unique: true
                    },
                    {
                        fields: ["provider", "providerCustomerId"],
                        unique: true
                    }
                ]
            },
            billingSubscription: {
                fields: {
                    userId: {
                        type: "string",
                        references: {
                            model: "user",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    provider: {
                        type: "string"
                    },
                    providerSubscriptionId: {
                        type: "string"
                    },
                    productKey: {
                        type: "string"
                    },
                    priceKey: {
                        type: "string"
                    },
                    status: {
                        type: "string"
                    },
                    currentPeriodStart: {
                        type: "date",
                        required: false
                    },
                    currentPeriodEnd: {
                        type: "date",
                        required: false
                    },
                    cancelAtPeriodEnd: {
                        type: "boolean",
                        required: false
                    },
                    canceledAt: {
                        type: "date",
                        required: false
                    },
                    endedAt: {
                        type: "date",
                        required: false
                    },
                    createdAt: {
                        type: "date"
                    },
                    updatedAt: {
                        type: "date"
                    }
                },
                indexes: [
                    {
                        fields: ["provider", "providerSubscriptionId"],
                        unique: true
                    },
                    {
                        fields: ["userId"]
                    }
                ]
            },
            billingEntitlement: {
                fields: {
                    userId: {
                        type: "string",
                        references: {
                            model: "user",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    key: {
                        type: "string"
                    },
                    status: {
                        type: "string"
                    },
                    expiresAt: {
                        type: "date",
                        required: false
                    },
                    sourceSubscriptionId: {
                        type: "string",
                        required: false
                    },
                    createdAt: {
                        type: "date"
                    },
                    updatedAt: {
                        type: "date"
                    }
                },
                indexes: [
                    {
                        fields: ["userId", "key"],
                        unique: true
                    }
                ]
            },
            billingWebhookEvent: {
                fields: {
                    provider: {
                        type: "string"
                    },
                    eventId: {
                        type: "string"
                    },
                    createdAt: {
                        type: "date"
                    }
                },
                indexes: [
                    {
                        fields: ["provider", "eventId"],
                        unique: true
                    }
                ]
            }
        },
        rateLimit: [
            {
                pathMatcher: (path: string) => path === "/billing/checkout",
                window: 60,
                max: 8
            },
            {
                pathMatcher: (path: string) => path === "/billing/portal",
                window: 60,
                max: 10
            },
            {
                pathMatcher: (path: string) => path === "/billing/cancel",
                window: 60,
                max: 8
            },
            {
                pathMatcher: (path: string) => path === "/billing/webhook",
                window: 60,
                max: 60
            },
            {
                pathMatcher: (path: string) =>
                    path === "/billing/webhook/zoneless",
                window: 60,
                max: 60
            }
        ],
        endpoints: {
            billingCatalog: createAuthEndpoint(
                "/billing/catalog",
                {
                    method: "GET",
                    metadata: {
                        openapi: {
                            operationId: "getBillingCatalog",
                            description: "Publishable billing catalog"
                        }
                    }
                },
                async (ctx) => {
                    return ctx.json(getPublishableCatalog())
                }
            ),
            billingSubscription: createAuthEndpoint(
                "/billing/subscription",
                {
                    method: "GET",
                    use: [sessionMiddleware],
                    metadata: {
                        openapi: {
                            operationId: "getBillingSubscription",
                            description:
                                "Current account subscription and entitlements"
                        }
                    }
                },
                async (ctx) => {
                    const catalog = getPublishableCatalog()
                    if (!billingEnabled) {
                        return ctx.json({
                            enabled: false,
                            configured: false,
                            catalog,
                            subscription: null,
                            entitlements: [],
                            manageMode: null
                        })
                    }
                    const { getAccountBilling } = await import("./store")
                    const account = await getAccountBilling(
                        ctx.context.session.user.id
                    )
                    return ctx.json({
                        enabled: true,
                        configured: billingConfigured(),
                        catalog,
                        ...account
                    })
                }
            ),
            billingCheckout: createAuthEndpoint(
                "/billing/checkout",
                {
                    method: "POST",
                    use: [sessionMiddleware],
                    body: z.object({
                        priceKey: z.string().min(1),
                        provider: z.enum(["stripe", "zoneless"])
                    }),
                    metadata: {
                        openapi: {
                            operationId: "createBillingCheckout",
                            description: "Create a hosted checkout session"
                        }
                    }
                },
                async (ctx) => {
                    const provider = requireProcessor(
                        parseProcessorId(ctx.body.provider)
                    )
                    const user = ctx.context.session.user
                    try {
                        const processor = await resolveProcessor(provider)
                        const url = await processor.createCheckoutUrl({
                            userId: user.id,
                            email: user.email,
                            name: user.name,
                            priceKey: ctx.body.priceKey,
                            headers: ctx.request?.headers
                        })
                        return ctx.json({ url })
                    } catch (error) {
                        throw new APIError("BAD_REQUEST", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unable to start checkout"
                        })
                    }
                }
            ),
            billingPortal: createAuthEndpoint(
                "/billing/portal",
                {
                    method: "POST",
                    use: [sessionMiddleware],
                    metadata: {
                        openapi: {
                            operationId: "createBillingPortal",
                            description:
                                "Create a Stripe Customer Portal session"
                        }
                    }
                },
                async (ctx) => {
                    requireEnabled()
                    if (!stripeConfigured()) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Card billing portal is not configured"
                        })
                    }
                    try {
                        const { getOpenSubscription } = await import("./store")
                        const open = await getOpenSubscription(
                            ctx.context.session.user.id
                        )
                        if (!open || open.provider !== "stripe") {
                            throw new Error("No card subscription to manage")
                        }
                        const processor =
                            await resolveProcessorForSubscription(open)
                        if (!processor.createPortalUrl) {
                            throw new Error("No billing portal for this method")
                        }
                        const url = await processor.createPortalUrl({
                            userId: ctx.context.session.user.id,
                            headers: ctx.request?.headers
                        })
                        return ctx.json({ url })
                    } catch (error) {
                        throw new APIError("BAD_REQUEST", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unable to open billing portal"
                        })
                    }
                }
            ),
            billingCancel: createAuthEndpoint(
                "/billing/cancel",
                {
                    method: "POST",
                    use: [sessionMiddleware],
                    body: z.object({
                        atPeriodEnd: z.boolean().optional()
                    }),
                    metadata: {
                        openapi: {
                            operationId: "cancelBillingSubscription",
                            description:
                                "Cancel the current subscription with its owning processor"
                        }
                    }
                },
                async (ctx) => {
                    requireEnabled()
                    try {
                        const { getOpenSubscription } = await import("./store")
                        const open = await getOpenSubscription(
                            ctx.context.session.user.id
                        )
                        if (!open) {
                            throw new Error("No active subscription")
                        }
                        const processor =
                            await resolveProcessorForSubscription(open)
                        if (!processor.cancel) {
                            throw new Error(
                                "This payment method cannot cancel in-app"
                            )
                        }
                        await processor.cancel({
                            userId: ctx.context.session.user.id,
                            atPeriodEnd: ctx.body.atPeriodEnd ?? true
                        })
                        return ctx.json({ ok: true })
                    } catch (error) {
                        throw new APIError("BAD_REQUEST", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unable to cancel subscription"
                        })
                    }
                }
            ),
            billingWebhook: createAuthEndpoint(
                "/billing/webhook",
                {
                    method: "POST",
                    metadata: {
                        openapi: {
                            operationId: "handleBillingWebhook",
                            description:
                                "Stripe billing webhook. Updates shared entitlements. Prefer /stripe/webhook so the Stripe plugin subscription row stays in sync."
                        }
                    },
                    cloneRequest: true,
                    disableBody: true
                },
                async (ctx) => {
                    if (!ctx.request) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Missing request"
                        })
                    }
                    const signature =
                        ctx.request.headers.get("stripe-signature")
                    if (!signature) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Missing Stripe signature"
                        })
                    }
                    const payload = await ctx.request.text()
                    try {
                        const { constructStripeEvent, handleStripeEvent } =
                            await import("./processors/stripe")
                        const event = await constructStripeEvent(
                            payload,
                            signature
                        )
                        await handleStripeEvent(event)
                    } catch (error) {
                        ctx.context.logger.error(
                            `Billing webhook failed: ${
                                error instanceof Error
                                    ? error.message
                                    : "unknown error"
                            }`
                        )
                        throw new APIError("BAD_REQUEST", {
                            message: "Webhook rejected"
                        })
                    }
                    return ctx.json({ received: true })
                }
            ),
            billingZonelessWebhook: createAuthEndpoint(
                "/billing/webhook/zoneless",
                {
                    method: "POST",
                    metadata: {
                        openapi: {
                            operationId: "handleZonelessBillingWebhook",
                            description: "Zoneless billing webhook"
                        }
                    },
                    cloneRequest: true,
                    disableBody: true
                },
                async (ctx) => {
                    if (!ctx.request) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Missing request"
                        })
                    }
                    const signature =
                        ctx.request.headers.get("zoneless-signature") ??
                        ctx.request.headers.get("Zoneless-Signature")
                    if (!signature) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Missing Zoneless signature"
                        })
                    }
                    const payload = await ctx.request.text()
                    try {
                        const { constructZonelessEvent, handleZonelessEvent } =
                            await import("./processors/zoneless")
                        const event = constructZonelessEvent(payload, signature)
                        await handleZonelessEvent(event)
                    } catch (error) {
                        ctx.context.logger.error(
                            `Zoneless billing webhook failed: ${
                                error instanceof Error
                                    ? error.message
                                    : "unknown error"
                            }`
                        )
                        throw new APIError("BAD_REQUEST", {
                            message: "Webhook rejected"
                        })
                    }
                    return ctx.json({ received: true })
                }
            )
        }
    } satisfies BetterAuthPlugin
}
