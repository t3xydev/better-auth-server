import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider"
import { auth } from "@/lib/auth"
import { advertisePublicClientTokenAuth } from "@/lib/oauth-metadata"

const getOpenIdConfig = oauthProviderOpenIdConfigMetadata(auth)

export const GET = async (request: Request) =>
    advertisePublicClientTokenAuth(await getOpenIdConfig(request))
