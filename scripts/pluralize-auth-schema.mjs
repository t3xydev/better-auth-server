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
