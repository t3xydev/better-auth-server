import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { dash, sentinel } from "@better-auth/infra"
import { oauthProvider } from "@better-auth/oauth-provider"
import { getAuthenticatorName, passkey } from "@better-auth/passkey"
import { dbsc } from "@dbsc-toolkit/better-auth"
import { type BetterAuthPlugin, betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { expireCookie } from "better-auth/cookies"
import { nextCookies } from "better-auth/next-js"
import {
    admin,
    jwt,
    openAPI,
    organization,
    twoFactor
} from "better-auth/plugins"
import { devtools } from "better-auth-devtools"
import { nostr } from "better-auth-nostr"
import { invite } from "better-invite"
import { db } from "@/database/db"
import * as schema from "@/database/schema"
import { emailCodeLogin } from "@/lib/plugins/email-code-login"
import { nostrLink } from "@/lib/plugins/nostr-link"
import {
    DCR_DEFAULT_SCOPES,
    PROVIDER_SCOPES,
    PUBLIC_SCOPES
} from "./client-trust"
import {
    allowDynamicClientRegistration,
    allowUnauthenticatedClientRegistration
} from "./dynamic-client-registration"
import { sendEmail } from "./email"
import { INVITE_TOKEN_COOKIE, inviteOnly } from "./invite-only"
import { isUsableInviteToken } from "./invite-only-server"
import { organizationsEnabled } from "./organizations"
import {
    passkeyTwoFactorAvailability,
    verifyPendingTwoFactorPasskey
} from "./passkey-two-factor"

/** Bridges better-invite `$ERROR_CODES` to Better Auth’s `RawError` shape. See `docs/framework/typescript-better-invite.mdx`. */
type FixErrorCodes<T> = Omit<T, "$ERROR_CODES"> &
    Pick<BetterAuthPlugin, "$ERROR_CODES">

const ALLOWED_SCOPES = PROVIDER_SCOPES

const authOrigin = (
    process.env.BETTER_AUTH_URL || "http://localhost:3000"
).replace(/\/$/, "")

const defaultResource = (process.env.OAUTH_AUDIENCE || authOrigin).replace(
    /\/$/,
    ""
)

const trustedOrigins = [
    authOrigin,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean)
]

export const auth = betterAuth({
    // baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    appName: process.env.APPLICATION_NAME || "Better Auth Server",
    trustedOrigins,
    onAPIError: { errorURL: "/auth/error" },
    advanced: {
        ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
        database: { joins: true }
    },
    session: {
        storeSessionInDatabase: true,
        cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "jwe" }
    },
    database:
        process.env.AUTH_GENERATE === "1"
            ? memoryAdapter({ oauthResource: [] })
            : drizzleAdapter(db, {
                  provider: "pg",
                  usePlural: true,
                  schema,
                  transaction: true
              }),
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            void sendEmail({
                template: "verify-email",
                to: user.email,
                subject: "Verify your email address",
                text: `Click the link to verify your email: ${url}`,
                variables: {
                    verificationUrl: url,
                    userEmail: user.email,
                    userName: user.name
                }
            })
        },
        sendOnSignUp: true,
        autoSignInAfterVerification: true
    },
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
            void sendEmail({
                template: "reset-password",
                to: user.email,
                subject: "Reset your password",
                text: `Click the link to reset your password: ${url}`,
                variables: {
                    resetLink: url,
                    userEmail: user.email,
                    userName: user.name
                }
            })
        }
    },
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            if (!inviteOnly || ctx.path !== "/sign-up/email") return
            const inviteCookie =
                ctx.context.createAuthCookie(INVITE_TOKEN_COOKIE)
            const token = await ctx.getSignedCookie(
                inviteCookie.name,
                ctx.context.secret
            )
            if (token) {
                if (await isUsableInviteToken(token)) return
                // Invite was canceled/deleted/expired — drop the stale cookie
                expireCookie(ctx, inviteCookie)
            }
            // Allow the very first account so an admin can bootstrap invites
            const existingUsers =
                await ctx.context.internalAdapter.countTotalUsers()
            if (existingUsers === 0) return
            throw new APIError("FORBIDDEN", {
                message: "An invitation is required to create an account."
            })
        })
    },
    disabledPaths: ["/token"],
    plugins: [
        emailCodeLogin(),
        admin(),
        twoFactor(),
        passkey({
            rpName: process.env.APPLICATION_NAME || "Better Auth Server",
            origin: authOrigin,
            rpID: new URL(authOrigin).hostname,
            authentication: {
                afterVerification: verifyPendingTwoFactorPasskey
            },
            registration: {
                afterVerification: async ({ verification }) => ({
                    name: getAuthenticatorName(
                        verification.registrationInfo?.aaguid
                    )
                })
            }
        }),
        passkeyTwoFactorAvailability(),
        ...(organizationsEnabled
            ? [
                  organization({
                      async sendInvitationEmail(data) {
                          const inviteLink = `${authOrigin}/auth/accept-invitation?invitationId=${data.id}`
                          void sendEmail({
                              template: "invitation",
                              to: data.email,
                              subject: `Join ${data.organization.name}`,
                              text: `${data.inviter.user.name} invited you to join ${data.organization.name}. Accept the invitation: ${inviteLink}`,
                              variables: {
                                  inviteLink,
                                  inviterName: data.inviter.user.name,
                                  inviterEmail: data.inviter.user.email,
                                  organizationName: data.organization.name,
                                  role: data.role
                              }
                          })
                      }
                  })
              ]
            : []),
        invite({
            // Custom UI activation flow — see https://www.better-invite.com/docs/examples
            defaultCustomInviteUrl: `${authOrigin}/invite/activate/{token}`,
            defaultRedirectAfterUpgrade: "/auth/invited",
            defaultRedirectToSignIn: "/auth/sign-in",
            defaultRedirectToSignUp: "/auth/sign-up",
            defaultMaxUses: 1,
            defaultSenderResponse: "url",
            // Keep welcome copy simple unless a private invite opts in
            defaultShareInviterName: false,
            // Cancel/reject removes the invite row instead of leaving a canceled record
            cleanupInvitesOnDecision: true,
            // Only admins can create invites (prevents role escalation)
            canCreateInvite: async ({ inviterUser, invitedUser }) => {
                if (inviterUser.role !== "admin") return false
                // Admins may invite as user or admin only
                return (
                    invitedUser.role === "user" || invitedUser.role === "admin"
                )
            },
            async sendUserInvitation({ email, role, url, newAccount }) {
                const appName =
                    process.env.APPLICATION_NAME || "Better Auth Server"
                void sendEmail({
                    template: "application-invite",
                    to: email,
                    subject: newAccount
                        ? "You've been invited"
                        : "You've been invited to a new role",
                    text: newAccount
                        ? `You've been invited with the role "${role}". Accept the invitation: ${url}`
                        : `You've been invited to upgrade to the role "${role}". Accept: ${url}`,
                    variables: {
                        inviteLink: url,
                        inviterName: appName,
                        inviterEmail: email,
                        inviteeEmail: email
                    }
                })
            }
        }) as unknown as FixErrorCodes<ReturnType<typeof invite>>,
        nostr({ disableImplicitSignUp: true }),
        nostrLink(),
        dash(),
        sentinel(),
        openAPI(),
        jwt({
            jwt: {
                issuer:
                    process.env.BETTER_AUTH_URL ||
                    process.env.OAUTH_ISSUER ||
                    "http://localhost:3000"
            }
        }),
        oauthProvider({
            loginPage: "/auth/sign-in",
            consentPage: "/consent",
            scopes: [...ALLOWED_SCOPES],
            resources: [defaultResource],
            clientRegistrationDefaultResources: [defaultResource],
            clientRegistrationAllowedResources: [defaultResource],
            allowDynamicClientRegistration,
            allowUnauthenticatedClientRegistration,
            allowPublicClientPrelogin: false,
            clientRegistrationDefaultScopes: [...DCR_DEFAULT_SCOPES],
            clientRegistrationAllowedScopes: [...PUBLIC_SCOPES],
            clientRegistrationClientSecretExpiration: "30d",
            rateLimit: {
                register: { window: 60, max: 3 },
                authorize: { window: 60, max: 20 },
                token: { window: 60, max: 15 },
                revoke: { window: 60, max: 10 },
                introspect: { window: 60, max: 20 },
                userinfo: { window: 60, max: 30 }
            },
            customAccessTokenClaims: async ({ user }) =>
                user?.role ? { roles: [user.role] } : {},
            customIdTokenClaims: async ({ user }) =>
                user?.role ? { roles: [user.role] } : {},
            customUserInfoClaims: async ({ user }) =>
                user?.role ? { roles: [user.role] } : {},
            advertisedMetadata: {
                claims_supported: [
                    "sub",
                    "iss",
                    "aud",
                    "exp",
                    "iat",
                    "sid",
                    "scope",
                    "azp",
                    "email",
                    "email_verified",
                    "name",
                    "picture",
                    "given_name",
                    "family_name",
                    "roles"
                ]
            }
        }),
        {
            id: "oauth-client-default-resource-backfill",
            init: async (ctx) => {
                if (process.env.AUTH_GENERATE === "1") return
                try {
                    const clients = await ctx.adapter.findMany({
                        model: "oauthClient"
                    })
                    for (const client of clients as { clientId?: string }[]) {
                        if (!client.clientId) continue
                        const existing = await ctx.adapter.findOne({
                            model: "oauthClientResource",
                            where: [
                                {
                                    field: "clientId",
                                    value: client.clientId
                                },
                                {
                                    field: "resourceId",
                                    value: defaultResource
                                }
                            ]
                        })
                        if (existing) continue
                        await ctx.adapter.create({
                            model: "oauthClientResource",
                            data: {
                                clientId: client.clientId,
                                resourceId: defaultResource
                            }
                        })
                    }
                } catch {
                    // Schema generate / first migrate may run before these tables exist.
                }
            }
        } satisfies BetterAuthPlugin,
        dbsc() as BetterAuthPlugin,
        devtools({
            enabled: true,
            templates: {
                admin: { label: "Admin", user: { role: "admin" } },
                user: { label: "User", user: { role: "user" } }
            },
            editableFields: [
                {
                    key: "role",
                    label: "Role",
                    type: "select",
                    options: ["admin", "user"]
                }
            ]
        }),
        nextCookies()
    ]
})
