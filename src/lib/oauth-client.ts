/** Public OAuth clients use `token_endpoint_auth_method=none`. */
export function isPublicOAuthClient(client: {
    tokenEndpointAuthMethod?: string | null
}) {
    return client.tokenEndpointAuthMethod === "none"
}
