import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

const authRoutes = ["/auth/sign-in", "/auth/password", "/auth/sign-up"]
const protectedRoutes = [
    "/account/settings",
    "/account/nostr",
    "/account/billing",
    "/admin"
]

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)
    const { pathname } = request.nextUrl

    if (
        sessionCookie &&
        authRoutes.some((route) => pathname.startsWith(route))
    ) {
        return NextResponse.redirect(new URL("/account/settings", request.url))
    }

    if (
        !sessionCookie &&
        protectedRoutes.some((route) => pathname.startsWith(route))
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
        "/account/settings",
        "/account/nostr",
        "/account/billing",
        "/admin/:path*"
    ]
}
