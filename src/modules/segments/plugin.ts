import type { BetterAuthPlugin } from "better-auth"
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api"

export function segments() {
    return {
        id: "segments",
        schema: {
            segmentRole: {
                fields: {
                    slug: {
                        type: "string",
                        unique: true
                    },
                    name: {
                        type: "string"
                    },
                    description: {
                        type: "string",
                        required: false
                    },
                    createdAt: {
                        type: "date"
                    },
                    updatedAt: {
                        type: "date"
                    }
                }
            },
            segmentRoleMember: {
                fields: {
                    userId: {
                        type: "string",
                        references: {
                            model: "user",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    roleId: {
                        type: "string",
                        references: {
                            model: "segmentRole",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    createdAt: {
                        type: "date"
                    }
                },
                indexes: [
                    {
                        fields: ["userId", "roleId"],
                        unique: true
                    },
                    {
                        fields: ["userId"]
                    },
                    {
                        fields: ["roleId"]
                    }
                ]
            },
            group: {
                fields: {
                    slug: {
                        type: "string",
                        unique: true
                    },
                    name: {
                        type: "string"
                    },
                    description: {
                        type: "string",
                        required: false
                    },
                    createdAt: {
                        type: "date"
                    },
                    updatedAt: {
                        type: "date"
                    }
                }
            },
            groupMember: {
                fields: {
                    userId: {
                        type: "string",
                        references: {
                            model: "user",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    groupId: {
                        type: "string",
                        references: {
                            model: "group",
                            field: "id",
                            onDelete: "cascade"
                        }
                    },
                    createdAt: {
                        type: "date"
                    }
                },
                indexes: [
                    {
                        fields: ["userId", "groupId"],
                        unique: true
                    },
                    {
                        fields: ["userId"]
                    },
                    {
                        fields: ["groupId"]
                    }
                ]
            }
        },
        rateLimit: [
            {
                pathMatcher: (path: string) => path === "/segments/me",
                window: 60,
                max: 30
            }
        ],
        endpoints: {
            segmentsMe: createAuthEndpoint(
                "/segments/me",
                {
                    method: "GET",
                    use: [sessionMiddleware],
                    metadata: {
                        openapi: {
                            operationId: "getMySegments",
                            description:
                                "Current user's IdP privilege, catalog roles, and groups"
                        }
                    }
                },
                async (ctx) => {
                    const { getUserSegments } = await import("./store")
                    const user = ctx.context.session.user
                    return ctx.json(await getUserSegments(user.id, user.role))
                }
            )
        }
    } satisfies BetterAuthPlugin
}
