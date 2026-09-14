import type { BetterAuthPlugin } from "better-auth"
import {
    APIError,
    createAuthEndpoint,
    sessionMiddleware
} from "better-auth/api"
import { z } from "zod"

import { getPublishableCatalog } from "./catalog"
import { billingConfigured, billingEnabled } from "./enabled"

function requireConfigured() {
    if (!billingEnabled || !billingConfigured()) {
        throw new APIError("BAD_REQUEST", {
            message: "Billing is not enabled"
        })
    }
}

export function billing() {
    return {
        id: "billing",
        schema: {
            billingCustomer: {
                fields: {
                    userId: {
                        type: "string",
                        unique: true,
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
                pathMatcher: (path: string) => path === "/billing/webhook",
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
                            entitlements: []
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
                        priceKey: z.string().min(1)
                    }),
                    metadata: {
                        openapi: {
                            operationId: "createBillingCheckout",
                            description: "Create a Stripe Checkout session"
                        }
                    }
                },
                async (ctx) => {
                    requireConfigured()
                    const user = ctx.context.session.user
                    try {
                        const { createCheckoutUrl } = await import("./stripe")
                        const url = await createCheckoutUrl({
                            userId: user.id,
                            email: user.email,
                            name: user.name,
                            priceKey: ctx.body.priceKey
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
                    requireConfigured()
                    try {
                        const { createPortalUrl } = await import("./stripe")
                        const url = await createPortalUrl(
                            ctx.context.session.user.id
                        )
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
            billingWebhook: createAuthEndpoint(
                "/billing/webhook",
                {
                    method: "POST",
                    metadata: {
                        openapi: {
                            operationId: "handleBillingWebhook",
                            description: "Stripe billing webhook"
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
                            await import("./stripe")
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
            )
        }
    } satisfies BetterAuthPlugin
}
