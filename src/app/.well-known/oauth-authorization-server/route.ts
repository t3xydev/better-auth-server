import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"
import { auth } from "@/lib/auth"
import {
    advertisePublicClientTokenAuth,
    discoveryOptionsResponse
} from "@/lib/oauth-metadata"

const getAuthorizationServerMetadata = oauthProviderAuthServerMetadata(auth)

export const OPTIONS = discoveryOptionsResponse

export const GET = async (request: Request) =>
    advertisePublicClientTokenAuth(
        await getAuthorizationServerMetadata(request),
        request
    )
