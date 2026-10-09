const DEFAULT_POST_LOGIN_PATH = "/account/settings"
const OAUTH_AUTHORIZE_PATH = "/api/auth/oauth2/authorize"
const SIGNED_QUERY_PARAM = "ba_param"

/**
 * In-progress OIDC / OAuth login pages. Navigating between these must keep the
 * signed authorize query (password vs email code, 2FA, consent).
 */
const AUTH_FLOW_PATHS = [
    "/auth/sign-in",
    "/auth/password",
    "/auth/sign-up",
    "/auth/two-factor",
    "/auth/recover-account",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/email-otp",
    "/auth/callback",
    "/consent",
    OAUTH_AUTHORIZE_PATH
]

export type OAuthContinueResponse = {
    redirect?: boolean
    url?: string
    /** Present on completed sign-in responses that are not an OAuth redirect. */
    session?: unknown
} | null

function pathnameOf(href: string): string {
    if (href.startsWith("https://") || href.startsWith("http://")) {
        try {
            return new URL(href).pathname
        } catch {
            return href
        }
    }

    return href.split("?")[0] ?? href
}

export function isAuthFlowNavigation(href: string): boolean {
    const pathname = pathnameOf(href)
    return AUTH_FLOW_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
}

/**
 * Reconstruct the signed query the OAuth provider attached to `loginPage`.
 * Extra UI params (e.g. `redirectTo`) are dropped so the authorize resume
 * verifies.
 */
export function signedOAuthQuery(search: string): string | null {
    const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search
    )
    if (!params.has("sig") || !params.has(SIGNED_QUERY_PARAM)) return null

    const signedNames = new Set(params.getAll(SIGNED_QUERY_PARAM))
    const signed = new URLSearchParams()
    for (const [key, value] of params.entries()) {
        if (
            key === "sig" ||
            key === SIGNED_QUERY_PARAM ||
            signedNames.has(key)
        ) {
            signed.append(key, value)
        }
    }

    return signed.toString()
}

export function oauthAuthorizeResumePath(search: string): string | null {
    const query = signedOAuthQuery(search)
    return query ? `${OAUTH_AUTHORIZE_PATH}?${query}` : null
}

export function loggedInAuthRouteRedirect(
    search: string,
    fallback = DEFAULT_POST_LOGIN_PATH
): string {
    return oauthAuthorizeResumePath(search) ?? fallback
}

/**
 * After email-code / passkey / password, Auth UI navigates to account settings
 * and would drop the pending authorize request. Send that navigation back to
 * `/oauth2/authorize` instead, while still allowing 2FA and method switching.
 */
export function oauthAwareDestination(href: string, search: string): string {
    const resume = oauthAuthorizeResumePath(search)
    if (resume && !isAuthFlowNavigation(href)) return resume
    return href
}

export function navigatePreservingOAuth(
    href: string,
    navigate: (href: string) => void,
    search = typeof window === "undefined" ? "" : window.location.search
): void {
    const destination = oauthAwareDestination(href, search)
    if (destination !== href && typeof window !== "undefined") {
        window.location.assign(destination)
        return
    }

    navigate(destination)
}

/** Prefer the plugin's `{ redirect, url }` continue payload, then the page query. */
export function followOAuthContinue(
    response?: OAuthContinueResponse,
    search = typeof window === "undefined" ? "" : window.location.search
): boolean {
    if (typeof window === "undefined") return false

    if (response?.redirect && response.url) {
        window.location.assign(response.url)
        return true
    }

    const resume = oauthAuthorizeResumePath(search)
    if (!resume) return false
    window.location.assign(resume)
    return true
}
