/**
 * `auth generate --adapter drizzle` emits singular table names. This kit uses
 * drizzleAdapter({ usePlural: true }), so rewrite the generated schema in place.
 */
import { readFileSync, writeFileSync } from "node:fs"

const path = new URL("../auth-schema.ts", import.meta.url)
let src = readFileSync(path, "utf8")

const snake = [
    ["oauth_client_assertion", "oauth_client_assertions"],
    ["oauth_client_resource", "oauth_client_resources"],
    ["oauth_refresh_token", "oauth_refresh_tokens"],
    ["oauth_access_token", "oauth_access_tokens"],
    ["oauth_consent", "oauth_consents"],
    ["oauth_resource", "oauth_resources"],
    ["oauth_client", "oauth_clients"],
    ["dbsc_bound_key", "dbsc_bound_keys"],
    ["dbsc_session", "dbsc_sessions"],
    ["devtools_user", "devtools_users"],
    ["billing_entitlement", "billing_entitlements"],
    ["billing_subscription", "billing_subscriptions"],
    ["billing_customer", "billing_customers"],
    ["nostr_pubkey", "nostr_pubkeys"],
    ["invite_use", "invite_uses"],
    ["two_factor", "two_factors"],
    ["invitation", "invitations"],
    ["organization", "organizations"],
    ["passkey", "passkeys"],
    ["verification", "verifications"],
    ["session", "sessions"],
    ["account", "accounts"],
    ["member", "members"],
    ["invite", "invites"],
    ["user", "users"]
]

for (const [oldName, newName] of snake) {
    src = src.replaceAll(`pgTable("${oldName}"`, `pgTable("${newName}"`)
    src = src.replaceAll(`pgTable(\n  "${oldName}"`, `pgTable(\n  "${newName}"`)
}

src = src.replace('pgTable("jwks"', 'pgTable("jwkss"')

const idents = [
    ["oauthClientAssertion", "oauthClientAssertions"],
    ["oauthClientResource", "oauthClientResources"],
    ["oauthRefreshToken", "oauthRefreshTokens"],
    ["oauthAccessToken", "oauthAccessTokens"],
    ["oauthConsent", "oauthConsents"],
    ["oauthResource", "oauthResources"],
    ["oauthClient", "oauthClients"],
    ["dbscBoundKey", "dbscBoundKeys"],
    ["dbscSession", "dbscSessions"],
    ["devtoolsUser", "devtoolsUsers"],
    ["billingEntitlement", "billingEntitlements"],
    ["billingSubscription", "billingSubscriptions"],
    ["billingCustomer", "billingCustomers"],
    ["nostrPubkey", "nostrPubkeys"],
    ["inviteUse", "inviteUses"],
    ["invitation", "invitations"],
    ["organization", "organizations"],
    ["twoFactor", "twoFactors"],
    ["passkey", "passkeys"],
    ["verification", "verifications"],
    ["session", "sessions"],
    ["account", "accounts"],
    ["member", "members"],
    ["invite", "invites"],
    ["jwks", "jwkss"],
    ["user", "users"]
]

for (const [oldName, newName] of idents) {
    src = src.replace(
        new RegExp(`(?<![A-Za-z0-9_])${oldName}(?![A-Za-z0-9_])`, "g"),
        newName
    )
}

src = src.replace(/jwkss:\s*text\("jwkss"\)/g, 'jwks: text("jwks")')

src = src.replaceAll('.default("members")', '.default("member")')

const indexNames = [
    ["session_userId_idx", "sessions_userId_idx"],
    ["account_userId_idx", "accounts_userId_idx"],
    ["verification_identifier_idx", "verifications_identifier_idx"],
    ["twoFactor_secret_idx", "twoFactors_secret_idx"],
    ["twoFactor_userId_idx", "twoFactors_userId_idx"],
    ["passkey_userId_idx", "passkeys_userId_idx"],
    ["passkey_credentialID_idx", "passkeys_credentialID_idx"],
    ["member_organizationId_idx", "members_organizationId_idx"],
    ["member_userId_idx", "members_userId_idx"],
    ["invitation_organizationId_idx", "invitations_organizationId_idx"],
    ["invitation_email_idx", "invitations_email_idx"],
    ["nostrPubkey_userId_idx", "nostrPubkeys_userId_idx"],
    [
        "oauthClientResource_clientId_resourceId_uidx",
        "oauthClientResources_clientId_resourceId_uidx"
    ],
    ["oauthClientResource_clientId_idx", "oauthClientResources_clientId_idx"],
    [
        "oauthClientResource_resourceId_idx",
        "oauthClientResources_resourceId_idx"
    ],
    ["oauthClient_userId_idx", "oauthClients_userId_idx"],
    ["oauthRefreshToken_clientId_idx", "oauthRefreshTokens_clientId_idx"],
    ["oauthRefreshToken_sessionId_idx", "oauthRefreshTokens_sessionId_idx"],
    ["oauthRefreshToken_userId_idx", "oauthRefreshTokens_userId_idx"],
    [
        "oauthRefreshToken_authorizationCodeId_idx",
        "oauthRefreshTokens_authorizationCodeId_idx"
    ],
    ["oauthAccessToken_clientId_idx", "oauthAccessTokens_clientId_idx"],
    ["oauthAccessToken_sessionId_idx", "oauthAccessTokens_sessionId_idx"],
    ["oauthAccessToken_userId_idx", "oauthAccessTokens_userId_idx"],
    [
        "oauthAccessToken_authorizationCodeId_idx",
        "oauthAccessTokens_authorizationCodeId_idx"
    ],
    ["oauthAccessToken_refreshId_idx", "oauthAccessTokens_refreshId_idx"],
    ["oauthConsent_clientId_idx", "oauthConsents_clientId_idx"],
    ["oauthConsent_userId_idx", "oauthConsents_userId_idx"]
]

for (const [oldName, newName] of indexNames) {
    src = src.replaceAll(`"${oldName}"`, `"${newName}"`)
}

const relationExports = [
    ["userRelations", "usersRelations"],
    ["sessionRelations", "sessionsRelations"],
    ["accountRelations", "accountsRelations"],
    ["twoFactorRelations", "twoFactorsRelations"],
    ["passkeyRelations", "passkeysRelations"],
    ["organizationRelations", "organizationsRelations"],
    ["memberRelations", "membersRelations"],
    ["invitationRelations", "invitationsRelations"],
    ["inviteRelations", "invitesRelations"],
    ["inviteUseRelations", "inviteUsesRelations"],
    ["billingCustomerRelations", "billingCustomersRelations"],
    ["billingSubscriptionRelations", "billingSubscriptionsRelations"],
    ["billingEntitlementRelations", "billingEntitlementsRelations"],
    ["nostrPubkeyRelations", "nostrPubkeysRelations"],
    ["oauthClientRelations", "oauthClientsRelations"],
    ["oauthResourceRelations", "oauthResourcesRelations"],
    ["oauthClientResourceRelations", "oauthClientResourcesRelations"],
    ["oauthRefreshTokenRelations", "oauthRefreshTokensRelations"],
    ["oauthAccessTokenRelations", "oauthAccessTokensRelations"],
    ["oauthConsentRelations", "oauthConsentsRelations"],
    ["dbscSessionRelations", "dbscSessionsRelations"],
    ["dbscBoundKeyRelations", "dbscBoundKeysRelations"],
    ["devtoolsUserRelations", "devtoolsUsersRelations"]
]

for (const [oldName, newName] of relationExports) {
    src = src.replaceAll(`export const ${oldName}`, `export const ${newName}`)
}

writeFileSync(path, src)
console.log("pluralized", path.pathname)
