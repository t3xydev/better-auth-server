import { dashClient, sentinelClient } from "@better-auth/infra/client"
import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { passkeyClient } from "@better-auth/passkey/client"
import { dbscClient } from "@dbsc-toolkit/better-auth/client"
import type { BetterAuthPlugin } from "better-auth"
import {
    adminClient,
    emailOTPClient,
    organizationClient,
    twoFactorClient
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { nostrClient } from "better-auth-nostr/client"
import { type invite, inviteClient } from "better-invite"
import { organizationsEnabled } from "@/lib/organizations"
import posthog from "@/lib/posthog"
import { billingEnabled } from "@/modules/billing"
import { billingClient } from "@/modules/billing/client"

/** See `docs/framework/typescript-better-invite.mdx` — must match server `invite()` shim. */
type FixErrorCodes<T> = Omit<T, "$ERROR_CODES"> &
    Pick<BetterAuthPlugin, "$ERROR_CODES">

const authEventsByPath: Record<string, string> = {
    "/change-email": "email_changed",
    "/change-password": "password_changed",
    "/sign-in/email-otp": "email_code_sign_in",
    "/update-user": "profile_updated",
    "/passkey/verify-authentication": "passkey_sign_in",
    "/passkey/verify-registration": "passkey_added",
    "/passkey/delete-passkey": "passkey_deleted",
    "/two-factor/verify-totp": "2fa_totp_verified",
    "/two-factor/enable": "2fa_enabled",
    "/two-factor/disable": "2fa_disabled",
    "/nostr/login": "nostr_sign_in",
    "/nostr/link": "nostr_key_linked"
}

export const authClient = createAuthClient({
    plugins: [
        emailOTPClient(),
        passkeyClient(),
        adminClient(),
        ...(organizationsEnabled ? [organizationClient()] : []),
        ...(billingEnabled ? [billingClient()] : []),
        dashClient(),
        sentinelClient({
            autoSolveChallenge: true,
            ...(process.env.NEXT_PUBLIC_BETTER_AUTH_IDENTIFY_URL && {
                identifyUrl: process.env.NEXT_PUBLIC_BETTER_AUTH_IDENTIFY_URL
            })
        }),
        twoFactorClient({
            twoFactorPage: "/auth/two-factor"
        }),
        nostrClient(),
        oauthProviderClient(),
        inviteClient() as unknown as {
            id: "invite"
            $InferServerPlugin: FixErrorCodes<ReturnType<typeof invite>>
        },
        dbscClient()
    ],
    fetchOptions: {
        onSuccess: (ctx) => {
            if (typeof window === "undefined") return
            const path = new URL(ctx.response.url).pathname
            for (const [suffix, event] of Object.entries(authEventsByPath)) {
                if (path.endsWith(suffix)) {
                    posthog.capture(event)
                    break
                }
            }
        }
    }
})
