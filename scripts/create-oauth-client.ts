/**
 * Creates a first-party trusted OAuth client.
 *
 * Usage:
 *   npx tsx scripts/create-oauth-client.ts <redirect_uri>
 *
 * Example:
 *   npx tsx scripts/create-oauth-client.ts http://localhost:3001/callback
 */

import "dotenv/config"

async function main() {
    const redirectUri = process.argv[2]
    if (!redirectUri) {
        console.error(
            "Usage: npx tsx scripts/create-oauth-client.ts <redirect_uri>"
        )
        process.exit(1)
    }

    // Dynamic import so env vars are loaded first
    const { auth } = await import("../src/lib/auth")

    const client = await auth.api.adminCreateOAuthClient({
        headers: new Headers(),
        body: {
            redirect_uris: [redirectUri],
            client_secret_expires_at: 0,
            skip_consent: true,
            enable_end_session: true
        }
    })

    console.log("\n--- OAuth Client Created ---")
    console.log(`Client ID:     ${client.client_id}`)
    console.log(`Client Secret: ${client.client_secret}`)
    console.log(`Redirect URI:  ${redirectUri}`)
    console.log(
        "\nSave the client_secret now — it cannot be retrieved later.\n"
    )
}

main().catch((err) => {
    console.error("Failed to create OAuth client:", err)
    process.exit(1)
})
