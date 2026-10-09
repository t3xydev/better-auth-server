import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

import { loggedInAuthRouteRedirect } from "@/lib/oauth-resume"

const authRoutes = ["/auth/sign-in", "/auth/password", "/auth/sign-up"]
const protectedPrefixes = ["/account", "/admin"]

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)
    const { pathname } = request.nextUrl

    if (
        sessionCookie &&
        authRoutes.some((route) => pathname.startsWith(route))
    ) {
        return NextResponse.redirect(
            new URL(
                loggedInAuthRouteRedirect(request.nextUrl.search),
                request.url
            )
        )
    }

    if (
        !sessionCookie &&
        protectedPrefixes.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
        )
    ) {
        const redirectTo = pathname + request.nextUrl.search
        return NextResponse.redirect(
            new URL(`/auth/sign-in?redirectTo=${redirectTo}`, request.url)
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        "/auth/sign-in",
        "/auth/password",
        "/auth/sign-up",
        "/account",
        "/account/:path*",
        "/admin/:path*"
    ]
}
