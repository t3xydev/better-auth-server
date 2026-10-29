import { expireCookie } from "better-auth/cookies"

import { INVITE_TOKEN_COOKIE, inviteOnly } from "@/lib/invite-only"
import { isUsableInviteToken } from "@/lib/invite-only-server"

type EmailCodeContext = Parameters<typeof expireCookie>[0]

/**
 * An existing account can always receive a sign-in code. A new account can
 * be created when registration is open, a usable invite cookie is present,
 * or the server has no users yet.
 */
export function emailCodeSignInAllowed(input: {
    userExists: boolean
    inviteOnly: boolean
    inviteUsable: boolean
    isBootstrap: boolean
}): boolean {
    if (input.userExists || !input.inviteOnly) return true
    return input.inviteUsable || input.isBootstrap
}

export async function resolveEmailCodeSignInAllowed(
    ctx: EmailCodeContext,
    email: string
): Promise<boolean> {
    const userExists = Boolean(
        await ctx.context.internalAdapter.findUserByEmail(email.toLowerCase())
    )
    if (userExists || !inviteOnly) {
        return emailCodeSignInAllowed({
            userExists,
            inviteOnly,
            inviteUsable: false,
            isBootstrap: false
        })
    }

    const inviteCookie = ctx.context.createAuthCookie(INVITE_TOKEN_COOKIE)
    const token = await ctx.getSignedCookie(
        inviteCookie.name,
        ctx.context.secret
    )
    let inviteUsable = false
    if (token) {
        inviteUsable = await isUsableInviteToken(token)
        if (!inviteUsable) expireCookie(ctx, inviteCookie)
    }

    const isBootstrap = inviteUsable
        ? false
        : (await ctx.context.internalAdapter.countTotalUsers()) === 0

    return emailCodeSignInAllowed({
        userExists: false,
        inviteOnly: true,
        inviteUsable,
        isBootstrap
    })
}
