import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

import {
    legacyAuthRedirect,
    loggedInAuthRouteRedirect
} from "@/lib/oauth-resume"

const authRoutes = [
    "/auth/sign-in",
    "/auth/password",
    "/auth/sign-up",
    "/auth/signup"
]
const protectedPrefixes = ["/account", "/admin"]

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)
    const { pathname } = request.nextUrl

    if (
        sessionCookie &&
        (pathname === "/auth" ||
            authRoutes.some((route) => pathname.startsWith(route)))
    ) {
        return NextResponse.redirect(
            new URL(
                loggedInAuthRouteRedirect(request.nextUrl.search),
                request.url
            )
        )
    }

    const legacyPath = legacyAuthRedirect(pathname, request.nextUrl.search)
    if (legacyPath) {
        return NextResponse.redirect(new URL(legacyPath, request.url))
    }

    if (
        !sessionCookie &&
        protectedPrefixes.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
        )
    ) {
        const redirectTo = pathname + request.nextUrl.search
        return NextResponse.redirect(
            new URL(`/auth?redirectTo=${redirectTo}`, request.url)
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        "/auth",
        "/auth/sign-in",
        "/auth/password",
        "/auth/sign-up",
        "/auth/signup",
        "/account",
        "/account/:path*",
        "/admin/:path*"
    ]
}
