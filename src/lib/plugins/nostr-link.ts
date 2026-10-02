import type { BetterAuthPlugin } from "better-auth"
import {
    APIError,
    createAuthEndpoint,
    sessionMiddleware
} from "better-auth/api"
import { z } from "zod"

type NostrPubkeyRow = {
    publicKey: string
    userId: string
    createdAt?: Date | string
}

async function listUserNostrKeys(
    adapter: {
        findMany: <T>(args: {
            model: string
            where: { field: string; value: string }[]
        }) => Promise<T[]>
    },
    userId: string
) {
    return adapter.findMany<NostrPubkeyRow>({
        model: "nostrPubkey",
        where: [{ field: "userId", value: userId }]
    })
}

async function hasOtherSignInMethod(
    adapter: {
        findMany: <T>(args: {
            model: string
            where: { field: string; value: string }[]
            limit?: number
        }) => Promise<T[]>
    },
    userId: string,
    keys: NostrPubkeyRow[],
    publicKey: string
) {
    const remainingKeys = keys.filter((key) => key.publicKey !== publicKey)
    if (remainingKeys.length > 0) return true

    const accounts = await adapter.findMany<{ providerId: string }>({
        model: "account",
        where: [{ field: "userId", value: userId }]
    })
    if (accounts.some((account) => account.providerId === "credential")) {
        return true
    }

    const passkeys = await adapter.findMany({
        model: "passkey",
        where: [{ field: "userId", value: userId }],
        limit: 1
    })
    return passkeys.length > 0
}

export const nostrLink = () => {
    return {
        id: "nostr-link",
        endpoints: {
            linkNostr: createAuthEndpoint(
                "/nostr/link",
                {
                    method: "POST",
                    use: [sessionMiddleware],
                    metadata: {
                        openapi: {
                            operationId: "linkNostr",
                            description:
                                "Link a Nostr public key to the authenticated user"
                        }
                    }
                },
                async (ctx) => {
                    const { unpackEventFromToken, validateEvent } =
                        await import("nostr-tools/nip98")

                    const userId = ctx.context.session.user.id

                    const token = ctx.headers?.get("authorization") || ""
                    if (!token) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Missing authorization token"
                        })
                    }

                    const body = (ctx.body || {}) as {
                        nonce?: string
                    }
                    const nonce =
                        typeof body.nonce === "string" ? body.nonce.trim() : ""
                    if (!nonce) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Missing nonce"
                        })
                    }

                    const event = await unpackEventFromToken(token).catch(
                        (error: Error) => {
                            throw new APIError("BAD_REQUEST", {
                                message: error.message || "Invalid token"
                            })
                        }
                    )

                    const linkUrl = new URL(ctx.request?.url ?? "")
                    linkUrl.search = ""
                    linkUrl.hash = ""
                    await validateEvent(event, linkUrl.toString(), "post", {
                        nonce
                    }).catch((error: Error) => {
                        throw new APIError("UNAUTHORIZED", {
                            message: error.message || "Invalid event"
                        })
                    })

                    const verification =
                        await ctx.context.internalAdapter.consumeVerificationValue(
                            `nostr:${event.pubkey}`
                        )
                    if (!verification || verification.value !== nonce) {
                        throw new APIError("UNAUTHORIZED", {
                            message: "Invalid or expired nonce"
                        })
                    }

                    const existing = await ctx.context.adapter.findOne<{
                        publicKey: string
                        userId: string
                    }>({
                        model: "nostrPubkey",
                        where: [
                            {
                                field: "publicKey",
                                value: event.pubkey
                            }
                        ]
                    })

                    if (existing && existing.userId !== userId) {
                        throw new APIError("BAD_REQUEST", {
                            message:
                                "This Nostr key is already linked to another account"
                        })
                    }

                    if (existing && existing.userId === userId) {
                        return ctx.json(
                            { publicKey: event.pubkey },
                            { status: 200 }
                        )
                    }

                    await ctx.context.adapter.create({
                        model: "nostrPubkey",
                        data: {
                            publicKey: event.pubkey,
                            userId,
                            createdAt: new Date()
                        }
                    })

                    return ctx.json(
                        { publicKey: event.pubkey },
                        { status: 200 }
                    )
                }
            ),
            listNostrKeys: createAuthEndpoint(
                "/nostr/keys",
                {
                    method: "GET",
                    use: [sessionMiddleware],
                    metadata: {
                        openapi: {
                            operationId: "listNostrKeys",
                            description:
                                "List Nostr public keys linked to the authenticated user"
                        }
                    }
                },
                async (ctx) => {
                    const userId = ctx.context.session.user.id
                    const keys = await listUserNostrKeys(
                        ctx.context.adapter,
                        userId
                    )
                    return ctx.json({
                        keys: keys.map((key) => ({
                            publicKey: key.publicKey,
                            createdAt:
                                key.createdAt instanceof Date
                                    ? key.createdAt.toISOString()
                                    : (key.createdAt ?? null)
                        }))
                    })
                }
            ),
            unlinkNostr: createAuthEndpoint(
                "/nostr/unlink",
                {
                    method: "POST",
                    use: [sessionMiddleware],
                    body: z.object({
                        publicKey: z.string().min(1)
                    }),
                    metadata: {
                        openapi: {
                            operationId: "unlinkNostr",
                            description:
                                "Unlink a Nostr public key from the authenticated user"
                        }
                    }
                },
                async (ctx) => {
                    const userId = ctx.context.session.user.id
                    const publicKey = ctx.body.publicKey.trim()
                    const keys = await listUserNostrKeys(
                        ctx.context.adapter,
                        userId
                    )
                    const linked = keys.find(
                        (key) => key.publicKey === publicKey
                    )
                    if (!linked) {
                        throw new APIError("NOT_FOUND", {
                            message: "Nostr key is not linked to this account"
                        })
                    }

                    const canUnlink = await hasOtherSignInMethod(
                        ctx.context.adapter,
                        userId,
                        keys,
                        publicKey
                    )
                    if (!canUnlink) {
                        throw new APIError("BAD_REQUEST", {
                            message:
                                "Cannot unlink the last sign-in method on this account"
                        })
                    }

                    await ctx.context.adapter.delete({
                        model: "nostrPubkey",
                        where: [
                            { field: "publicKey", value: publicKey },
                            { field: "userId", value: userId }
                        ]
                    })

                    return ctx.json({ publicKey })
                }
            )
        }
    } satisfies BetterAuthPlugin
}
