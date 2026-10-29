/**
 * Email code is the form on `/auth`. The Auth UI path name stays `sign-in`
 * so older `/auth/sign-in` links can redirect there. Password stays at
 * `/auth/password`.
 */
export const preferredAuthViewPaths = {
    EMAIL_OTP: "sign-in",
    SIGN_IN: "password"
} as const
