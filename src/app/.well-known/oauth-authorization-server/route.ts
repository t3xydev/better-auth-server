import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"
import { auth } from "@/lib/auth"
import { advertisePublicClientTokenAuth } from "@/lib/oauth-metadata"

const getAuthorizationServerMetadata = oauthProviderAuthServerMetadata(auth)

export const GET = async (request: Request) =>
    advertisePublicClientTokenAuth(
        await getAuthorizationServerMetadata(request)
    )
